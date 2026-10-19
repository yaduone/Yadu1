const { db, admin } = require('../../config/firebase');
const { isValidMilkType, isValidQuantity, isValidSlot } = require('../../utils/validators');
const manifestSettings = require('../settings/manifestSettings.service');
const notificationService = require('../notifications/notification.service');
const orderService = require('../orders/order.service');
const lifecycle = require('./subscription.lifecycle');

const { STATUSES, LIVE_STATUSES } = lifecycle;

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

// Who made a change. Customer-app routes use the default; the admin panel
// passes { type: 'admin', id, username } so the audit trail and the copy of the
// customer's notification both say the dairy made the change.
const USER_ACTOR = Object.freeze({ type: 'user' });

function isAdminActor(actor) {
  return actor?.type === 'admin';
}

/**
 * Customer-facing sentence for a change: "Your ..." when the customer did it,
 * "Your dairy has ..." when an admin did it on their behalf.
 */
function changeCopy(actor, selfText, adminText) {
  return isAdminActor(actor) ? adminText : selfText;
}

const MILK_LABELS = { cow: 'cow', buffalo: 'buffalo', toned: 'child pack' };
const SLOT_LABELS = { morning: 'morning', evening: 'evening', both: 'morning + evening' };

async function notifySubscriptionChange(userId, areaId, payload) {
  try {
    await notificationService.sendSubscriptionUpdatedNotification(userId, areaId, payload);
  } catch (err) {
    console.warn('[subscriptions] notification failed:', err.message);
  }
}

/**
 * Every lifecycle change is audited, so the admin activity feed shows pauses,
 * resumes and cancellations — not just creations and quantity edits.
 */
async function auditSubscriptionChange(action, { userId, subscriptionId, details, actor = USER_ACTOR }) {
  try {
    await db.collection('audit_logs').add({
      actor_type: actor.type,
      actor_id: actor.type === 'admin' ? actor.id : userId,
      target_user_id: userId,
      action,
      entity_type: 'subscriptions',
      entity_id: subscriptionId,
      details: { ...(details || {}), ...(actor.type === 'admin' ? { admin_username: actor.username || null } : {}) },
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[subscriptions] audit log failed:', err.message);
  }
}

/**
 * The first delivery date a change can still affect. Before the area cutoff
 * this is tomorrow; after it, the day after tomorrow — tomorrow's manifest is
 * already committed.
 */
async function getEffectiveDate(areaId) {
  return manifestSettings.getCartTargetDate(areaId);
}

/**
 * Load a subscription and assert the caller owns it.
 */
async function loadOwnedSubscription(subscriptionId, userId) {
  const subRef = db.collection('subscriptions').doc(subscriptionId);
  const subDoc = await subRef.get();

  if (!subDoc.exists) throw httpError('Subscription not found', 404);
  const data = subDoc.data();
  if (data.user_id !== userId) throw httpError('Forbidden', 403);

  return { subRef, data };
}

/**
 * Drop pending next-day overrides (skip / modify) from `fromDate` onward.
 *
 * A pause or cancel makes them meaningless, and leaving them behind used to
 * resurrect a stale quantity when the subscription was resumed later.
 */
async function clearOverridesFrom(userId, fromDate) {
  const snap = await db
    .collection('next_day_overrides')
    .where('user_id', '==', userId)
    .where('date', '>=', fromDate)
    .get();

  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.docs.length;
}

/**
 * Create a new milk subscription for a user.
 */
async function createSubscription(
  userId,
  areaId,
  { milk_type, quantity_litres, start_date, delivery_slot },
  { actor = USER_ACTOR } = {}
) {
  if (!isValidMilkType(milk_type)) {
    throw httpError('Invalid milk type', 400);
  }
  if (!isValidQuantity(quantity_litres)) {
    throw httpError('Quantity must be 0.5-10 litres in 0.5L increments', 400);
  }
  if (!isValidSlot(delivery_slot)) {
    throw httpError('delivery_slot must be morning, evening, or both', 400);
  }

  if (typeof start_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
    throw httpError('start_date must be in YYYY-MM-DD format', 400);
  }

  const earliestStartDate = await getEffectiveDate(areaId);
  if (start_date < earliestStartDate) {
    throw httpError(`Start date must be ${earliestStartDate} or later`, 400);
  }

  // Guard: verify the user's Firestore profile is fully complete before allowing subscription
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    throw httpError('User profile not found. Please complete your profile first.', 403);
  }
  const userData = userDoc.data();
  if (!userData.name || !userData.area_id || !userData.address) {
    throw httpError('Please complete your profile before starting a subscription.', 403);
  }
  if (userData.area_id !== areaId) {
    throw httpError('Customer does not belong to this area', 403);
  }

  // Get current price. The rate is snapshotted onto the subscription so a later
  // price change never silently re-rates an existing customer.
  const priceSnap = await db
    .collection('price_config')
    .where('milk_type', '==', milk_type)
    .where('is_active', '==', true)
    .limit(1)
    .get();

  if (priceSnap.empty) {
    throw httpError('Pricing not available for this milk type', 400);
  }

  const pricePerLitre = priceSnap.docs[0].data().price_per_litre;

  const subscriptionData = {
    user_id: userId,
    area_id: areaId,
    milk_type,
    quantity_litres,
    delivery_slot,
    price_per_litre: pricePerLitre,
    status: STATUSES.ACTIVE,
    created_by: isAdminActor(actor)
      ? { type: 'admin', admin_id: actor.id, username: actor.username || null }
      : { type: 'user' },
    start_date,
    // Deliveries are suppressed before this date. On creation it mirrors
    // start_date; a later pause/resume moves it forward.
    effective_from: start_date,
    paused_at: null,
    resumed_at: null,
    cancelled_at: null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  // The duplicate check and the write happen in one transaction. Two rapid taps
  // on "Start Subscription" previously both passed an unguarded read and created
  // two active subscriptions for the same user, which then produced duplicate
  // manifest rows and double billing.
  const docRef = db.collection('subscriptions').doc();
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(
      db
        .collection('subscriptions')
        .where('user_id', '==', userId)
        .where('status', 'in', LIVE_STATUSES)
        .limit(1)
    );
    if (!existing.empty) {
      throw httpError(
        changeCopy(
          actor,
          'You already have an active or paused subscription',
          'This customer already has an active or paused subscription'
        ),
        400
      );
    }
    tx.create(docRef, subscriptionData);
  });

  await auditSubscriptionChange('subscription.created', {
    userId,
    actor,
    subscriptionId: docRef.id,
    details: { milk_type, quantity_litres, delivery_slot, start_date },
  });

  const summary = `${quantity_litres}L ${MILK_LABELS[milk_type] || milk_type} milk subscription starts on ${start_date} for the ${SLOT_LABELS[delivery_slot] || delivery_slot} slot`;
  await notifySubscriptionChange(userId, areaId, {
    title: 'Subscription Started',
    action: 'created',
    changeDescription: changeCopy(
      actor,
      `Your ${summary}.`,
      `Your dairy has set up a subscription for you: your ${summary} at Rs. ${pricePerLitre}/L.`
    ),
    details: { milk_type, quantity_litres, start_date, delivery_slot, status: STATUSES.ACTIVE },
  });

  return { id: docRef.id, ...subscriptionData };
}

