/**
 * Admin-placed orders: an admin acting on one customer's behalf from the
 * admin panel.
 *
 * Nothing here creates a parallel ordering path. Products go into the
 * customer's own cart for the next open delivery date and subscription changes
 * go through the same lifecycle service the customer app uses, so the nightly
 * job, manifest, delivery confirmation and billing treat an admin-placed order
 * exactly like one the customer placed — and the customer sees it in the app
 * the moment it is saved. Every change notifies the customer (in-app + push).
 */
const { db, admin } = require('../../config/firebase');
const manifestSettings = require('../settings/manifestSettings.service');
const cartService = require('../cart/cart.service');
const tomorrowService = require('../cart/tomorrow.service');
const subscriptionService = require('../subscriptions/subscription.service');
const subscriptionLifecycle = require('../subscriptions/subscription.lifecycle');
const orderService = require('../orders/order.service');
const dueService = require('../dues/due.service');
const notificationService = require('../notifications/notification.service');
const dateUtil = require('../../utils/date');
const { isValidQuantity } = require('../../utils/validators');
const { logActivity } = require('../../utils/activityLog');

const MAX_LINES_PER_ORDER = 30;
const MAX_UNITS_PER_LINE = 50;
const MAX_NOTE_LENGTH = 200;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function httpError(message, statusCode, extra = {}) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

function actorFrom(adminCtx) {
  return { type: 'admin', id: adminCtx.adminId, username: adminCtx.username || null };
}

function isProfileComplete(user) {
  return !!(user.name && user.area_id && user.address);
}

/**
 * Load the target customer and enforce the admin's area scope. An area admin
 * can only act on customers in their own area; a super admin on anyone.
 * Customers outside scope get a 404, not a 403, so ids cannot be probed.
 */
async function loadCustomer(adminCtx, userId, { requireComplete = true } = {}) {
  if (!userId || typeof userId !== 'string') throw httpError('Customer not found', 404);
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) throw httpError('Customer not found', 404);

  const user = userDoc.data();
  if (adminCtx.role !== 'super_admin' && user.area_id !== adminCtx.areaId) {
    throw httpError('Customer not found', 404);
  }
  if (user.deletion_requested) {
    if (requireComplete) throw httpError('This customer has requested account deletion; orders are disabled', 400);
  }
  if (requireComplete && !isProfileComplete(user)) {
    throw httpError('This customer has not completed their profile (name, area and address are required)', 400);
  }
  return { id: userDoc.id, ...user };
}

function validateNote(note) {
  if (note === undefined || note === null || note === '') return null;
  if (typeof note !== 'string') throw httpError('note must be text', 400);
  const trimmed = note.trim();
  if (trimmed.length > MAX_NOTE_LENGTH) throw httpError(`note must be ${MAX_NOTE_LENGTH} characters or fewer`, 400);
  return trimmed || null;
}

function validateRequestId(adminCtx, requestId) {
  if (requestId === undefined || requestId === null) return null;
  if (typeof requestId !== 'string' || !REQUEST_ID_RE.test(requestId)) {
    throw httpError('request_id must be 8-64 letters, digits, "-" or "_"', 400);
  }
  // Namespaced per admin so two admins can never collide on an id.
  return `${encodeURIComponent(adminCtx.adminId)}_${requestId}`;
}

function validateUnits(quantity, { allowZero = false } = {}) {
  const min = allowZero ? 0 : 1;
  if (!Number.isInteger(quantity) || quantity < min || quantity > MAX_UNITS_PER_LINE) {
    throw httpError(`quantity must be a whole number from ${min} to ${MAX_UNITS_PER_LINE}`, 400);
  }
}

/**
 * The delivery date the admin was looking at must still be the one a change
 * lands on. If the area cutoff passed while the page was open, the next open
 * date has rolled forward; applying the change silently to a different day
 * would surprise both the admin and the customer, so it is refused with the
 * new date instead.
 */
