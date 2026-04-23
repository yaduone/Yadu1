const { db, admin } = require('../../config/firebase');
const { isValidMilkType, isValidQuantity, isValidSlot } = require('../../utils/validators');
const dateUtil = require('../../utils/date');

/**
 * Create a new milk subscription for a user.
 */
async function createSubscription(userId, areaId, { milk_type, quantity_litres, start_date, delivery_slot }) {
  if (!isValidMilkType(milk_type)) {
    throw Object.assign(new Error('Invalid milk type'), { statusCode: 400 });
  }
  if (!isValidQuantity(quantity_litres)) {
    throw Object.assign(new Error('Quantity must be 0.5-10 litres in 0.5L increments'), { statusCode: 400 });
  }
  if (!isValidSlot(delivery_slot)) {
    throw Object.assign(new Error('delivery_slot must be morning, evening, or both'), { statusCode: 400 });
  }

  const tomorrow = dateUtil.tomorrow();
  if (start_date < tomorrow) {
    throw Object.assign(new Error('Start date must be tomorrow or later'), { statusCode: 400 });
  }

  // Check no active/paused subscription exists
  const existing = await db
    .collection('subscriptions')
    .where('user_id', '==', userId)
    .where('status', 'in', ['active', 'paused'])
    .limit(1)
    .get();

  if (!existing.empty) {
    throw Object.assign(new Error('You already have an active or paused subscription'), { statusCode: 400 });
  }

  // Get current price
  const priceSnap = await db
    .collection('price_config')
    .where('milk_type', '==', milk_type)
    .where('is_active', '==', true)
    .limit(1)
    .get();

  if (priceSnap.empty) {
    throw Object.assign(new Error('Pricing not available for this milk type'), { statusCode: 400 });
  }

  const pricePerLitre = priceSnap.docs[0].data().price_per_litre;

  const subscriptionData = {
    user_id: userId,
    area_id: areaId,
    milk_type,
    quantity_litres,
    delivery_slot,
    price_per_litre: pricePerLitre,
    status: 'active',
    start_date,
    paused_at: null,
    cancelled_at: null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('subscriptions').add(subscriptionData);

  // Log audit
  await db.collection('audit_logs').add({
    actor_type: 'user',
    actor_id: userId,
    action: 'subscription.created',
    entity_type: 'subscriptions',
    entity_id: docRef.id,
    details: { milk_type, quantity_litres, delivery_slot, start_date },
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { id: docRef.id, ...subscriptionData };
}

/**
 * Get user's active or paused subscription.
 */
async function getActiveSubscription(userId) {
  const snap = await db
    .collection('subscriptions')
    .where('user_id', '==', userId)
    .where('status', 'in', ['active', 'paused'])
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Pause an active subscription.
 */
async function pauseSubscription(subscriptionId, userId) {
  const subRef = db.collection('subscriptions').doc(subscriptionId);
  const subDoc = await subRef.get();

  if (!subDoc.exists) throw Object.assign(new Error('Subscription not found'), { statusCode: 404 });
  if (subDoc.data().user_id !== userId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  if (subDoc.data().status !== 'active') {
    throw Object.assign(new Error('Only active subscriptions can be paused'), { statusCode: 400 });
  }

  await subRef.update({
    status: 'paused',
    paused_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Clean up tomorrow override
  const tomorrow = dateUtil.tomorrow();
  const overrideSnap = await db
    .collection('next_day_overrides')
    .where('user_id', '==', userId)
    .where('date', '==', tomorrow)
    .limit(1)
    .get();
  if (!overrideSnap.empty) {
    await overrideSnap.docs[0].ref.delete();
  }

  return { id: subscriptionId, status: 'paused' };
}

/**
 * Resume a paused subscription.
 */
async function resumeSubscription(subscriptionId, userId) {
  const subRef = db.collection('subscriptions').doc(subscriptionId);
  const subDoc = await subRef.get();

  if (!subDoc.exists) throw Object.assign(new Error('Subscription not found'), { statusCode: 404 });
  if (subDoc.data().user_id !== userId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  if (subDoc.data().status !== 'paused') {
    throw Object.assign(new Error('Only paused subscriptions can be resumed'), { statusCode: 400 });
  }

  await subRef.update({
    status: 'active',
    paused_at: null,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { id: subscriptionId, status: 'active' };
}

/**
 * Cancel a subscription permanently.
 */
async function cancelSubscription(subscriptionId, userId) {
  const subRef = db.collection('subscriptions').doc(subscriptionId);
  const subDoc = await subRef.get();

  if (!subDoc.exists) throw Object.assign(new Error('Subscription not found'), { statusCode: 404 });
  if (subDoc.data().user_id !== userId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  if (subDoc.data().status === 'cancelled') {
    throw Object.assign(new Error('Subscription is already cancelled'), { statusCode: 400 });
  }

  await subRef.update({
    status: 'cancelled',
    cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Clean up tomorrow overrides
  const tomorrow = dateUtil.tomorrow();
  const overrideSnap = await db
    .collection('next_day_overrides')
    .where('user_id', '==', userId)
    .where('date', '==', tomorrow)
    .get();
  const batch = db.batch();
  overrideSnap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  return { id: subscriptionId, status: 'cancelled' };
}

/**
 * Admin: list subscriptions for an area.
 */
async function listByArea(areaId, { status, page = 1, limit = 20 }) {
  let query = db.collection('subscriptions').where('area_id', '==', areaId);
  if (status) query = query.where('status', '==', status);

  const snap = await query.get();
  const subscriptions = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // Simple pagination (for MVP; Firestore cursor-based pagination is better for production)
  const start = (page - 1) * limit;
  const paged = subscriptions.slice(start, start + limit);

  return { subscriptions: paged, total: subscriptions.length, page, limit };
}

module.exports = {
  createSubscription,
  getActiveSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  listByArea,
};
