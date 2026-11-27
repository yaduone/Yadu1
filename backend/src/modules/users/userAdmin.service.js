/**
 * Admin view and editing of a single customer account (the admin panel's user
 * page). Subscription, next-delivery and product changes stay in the
 * adminOrders module so they keep going through the lifecycle the customer app
 * uses; this module owns the profile itself and gathers everything else about
 * the customer into one read.
 */
const { db, admin } = require('../../config/firebase');
const dueService = require('../dues/due.service');
const subscriptionService = require('../subscriptions/subscription.service');
const { logActivity } = require('../../utils/activityLog');
const dateUtil = require('../../utils/date');

const MAX_NAME_LENGTH = 80;
const MAX_ADDRESS_LINE = 200;
const MAX_BLOCK_REASON = 200;
const RECENT_ORDER_LIMIT = 30;
const PHONE_RE = /^\+?[0-9]{10,15}$/;
const PINCODE_RE = /^[0-9]{6}$/;

function httpError(message, statusCode, extra = {}) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

function serializeTimestamp(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate().toISOString();
  return value;
}

function isProfileComplete(user) {
  return !!(user.name && user.area_id && user.address);
}

/**
 * Load a customer within the admin's scope. Outside it the customer does not
 * exist as far as the caller is concerned (404, so ids cannot be probed).
 */
async function loadScopedUser(adminCtx, userId) {
  if (!userId || typeof userId !== 'string') throw httpError('User not found', 404);
  const ref = db.collection('users').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw httpError('User not found', 404);

  const data = snap.data();
  if (adminCtx.role !== 'super_admin' && data.area_id !== adminCtx.areaId) {
    throw httpError('User not found', 404);
  }
  return { ref, user: { id: snap.id, ...data } };
}

function profileView(user, areaName) {
  return {
    id: user.id,
    name: user.name || null,
    phone: user.phone || null,
    address: user.address || null,
    area_id: user.area_id || null,
    area_name: areaName || null,
    call_in_enabled: user.call_in_enabled !== false,
    instant_orders_blocked: !!user.instant_orders_blocked,
    instant_block_reason: user.instant_block_reason || null,
    deletion_requested: !!user.deletion_requested,
    deletion_requested_at: serializeTimestamp(user.deletion_requested_at),
    location: user.location
      ? { ...user.location, recorded_at: serializeTimestamp(user.location.recorded_at) }
      : null,
    is_profile_complete: isProfileComplete(user),
    push_enabled: !!user.fcm_token,
    created_at: serializeTimestamp(user.created_at),
    updated_at: serializeTimestamp(user.updated_at),
  };
}

function subscriptionView(sub) {
  const quantity = Number(sub.quantity_litres) || 0;
  const price = Number(sub.price_per_litre) || 0;
  return {
    id: sub.id,
    milk_type: sub.milk_type,
    quantity_litres: quantity,
    price_per_litre: price,
    price_overridden: !!sub.price_overridden,
    daily_value: +(quantity * price).toFixed(2),
    delivery_slot: sub.delivery_slot || 'morning',
    status: sub.status,
    start_date: sub.start_date || null,
    effective_from: sub.effective_from || sub.start_date || null,
    created_by: sub.created_by || { type: 'user' },
    created_at: serializeTimestamp(sub.created_at),
    paused_at: serializeTimestamp(sub.paused_at),
    cancelled_at: serializeTimestamp(sub.cancelled_at),
  };
}

function instantOrderView(id, order) {
  return {
    id,
    date: order.date || null,
    status: order.status,
    payment_mode: order.payment_mode || 'cod',
    items: (order.items || []).map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
    })),
    items_total: order.items_total || 0,
    delivery_charge: order.delivery_charge || 0,
    extra_charges_total: order.extra_charges_total || 0,
    total_amount: order.total_amount || 0,
    placed_at: serializeTimestamp(order.placed_at),
    expected_delivery_by: order.expected_delivery_by || null,
    rejection_reason: order.rejection_reason || null,
    cancelled_by: order.cancelled_by || null,
    due_adjustment_id: order.due_adjustment_id || null,
  };
}