async function resolveTargetDate(areaId, expectedDate) {
  const targetDate = await manifestSettings.getCartTargetDate(areaId);
  if (expectedDate && expectedDate !== targetDate) {
    throw httpError(
      `The cutoff has passed — the next open delivery date is now ${targetDate}. Review the order and submit again.`,
      409,
      { code: 'TARGET_DATE_CHANGED', details: { target_date: targetDate } }
    );
  }
  return targetDate;
}

function serializeTimestamp(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate().toISOString();
  return value;
}

function serializeSubscription(sub) {
  if (!sub) return null;
  return {
    id: sub.id,
    milk_type: sub.milk_type,
    quantity_litres: sub.quantity_litres,
    price_per_litre: sub.price_per_litre,
    daily_value: +(Number(sub.quantity_litres) * Number(sub.price_per_litre)).toFixed(2),
    delivery_slot: sub.delivery_slot || 'morning',
    status: sub.status,
    start_date: sub.start_date || null,
    effective_from: sub.effective_from || sub.start_date || null,
    created_by: sub.created_by || { type: 'user' },
    paused_at: serializeTimestamp(sub.paused_at),
    resumed_at: serializeTimestamp(sub.resumed_at),
    created_at: serializeTimestamp(sub.created_at),
  };
}

async function audit(adminCtx, action, { userId, entityType, entityId, details }) {
  try {
    await db.collection('audit_logs').add({
      actor_type: 'admin',
      actor_id: adminCtx.adminId,
      target_user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: { ...details, admin_username: adminCtx.username || null },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[adminOrders] audit log failed:', err.message);
  }
}

// ─── Overview ────────────────────────────────────────────────────────────────

/**
 * Everything the "Order for customer" page needs in one call: who the
 * customer is, their live subscription, what is currently booked for the next
 * open delivery date, deliveries already committed, and their balance.
 */
async function getCustomerOverview(adminCtx, userId) {
  const user = await loadCustomer(adminCtx, userId, { requireComplete: false });
  const areaId = user.area_id;

  const settings = await manifestSettings.getAreaManifestSettings(areaId);
  const targetDate = manifestSettings.cartTargetDateFromSettings(settings);

  const [subscription, nextDelivery, due, pricesSnap, ordersSnap] = await Promise.all([
    subscriptionService.getActiveSubscription(userId),
    tomorrowService.getTomorrowStatus(userId, targetDate, areaId),
    dueService.getUserDue(userId),
    db.collection('price_config').get(),
    db.collection('orders').where('user_id', '==', userId).where('date', '>=', dateUtil.today()).get(),
  ]);

  const upcomingOrders = ordersSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((order) => order.status === 'pending')
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .map((order) => ({
      id: order.id,
      date: order.date,
      status: order.status,
      delivery_slot: order.delivery_slot,
      milk: order.milk || null,
      extra_items: order.extra_items || [],
      total_amount: order.total_amount || 0,
    }));

  return {
    customer: {
      id: user.id,
      name: user.name || null,
      phone: user.phone || null,
      address: user.address || null,
      area_id: areaId,
      location: user.location || null,
      is_profile_complete: isProfileComplete(user),
      deletion_requested: !!user.deletion_requested,
      // Tells the admin whether a push will reach a device. The in-app
      // notification is written either way.
      push_enabled: !!user.fcm_token,
    },
    schedule: {
      target_date: targetDate,
      today: dateUtil.today(),
      cutoff_time: settings.cutoff_time,
      generation_time: settings.generation_time,
      is_past_cutoff: manifestSettings.isAtOrPast(settings.cutoff_time),
      timezone: settings.timezone,
    },
    subscription: serializeSubscription(subscription),
    next_delivery: nextDelivery,
    upcoming_orders: upcomingOrders,
    due,
    prices: pricesSnap.docs
      .map((doc) => doc.data())
      .filter((p) => p.is_active !== false)
      .map((p) => ({ milk_type: p.milk_type, price_per_litre: p.price_per_litre })),
  };
}

// ─── Products ────────────────────────────────────────────────────────────────

/**
 * Diff two cart item lists into the added / updated / removed sets used for
 * the customer notification and the audit trail.
 */
function diffItems(previousItems, nextItems) {
  const before = new Map(previousItems.map((item) => [item.product_id, item]));
  const after = new Map(nextItems.map((item) => [item.product_id, item]));
  const changes = { added: [], updated: [], removed: [] };

  after.forEach((item, productId) => {
    const prev = before.get(productId);
    if (!prev) changes.added.push(item);
    else if (prev.quantity !== item.quantity) changes.updated.push({ item, previousQuantity: prev.quantity });
  });
  before.forEach((item, productId) => {
    if (!after.has(productId)) changes.removed.push(item);
  });
  return changes;
}

function hasChanges(changes) {
  return changes.added.length + changes.updated.length + changes.removed.length > 0;
}

async function finishCartChange(adminCtx, user, { date, result, note, action }) {
  const changes = diffItems(result.previousItems, result.items);
  const status = await tomorrowService.getTomorrowStatus(user.id, date, user.area_id);

  // A replayed request has already been notified and audited once.
  if (result.duplicate || !hasChanges(changes)) {
    return { duplicate: result.duplicate, changes, next_delivery: status };
  }

  const cartTotal = orderService.extrasTotal(result.items);

  try {
    await notificationService.sendCartUpdatedNotification(user.id, user.area_id, {
      date,
      changes,
      cartTotal,
      note,
    });
  } catch (err) {
    // The order is saved; a failed notification must not report it as failed.
    console.error('[adminOrders] cart notification failed:', err.message);
  }

  const summarize = (items) => items.map((i) => ({ product_id: i.product_id, product_name: i.product_name, quantity: i.quantity }));
  await audit(adminCtx, `cart.admin_${action}`, {
    userId: user.id,
    entityType: 'carts',
    entityId: `${user.id}_${date}`,
    details: {
      date,
      added: summarize(changes.added),
      updated: changes.updated.map(({ item, previousQuantity }) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        previous_quantity: previousQuantity,
      })),
      removed: summarize(changes.removed),
      cart_total: cartTotal,
      note,
    },
  });

  await logActivity({
    type: 'admin_order',
    title: action === 'added' ? 'Order Placed for Customer' : 'Customer Order Updated',
    message: `${adminCtx.username || 'An admin'} ${action === 'added' ? 'placed an order' : 'updated the order'} for ${user.name || user.phone || 'a customer'} for delivery on ${date}.`,
    areaId: user.area_id,
    meta: {
      user_id: user.id,
      date,
      admin_id: adminCtx.adminId,
      added: changes.added.length,
      updated: changes.updated.length,
      removed: changes.removed.length,
      cart_total: cartTotal,
    },
  });

  return { duplicate: false, changes, next_delivery: status };
}