/**
 * Get the user's current (active or paused) subscription.
 *
 * Ordered deterministically so a stray second live row in historical data can
 * never make the app flip between two subscriptions between refreshes.
 */
async function getActiveSubscription(userId) {
  const snap = await db
    .collection('subscriptions')
    .where('user_id', '==', userId)
    .where('status', 'in', LIVE_STATUSES)
    .get();

  if (snap.empty) return null;

  const docs = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    // active outranks paused, then most recently created wins.
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === STATUSES.ACTIVE ? -1 : 1;
      return (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0);
    });

  return docs[0];
}

/**
 * Pause an active subscription from the next changeable delivery date.
 */
async function pauseSubscription(subscriptionId, userId, { actor = USER_ACTOR } = {}) {
  const { subRef, data } = await loadOwnedSubscription(subscriptionId, userId);
  lifecycle.assertTransition('pause', data.status);

  const effectiveFrom = await getEffectiveDate(data.area_id);

  await subRef.update({
    status: STATUSES.PAUSED,
    effective_from: effectiveFrom,
    paused_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  await clearOverridesFrom(userId, effectiveFrom);
  // If the nightly job already built an order for the effective date, strip the
  // milk so a paused customer is never billed on delivery confirmation.
  const withdrawn = await orderService.withdrawSubscriptionMilk(userId, effectiveFrom, 'subscription_paused');

  await auditSubscriptionChange('subscription.paused', {
    userId,
    actor,
    subscriptionId,
    details: { effective_from: effectiveFrom, orders_adjusted: withdrawn.affected },
  });

  await notifySubscriptionChange(userId, data.area_id, {
    title: 'Subscription Paused',
    action: 'paused',
    changeDescription: changeCopy(
      actor,
      `Your regular deliveries are paused from ${effectiveFrom}. Resume whenever you are ready.`,
      `Your dairy has paused your regular deliveries from ${effectiveFrom}. You can resume them from the app anytime.`
    ),
    details: { status: STATUSES.PAUSED, effective_from: effectiveFrom },
  });

  return { id: subscriptionId, status: STATUSES.PAUSED, effective_from: effectiveFrom };
}

/**
 * Resume a paused subscription from the next changeable delivery date.
 */
async function resumeSubscription(subscriptionId, userId, { actor = USER_ACTOR } = {}) {
  const { subRef, data } = await loadOwnedSubscription(subscriptionId, userId);
  lifecycle.assertTransition('resume', data.status);

  const effectiveFrom = await getEffectiveDate(data.area_id);

  await subRef.update({
    status: STATUSES.ACTIVE,
    effective_from: effectiveFrom,
    paused_at: null,
    resumed_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  await auditSubscriptionChange('subscription.resumed', {
    userId,
    actor,
    subscriptionId,
    details: { effective_from: effectiveFrom },
  });

  await notifySubscriptionChange(userId, data.area_id, {
    title: 'Subscription Resumed',
    action: 'resumed',
    changeDescription: changeCopy(
      actor,
      `Your regular deliveries resume from ${effectiveFrom}.`,
      `Your dairy has resumed your regular deliveries from ${effectiveFrom}.`
    ),
    details: { status: STATUSES.ACTIVE, effective_from: effectiveFrom },
  });

  return { id: subscriptionId, status: STATUSES.ACTIVE, effective_from: effectiveFrom };
}

/**
 * Cancel a subscription permanently.
 *
 * Cancellation is always permitted and is never blocked by the area cutoff — a
 * customer must be able to stop a recurring charge at any hour. When the cutoff
 * has passed, the cancellation simply takes effect the day after tomorrow,
 * leaving tomorrow's already-committed manifest intact.
 */
async function cancelSubscription(subscriptionId, userId, { actor = USER_ACTOR } = {}) {
  const { subRef, data } = await loadOwnedSubscription(subscriptionId, userId);
  lifecycle.assertTransition('cancel', data.status);

  const effectiveFrom = await getEffectiveDate(data.area_id);

  await subRef.update({
    status: STATUSES.CANCELLED,
    effective_from: effectiveFrom,
    cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  await clearOverridesFrom(userId, effectiveFrom);
  const withdrawn = await orderService.withdrawSubscriptionMilk(userId, effectiveFrom, 'subscription_cancelled');

  await auditSubscriptionChange('subscription.cancelled', {
    userId,
    actor,
    subscriptionId,
    details: { effective_from: effectiveFrom, orders_adjusted: withdrawn.affected },
  });

  await notifySubscriptionChange(userId, data.area_id, {
    title: 'Subscription Cancelled',
    action: 'cancelled',
    changeDescription: changeCopy(
      actor,
      `Your milk subscription is cancelled. No regular deliveries will be scheduled from ${effectiveFrom}.`,
      `Your dairy has cancelled your milk subscription. No regular deliveries will be scheduled from ${effectiveFrom}.`
    ),
    details: { status: STATUSES.CANCELLED, effective_from: effectiveFrom },
  });

  return { id: subscriptionId, status: STATUSES.CANCELLED, effective_from: effectiveFrom };
}

/**
 * Update the daily quantity of an active or paused subscription.
 *
 * Unlike the lifecycle transitions, a quantity change edits the content of an
 * upcoming delivery, so it stays bound to the cutoff: once tomorrow is locked
 * the customer is pointed at the next open cart instead.
 */
async function updateQuantity(subscriptionId, userId, quantity_litres, { actor = USER_ACTOR } = {}) {
  if (!isValidQuantity(quantity_litres)) {
    throw httpError('Quantity must be 0.5–10 litres in 0.5 L increments', 400);
  }

  const { subRef, data } = await loadOwnedSubscription(subscriptionId, userId);
  if (data.status === STATUSES.CANCELLED) {
    throw httpError('Cannot modify a cancelled subscription', 400);
  }
  await assertBeforeCutoff(data.area_id);

  await subRef.update({
    quantity_litres,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  await auditSubscriptionChange('subscription.quantity_updated', {
    userId,
    actor,
    subscriptionId,
    details: { quantity_litres, previous_quantity: data.quantity_litres ?? null },
  });

  await notifySubscriptionChange(userId, data.area_id, {
    title: 'Daily Quantity Updated',
    action: 'quantity_updated',
    changeDescription: changeCopy(
      actor,
      `Your regular delivery quantity is now ${quantity_litres}L.`,
      `Your dairy has changed your regular delivery quantity from ${data.quantity_litres}L to ${quantity_litres}L.`
    ),
    details: { quantity_litres, status: data.status },
  });

  return { id: subscriptionId, quantity_litres };
}

/**
 * Content edits (quantity, slot) change an upcoming delivery, so they stay
 * bound to the cutoff: once tomorrow is locked they are refused rather than
 * silently applying to a manifest that is already committed.
 */
async function assertBeforeCutoff(areaId) {
  if (await manifestSettings.isPastCutoff(areaId)) {
    throw httpError(
      'Subscription changes are closed for the next delivery. Please update the next available cart instead.',
      400
    );
  }
}

/**
 * Change the delivery slot of an active or paused subscription.
 */
async function updateDeliverySlot(subscriptionId, userId, delivery_slot, { actor = USER_ACTOR } = {}) {
  if (!isValidSlot(delivery_slot)) {
    throw httpError('delivery_slot must be morning, evening, or both', 400);
  }

  const { subRef, data } = await loadOwnedSubscription(subscriptionId, userId);
  if (data.status === STATUSES.CANCELLED) {
    throw httpError('Cannot modify a cancelled subscription', 400);
  }
  const previousSlot = data.delivery_slot || 'morning';
  if (previousSlot === delivery_slot) {
    throw httpError(`Delivery slot is already ${SLOT_LABELS[delivery_slot]}`, 400);
  }
  await assertBeforeCutoff(data.area_id);

  await subRef.update({
    delivery_slot,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  await auditSubscriptionChange('subscription.slot_updated', {
    userId,
    actor,
    subscriptionId,
    details: { delivery_slot, previous_slot: previousSlot },
  });

  await notifySubscriptionChange(userId, data.area_id, {
    title: 'Delivery Slot Updated',
    action: 'slot_updated',
    changeDescription: changeCopy(
      actor,
      `Your regular deliveries now arrive in the ${SLOT_LABELS[delivery_slot]} slot.`,
      `Your dairy has moved your regular deliveries to the ${SLOT_LABELS[delivery_slot]} slot.`
    ),
    details: { delivery_slot, status: data.status },
  });

  return { id: subscriptionId, delivery_slot };
}

/**
 * Hydrate subscription rows with the customer name/phone/address the admin
 * panel needs, batched to respect Firestore's 30-item `in` limit.
 */
async function attachUserDetails(subscriptions) {
  const userIds = [...new Set(subscriptions.map((s) => s.user_id).filter(Boolean))];
  if (userIds.length === 0) return;

  const usersById = new Map();
  for (let i = 0; i < userIds.length; i += 30) {
    const batch = userIds.slice(i, i + 30);
    const snap = await db
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', batch)
      .get();
    snap.docs.forEach((doc) => usersById.set(doc.id, doc.data()));
  }

  subscriptions.forEach((sub) => {
    const user = usersById.get(sub.user_id);
    sub.user = user
      ? { id: sub.user_id, name: user.name || null, phone: user.phone || null, address: user.address || null }
      : null;
  });
}

/**
 * Admin: list subscriptions for an area, with lifecycle state and area totals.
 */
async function listByArea(areaId, { status, page = 1, limit = 20 }) {
  let query = db.collection('subscriptions').where('area_id', '==', areaId);
  if (status) query = query.where('status', '==', status);

  const snap = await query.get();

  const counts = { active: 0, paused: 0, cancelled: 0 };
  let dailyLitres = 0;
  let dailyValue = 0;

  const subscriptions = snap.docs.map((doc) => {
    const data = doc.data();
    if (counts[data.status] !== undefined) counts[data.status]++;

    const quantity = Number(data.quantity_litres) || 0;
    const price = Number(data.price_per_litre) || 0;
    if (data.status === STATUSES.ACTIVE) {
      dailyLitres += quantity;
      dailyValue += quantity * price;
    }

    return {
      id: doc.id,
      user_id: data.user_id,
      milk_type: data.milk_type,
      quantity_litres: quantity,
      price_per_litre: price,
      daily_value: +(quantity * price).toFixed(2),
      delivery_slot: data.delivery_slot || 'morning',
      status: data.status,
      start_date: data.start_date || null,
      effective_from: data.effective_from || data.start_date || null,
      paused_at: data.paused_at || null,
      resumed_at: data.resumed_at || null,
      cancelled_at: data.cancelled_at || null,
      created_at: data.created_at || null,
      updated_at: data.updated_at || null,
    };
  });

  // Newest first, so a freshly started or just-cancelled subscription is visible
  // at the top of the admin list without hunting through pages.
  subscriptions.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));

  const start = (page - 1) * limit;
  const paged = subscriptions.slice(start, start + limit);

  // Only the returned page is hydrated — enriching every row would cost an
  // extra read per customer in the area on every poll.
  await attachUserDetails(paged);

  return {
    subscriptions: paged,
    total: subscriptions.length,
    page,
    limit,
    summary: {
      ...counts,
      total: subscriptions.length,
      daily_litres: +dailyLitres.toFixed(2),
      daily_value: +dailyValue.toFixed(2),
    },
  };
}

module.exports = {
  createSubscription,
  getActiveSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  updateQuantity,
  updateDeliverySlot,
  listByArea,
  getEffectiveDate,
};