function regularOrderView(id, order) {
  return {
    id,
    date: order.date,
    status: order.status,
    delivery_slot: order.delivery_slot || null,
    milk: order.milk || null,
    extra_items: (order.extra_items || []).map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name || item.name,
      quantity: item.quantity,
      total: item.total,
    })),
    total_amount: order.total_amount || 0,
  };
}

function paymentView(id, payment) {
  return {
    id,
    amount: payment.amount,
    method: payment.method,
    notes: payment.notes || null,
    payment_date: payment.payment_date || null,
    collected_by_admin_id: payment.collected_by_admin_id || null,
    created_at: serializeTimestamp(payment.created_at),
  };
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Everything the admin user page shows that is not already served by the
 * "Order for customer" overview: profile, balance and its full ledger,
 * subscription history, and recent regular and instant orders.
 */
async function getUserDetail(adminCtx, userId) {
  const { user } = await loadScopedUser(adminCtx, userId);

  const [areaSnap, due, payments, adjustments, subscriptions, instantSnap, ordersSnap, areasSnap] = await Promise.all([
    user.area_id ? db.collection('areas').doc(user.area_id).get() : Promise.resolve(null),
    dueService.getUserDue(user.id),
    dueService.getUserPayments(user.id),
    dueService.getUserAdjustments(user.id),
    subscriptionService.listUserSubscriptions(user.id),
    db.collection('instant_orders').where('user_id', '==', user.id).get(),
    db.collection('orders').where('user_id', '==', user.id).get(),
    // Only a super admin can move a customer between areas, so only they need the list.
    adminCtx.role === 'super_admin' ? db.collection('areas').get() : Promise.resolve(null),
  ]);

  const instantOrders = instantSnap.docs
    .map((doc) => ({ doc, millis: doc.data().placed_at?.toMillis?.() ?? 0 }))
    .sort((a, b) => b.millis - a.millis)
    .map(({ doc }) => instantOrderView(doc.id, doc.data()));

  const instantSummary = instantOrders.reduce((acc, order) => {
    acc.total += 1;
    if (order.status === 'delivered') {
      acc.delivered += 1;
      acc.delivered_value += order.total_amount;
      if (order.due_adjustment_id) acc.added_to_due += 1;
    }
    if (order.status === 'pending' || order.status === 'acknowledged') acc.open += 1;
    return acc;
  }, { total: 0, open: 0, delivered: 0, delivered_value: 0, added_to_due: 0 });
  instantSummary.delivered_value = +instantSummary.delivered_value.toFixed(2);

  const regularOrders = ordersSnap.docs
    .map((doc) => regularOrderView(doc.id, doc.data()))
    .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

  return {
    user: profileView(user, areaSnap?.exists ? areaSnap.data().name : null),
    due,
    payments: payments.map((p) => paymentView(p.id, p)),
    adjustments,
    adjustment_categories: Object.keys(dueService.ADJUSTMENT_CATEGORIES),
    subscriptions: subscriptions.map(subscriptionView),
    instant_orders: instantOrders.slice(0, RECENT_ORDER_LIMIT),
    instant_summary: instantSummary,
    orders: regularOrders.slice(0, RECENT_ORDER_LIMIT),
    orders_total: regularOrders.length,
    today: dateUtil.today(),
    areas: areasSnap
      ? areasSnap.docs
        .map((doc) => ({ id: doc.id, name: doc.data().name, is_active: doc.data().is_active !== false }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      : null,
    can_change_area: adminCtx.role === 'super_admin',
  };
}

// ─── Update ──────────────────────────────────────────────────────────────────

function cleanText(value, field, { max, required = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null || value === '') {
    if (required) throw httpError(`${field} is required`, 400);
    return '';
  }
  if (typeof value !== 'string') throw httpError(`${field} must be text`, 400);
  const trimmed = value.trim();
  if (required && !trimmed) throw httpError(`${field} is required`, 400);
  if (max && trimmed.length > max) throw httpError(`${field} must be ${max} characters or fewer`, 400);
  return trimmed;
}

/**
 * Indian numbers typed without a country code are stored the way Firebase
 * phone auth stores them (+91XXXXXXXXXX), so the list and search stay uniform.
 */
function normalizePhone(value) {
  if (typeof value !== 'string') throw httpError('phone must be text', 400);
  const compact = value.replace(/[\s\-()]/g, '');
  if (!PHONE_RE.test(compact)) throw httpError('Enter a valid phone number (10-15 digits)', 400);
  if (!compact.startsWith('+') && compact.length === 10) return `+91${compact}`;
  return compact.startsWith('+') ? compact : `+${compact}`;
}

function validateAddress(value, existing) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw httpError('address must be an object with line1 and pincode', 400);
  }
  const line1 = cleanText(value.line1, 'Address line 1', { max: MAX_ADDRESS_LINE, required: true });
  const line2 = cleanText(value.line2 ?? '', 'Address line 2', { max: MAX_ADDRESS_LINE });
  const landmark = cleanText(value.landmark ?? '', 'Landmark', { max: MAX_ADDRESS_LINE });
  const rawPincode = typeof value.pincode === 'number' ? String(value.pincode) : value.pincode;
  const pincode = cleanText(rawPincode, 'Pincode', { required: true });
  if (!PINCODE_RE.test(pincode)) throw httpError('Pincode must be 6 digits', 400);

  // Keep any extra keys the app may have stored alongside the address.
  const base = existing && typeof existing === 'object' ? existing : {};
  return { ...base, line1, line2, landmark, pincode };
}

/**
 * Moving a customer to another area re-homes their manifest, billing area and
 * admin. It is refused while anything is still scheduled in the old area,
 * because the old area's nightly job and admins would keep acting on it.
 */
async function assertAreaMovable(user) {
  const today = dateUtil.today();
  const [subsSnap, ordersSnap, cartsSnap, instantSnap] = await Promise.all([
    db.collection('subscriptions').where('user_id', '==', user.id).get(),
    db.collection('orders').where('user_id', '==', user.id).get(),
    db.collection('carts').where('user_id', '==', user.id).get(),
    db.collection('instant_orders').where('user_id', '==', user.id).get(),
  ]);

  const blockers = [];
  if (subsSnap.docs.some((doc) => ['active', 'paused'].includes(doc.data().status))) {
    blockers.push('cancel their subscription');
  }
  if (ordersSnap.docs.some((doc) => doc.data().status === 'pending' && doc.data().date >= today)) {
    blockers.push('wait for (or cancel) their upcoming deliveries');
  }
  if (cartsSnap.docs.some((doc) => doc.data().date >= today && (doc.data().items || []).length > 0)) {
    blockers.push('remove the products booked for an upcoming delivery');
  }
  if (instantSnap.docs.some((doc) => ['pending', 'acknowledged'].includes(doc.data().status))) {
    blockers.push('finish their open instant order');
  }
  if (blockers.length) {
    throw httpError(`Before moving this customer to another area, ${blockers.join(', ')}.`, 400);
  }
}

const AUDITED_FIELDS = [
  'name', 'phone', 'address', 'call_in_enabled', 'instant_orders_blocked',
  'instant_block_reason', 'deletion_requested', 'area_id',
];

/**
 * Partial update of a customer's profile and account settings. Only the
 * fields present in the body change.
 */
async function updateUserProfile(adminCtx, userId, body) {
  const { ref, user } = await loadScopedUser(adminCtx, userId);
  const input = body && typeof body === 'object' ? body : {};
  const changes = {};

  if (input.name !== undefined) {
    changes.name = cleanText(input.name, 'Name', { max: MAX_NAME_LENGTH, required: true });
  }

  if (input.phone !== undefined) {
    changes.phone = normalizePhone(input.phone);
  }

  if (input.address !== undefined) {
    changes.address = validateAddress(input.address, user.address);
  }

  if (input.call_in_enabled !== undefined) {
    if (typeof input.call_in_enabled !== 'boolean') throw httpError('call_in_enabled must be true or false', 400);
    changes.call_in_enabled = input.call_in_enabled;
  }

  if (input.instant_orders_blocked !== undefined) {
    if (typeof input.instant_orders_blocked !== 'boolean') {
      throw httpError('instant_orders_blocked must be true or false', 400);
    }
    changes.instant_orders_blocked = input.instant_orders_blocked;
    if (!input.instant_orders_blocked) changes.instant_block_reason = null;
  }

  const willBeBlocked = changes.instant_orders_blocked ?? !!user.instant_orders_blocked;
  if (input.instant_block_reason !== undefined && willBeBlocked) {
    const reason = cleanText(input.instant_block_reason, 'Block reason', { max: MAX_BLOCK_REASON });
    changes.instant_block_reason = reason || null;
  }

  if (input.deletion_requested !== undefined) {
    // Admins can withdraw a request (the customer changed their mind) but not
    // raise one; deleting the account outright is a separate action.
    if (input.deletion_requested !== false) {
      throw httpError('deletion_requested can only be cleared (set to false)', 400);
    }
    changes.deletion_requested = false;
    changes.deletion_requested_at = null;
  }

  let newArea = null;
  if (input.area_id !== undefined && input.area_id !== user.area_id) {
    if (adminCtx.role !== 'super_admin') {
      throw httpError('Only a super admin can move a customer to another area', 403);
    }
    if (typeof input.area_id !== 'string' || !input.area_id) throw httpError('area_id is required', 400);
    const areaSnap = await db.collection('areas').doc(input.area_id).get();
    if (!areaSnap.exists || areaSnap.data().is_active === false) {
      throw httpError('That area does not exist or is not active', 400);
    }
    await assertAreaMovable(user);
    changes.area_id = input.area_id;
    newArea = { id: areaSnap.id, name: areaSnap.data().name };
  }

  // Drop fields that would not actually change anything. Flags compare
  // against the default an unset field means.
  const current = {
    ...user,
    call_in_enabled: user.call_in_enabled !== false,
    instant_orders_blocked: !!user.instant_orders_blocked,
    deletion_requested: !!user.deletion_requested,
  };
  Object.keys(changes).forEach((key) => {
    if (JSON.stringify(changes[key] ?? null) === JSON.stringify(current[key] ?? null)) delete changes[key];
  });
  if (changes.deletion_requested === undefined) delete changes.deletion_requested_at;

  if (Object.keys(changes).length === 0) {
    throw httpError('Nothing to update — the values are unchanged', 400);
  }

  const batch = db.batch();
  batch.update(ref, { ...changes, updated_at: admin.firestore.FieldValue.serverTimestamp() });

  if (newArea) {
    // The balance and the live instant cart follow the customer, so the new
    // area's dues list and instant board see them.
    const [dueSnap, instantCartSnap] = await Promise.all([
      db.collection('due_amounts').doc(user.id).get(),
      db.collection('instant_carts').doc(user.id).get(),
    ]);
    if (dueSnap.exists) batch.update(dueSnap.ref, { area_id: newArea.id });
    if (instantCartSnap.exists) batch.update(instantCartSnap.ref, { area_id: newArea.id });
  }
  await batch.commit();

  const changed = Object.keys(changes).filter((key) => AUDITED_FIELDS.includes(key));
  const details = {};
  changed.forEach((key) => {
    details[key] = { from: user[key] ?? null, to: changes[key] ?? null };
  });

  try {
    await db.collection('audit_logs').add({
      actor_type: 'admin',
      actor_id: adminCtx.adminId,
      target_user_id: user.id,
      action: 'user.admin_updated',
      entity_type: 'users',
      entity_id: user.id,
      details: { ...details, admin_username: adminCtx.username || null },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[userAdmin] audit log failed:', err.message);
  }

  await logActivity({
    type: 'user_updated',
    title: 'Customer Details Updated',
    message: `${adminCtx.username || 'An admin'} updated ${changed.join(', ').replace(/_/g, ' ')} for ${changes.name || user.name || user.phone || 'a customer'}.`,
    areaId: changes.area_id || user.area_id || adminCtx.areaId,
    meta: { user_id: user.id, admin_id: adminCtx.adminId, fields: changed },
  });

  const fresh = await ref.get();
  let areaName = newArea?.name || null;
  if (!areaName && fresh.data().area_id) {
    const areaSnap = await db.collection('areas').doc(fresh.data().area_id).get();
    areaName = areaSnap.exists ? areaSnap.data().name : null;
  }
  return { user: profileView({ id: fresh.id, ...fresh.data() }, areaName), changed };
}

module.exports = {
  getUserDetail,
  updateUserProfile,
  // exported for tests
  normalizePhone,
  validateAddress,
};