/**
 * Add one or more products to the customer's next open delivery.
 */
async function addProducts(adminCtx, userId, { items, expected_date, note, request_id }) {
  const user = await loadCustomer(adminCtx, userId);
  const cleanNote = validateNote(note);
  const requestId = validateRequestId(adminCtx, request_id);

  if (!Array.isArray(items) || items.length === 0) throw httpError('items must be a non-empty list', 400);
  if (items.length > MAX_LINES_PER_ORDER) throw httpError(`At most ${MAX_LINES_PER_ORDER} products per order`, 400);

  // Collapse duplicate lines for the same product before validating totals.
  const requested = new Map();
  for (const line of items) {
    if (!line || typeof line.product_id !== 'string' || !line.product_id) {
      throw httpError('Each item needs a product_id', 400);
    }
    validateUnits(line.quantity);
    requested.set(line.product_id, (requested.get(line.product_id) || 0) + line.quantity);
  }

  const products = await Promise.all([...requested.keys()].map((id) => cartService.loadOrderableProduct(id)));
  const date = await resolveTargetDate(user.area_id, expected_date);
  const stampedAt = new Date().toISOString();

  const result = await cartService.mutateCart(user.id, user.area_id, date, (current) => {
    const next = current;
    for (const product of products) {
      const quantity = requested.get(product.id);
      const existing = next.find((item) => item.product_id === product.id);
      if (existing) {
        const merged = existing.quantity + quantity;
        if (merged > MAX_UNITS_PER_LINE) {
          throw httpError(
            `${product.name} would reach ${merged} units (max ${MAX_UNITS_PER_LINE}). Edit the existing line instead.`,
            400
          );
        }
        existing.quantity = merged;
        existing.total = merged * existing.price;
        existing.added_by_admin = true;
        existing.admin_updated_at = stampedAt;
      } else {
        next.push(cartService.lineItem(product, quantity, { added_by_admin: true, admin_updated_at: stampedAt }));
      }
    }
    return next;
  }, { requestId, requestMeta: { admin_id: adminCtx.adminId, action: 'add_products' } });

  return finishCartChange(adminCtx, user, { date, result, note: cleanNote, action: 'added' });
}

/**
 * Set the quantity of one product already in the customer's next delivery.
 * A quantity of 0 removes it.
 */
async function setProductQuantity(adminCtx, userId, productId, { quantity, expected_date, note, request_id }) {
  const user = await loadCustomer(adminCtx, userId);
  const cleanNote = validateNote(note);
  const requestId = validateRequestId(adminCtx, request_id);
  validateUnits(quantity, { allowZero: true });

  const date = await resolveTargetDate(user.area_id, expected_date);
  const stampedAt = new Date().toISOString();

  const result = await cartService.mutateCart(user.id, user.area_id, date, (current) => {
    const idx = current.findIndex((item) => item.product_id === productId);
    if (idx === -1) throw httpError('That product is not in this delivery any more', 404);
    if (current[idx].quantity === quantity) throw httpError(`Quantity is already ${quantity}`, 400);

    if (quantity === 0) {
      current.splice(idx, 1);
    } else {
      current[idx].quantity = quantity;
      current[idx].total = quantity * current[idx].price;
      current[idx].added_by_admin = true;
      current[idx].admin_updated_at = stampedAt;
    }
    return current;
  }, { requestId, requestMeta: { admin_id: adminCtx.adminId, action: 'set_quantity', product_id: productId } });

  return finishCartChange(adminCtx, user, { date, result, note: cleanNote, action: quantity === 0 ? 'removed' : 'updated' });
}

// ─── Subscription ────────────────────────────────────────────────────────────

async function createSubscription(adminCtx, userId, body) {
  const user = await loadCustomer(adminCtx, userId);
  const { milk_type, quantity_litres, start_date, delivery_slot } = body || {};
  if (!milk_type || quantity_litres === undefined || !start_date || !delivery_slot) {
    throw httpError('milk_type, quantity_litres, start_date and delivery_slot are required', 400);
  }

  const subscription = await subscriptionService.createSubscription(
    user.id,
    user.area_id,
    { milk_type, quantity_litres, start_date, delivery_slot },
    { actor: actorFrom(adminCtx) }
  );

  await logActivity({
    type: 'admin_subscription',
    title: 'Subscription Created for Customer',
    message: `${adminCtx.username || 'An admin'} started a ${quantity_litres}L ${milk_type} subscription for ${user.name || user.phone || 'a customer'} from ${start_date}.`,
    areaId: user.area_id,
    meta: { user_id: user.id, subscription_id: subscription.id, admin_id: adminCtx.adminId },
  });

  return { subscription: serializeSubscription(subscription) };
}

const SUBSCRIPTION_ACTIONS = ['pause', 'resume', 'cancel', 'quantity', 'slot'];

async function updateSubscription(adminCtx, userId, subscriptionId, { action, quantity_litres, delivery_slot }) {
  if (!SUBSCRIPTION_ACTIONS.includes(action)) {
    throw httpError(`action must be one of ${SUBSCRIPTION_ACTIONS.join(', ')}`, 400);
  }
  const user = await loadCustomer(adminCtx, userId);
  const options = { actor: actorFrom(adminCtx) };

  let result;
  switch (action) {
    case 'pause':
      result = await subscriptionService.pauseSubscription(subscriptionId, user.id, options);
      break;
    case 'resume':
      result = await subscriptionService.resumeSubscription(subscriptionId, user.id, options);
      break;
    case 'cancel':
      result = await subscriptionService.cancelSubscription(subscriptionId, user.id, options);
      break;
    case 'quantity': {
      if (!isValidQuantity(quantity_litres)) {
        throw httpError('Quantity must be 0.5-10 litres in 0.5L increments', 400);
      }
      const current = await subscriptionService.getActiveSubscription(user.id);
      if (current && current.id === subscriptionId && Number(current.quantity_litres) === quantity_litres) {
        throw httpError(`Daily quantity is already ${quantity_litres}L`, 400);
      }
      result = await subscriptionService.updateQuantity(subscriptionId, user.id, quantity_litres, options);
      break;
    }
    case 'slot':
      result = await subscriptionService.updateDeliverySlot(subscriptionId, user.id, delivery_slot, options);
      break;
    default:
      throw httpError('Unsupported action', 400);
  }

  await logActivity({
    type: 'admin_subscription',
    title: 'Customer Subscription Updated',
    message: `${adminCtx.username || 'An admin'} applied "${action}" to the subscription of ${user.name || user.phone || 'a customer'}.`,
    areaId: user.area_id,
    meta: { user_id: user.id, subscription_id: subscriptionId, action, admin_id: adminCtx.adminId },
  });

  const subscription = await subscriptionService.getActiveSubscription(user.id);
  return { result, subscription: serializeSubscription(subscription) };
}

/**
 * Skip, change or restore the milk of the next open delivery only, without
 * touching the subscription itself.
 */
async function changeNextDelivery(adminCtx, userId, { action, quantity_litres, expected_date }) {
  if (!['skip', 'modify', 'revert'].includes(action)) {
    throw httpError('action must be skip, modify or revert', 400);
  }
  const user = await loadCustomer(adminCtx, userId);
  const date = await resolveTargetDate(user.area_id, expected_date);

  const sub = await subscriptionService.getActiveSubscription(user.id);
  if (!sub || !subscriptionLifecycle.isDeliverableOn(sub, date)) {
    throw httpError(`This customer has no milk delivery scheduled for ${date}`, 400);
  }

  const before = await tomorrowService.getTomorrowStatus(user.id, date, user.area_id);
  let status;
  if (action === 'skip') {
    if (before.is_skipped) throw httpError(`The delivery on ${date} is already skipped`, 400);
    status = await tomorrowService.skipTomorrow(user.id, sub.id, user.area_id);
  } else if (action === 'modify') {
    if (!isValidQuantity(quantity_litres)) {
      throw httpError('Quantity must be 0.5-10 litres in 0.5L increments', 400);
    }
    if (!before.is_skipped && before.effective_milk?.quantity_litres === quantity_litres) {
      throw httpError(`The delivery on ${date} is already ${quantity_litres}L`, 400);
    }
    status = await tomorrowService.modifyTomorrow(user.id, sub.id, user.area_id, quantity_litres);
  } else {
    if (!before.override) throw httpError(`The delivery on ${date} already follows the regular subscription`, 400);
    status = await tomorrowService.revertOverride(user.id, user.area_id);
  }

  // The tomorrow service resolves its own target date; make sure it agreed.
  if (status.date !== date) {
    throw httpError('The cutoff passed while saving. Refresh and review the next delivery.', 409, {
      code: 'TARGET_DATE_CHANGED',
      details: { target_date: status.date },
    });
  }

  try {
    await notificationService.sendNextDeliveryChangedNotification(user.id, user.area_id, {
      date,
      action,
      quantity: action === 'modify' ? quantity_litres : null,
      baseQuantity: sub.quantity_litres,
    });
  } catch (err) {
    console.error('[adminOrders] next-delivery notification failed:', err.message);
  }

  await audit(adminCtx, `next_delivery.admin_${action}`, {
    userId: user.id,
    entityType: 'next_day_overrides',
    entityId: `${user.id}_${date}`,
    details: { date, action, quantity_litres: quantity_litres ?? null, subscription_id: sub.id },
  });

  return { next_delivery: status };
}

module.exports = {
  getCustomerOverview,
  addProducts,
  setProductQuantity,
  createSubscription,
  updateSubscription,
  changeNextDelivery,
  // exported for tests
  diffItems,
};
