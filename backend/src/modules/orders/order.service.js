const { db, admin } = require('../../config/firebase');
const dueService = require('../dues/due.service');
const notificationService = require('../notifications/notification.service');
const dateUtil = require('../../utils/date');

/**
 * Create an order from subscription + cart data (called by nightly job).
 */
async function createOrder({
  userId,
  areaId,
  date,
  milk,
  deliverySlot,
  extraItems,
  totalAmount,
  status = 'pending',
  nonDeliveryReason = null,
}) {
  const orderData = {
    user_id: userId,
    area_id: areaId,
    date,
    delivery_slot: deliverySlot || 'morning',
    milk: milk || null,
    extra_items: extraItems || [],
    total_amount: totalAmount,
    status,
    non_delivery_reason: nonDeliveryReason,
    notes: null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const orderId = ['delivery', areaId, date, userId].map((part) => encodeURIComponent(part)).join('_');
  const docRef = db.collection('orders').doc(orderId);
  let created = false;
  let savedOrder = orderData;

  await db.runTransaction(async (tx) => {
    created = false;
    const existing = await tx.get(docRef);
    if (existing.exists) {
      savedOrder = existing.data();
      return;
    }
    tx.create(docRef, orderData);
    created = true;
  });

  return { id: docRef.id, ...savedOrder, created };
}

/**
 * Persist the outcome of generated deliveries that were never marked delivered.
 * Today's orders remain pending so admins can record delivery through the day.
 */
async function markPastPendingOrdersNotDelivered({ userId, areaId } = {}) {
  let query = db.collection('orders');
  if (userId) {
    query = query.where('user_id', '==', userId);
  } else if (areaId) {
    query = query.where('area_id', '==', areaId);
  } else {
    query = query.where('status', '==', 'pending');
  }

  const snap = await query.get();
  const today = dateUtil.today();
  const missedDocs = snap.docs.filter((doc) => {
    const order = doc.data();
    return order.status === 'pending' && order.date && order.date < today;
  });

  for (let i = 0; i < missedDocs.length; i += 450) {
    const batch = db.batch();
    missedDocs.slice(i, i + 450).forEach((doc) => {
      batch.update(doc.ref, {
        status: 'not_delivered',
        non_delivery_reason: 'not_marked_delivered',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return missedDocs.length;
}

function extrasTotal(extraItems = []) {
  return extraItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
}

function orderTotal(milk, extraItems = []) {
  return (Number(milk?.total) || 0) + extrasTotal(extraItems);
}

function equalExtraItems(existing = [], next = []) {
  return JSON.stringify(existing) === JSON.stringify(next);
}

/**
 * Synchronize a cart snapshot into a generated order that has not been delivered yet.
 * This is intentionally extras-only: subscription overrides may already have been consumed.
 */
async function syncPendingOrderExtras(orderDoc, extraItems = []) {
  const order = orderDoc.data();
  if (order.status !== 'pending') {
    return { updated: false, reason: 'finalized' };
  }

  const nextItems = Array.isArray(extraItems) ? extraItems : [];
  const nextTotal = orderTotal(order.milk, nextItems);
  if (equalExtraItems(order.extra_items || [], nextItems) && Number(order.total_amount) === nextTotal) {
    return { updated: false, reason: 'unchanged' };
  }

  await orderDoc.ref.update({
    extra_items: nextItems,
    total_amount: nextTotal,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { updated: true, reason: 'cart_reconciled', total_amount: nextTotal };
}

/**
 * Get order history for a user.
 */
async function getUserOrders(userId, { page = 1, limit = 20, month }) {
  await markPastPendingOrdersNotDelivered({ userId });

  let query = db.collection('orders').where('user_id', '==', userId);

  if (month) {
    // month format: YYYY-MM
    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const nextMon = mon === 12 ? 1 : mon + 1;
    const nextYear = mon === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMon).padStart(2, '0')}-01`;
    query = query.where('date', '>=', startDate).where('date', '<', endDate);
  }

  const snap = await query.get();
  const orders = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  const start = (page - 1) * limit;
  return { orders: orders.slice(start, start + limit), total: orders.length, page, limit };
}

/**
 * Get single order by ID (for user).
 */
async function getOrderById(orderId, userId) {
  await markPastPendingOrdersNotDelivered({ userId });

  const doc = await db.collection('orders').doc(orderId).get();
  if (!doc.exists || doc.data().user_id !== userId) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Admin: list orders for area, enriched with user name and address.
 */
async function getAreaOrders(areaId, { date, status, page = 1, limit = 50 }) {
  await markPastPendingOrdersNotDelivered({ areaId });

  let query = db.collection('orders').where('area_id', '==', areaId);
  if (date) query = query.where('date', '==', date);

  const snap = await query.get();
  let orders = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  if (status) {
    orders = orders.filter((order) => {
      if (status === 'not_delivered') {
        return order.status === 'not_delivered' ||
          order.status === 'cancelled' ||
          order.status === 'skipped';
      }
      return order.status === status;
    });
  }

  // Collect unique user IDs and fetch their profiles
  const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))];
  const userMap = {};

  if (userIds.length > 0) {
    // Strategy 1: fetch by Firestore document ID (most common case)
    const chunkSize = 30;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      try {
        const usersSnap = await db.collection('users')
          .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
          .get();
        usersSnap.docs.forEach((doc) => {
          const d = doc.data();
          userMap[doc.id] = {
            name:    d.name    || null,
            phone:   d.phone   || null,
            address: d.address || null,
          };
        });
      } catch (e) {
        console.error('[getAreaOrders] doc ID lookup failed:', e.message);
      }
    }

    // Strategy 2: for any user_id that didn't resolve, try firebase_uid field
    const missing = userIds.filter((id) => !userMap[id]);
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
      try {
        const usersSnap = await db.collection('users')
          .where('firebase_uid', 'in', chunk)
          .get();
        usersSnap.docs.forEach((doc) => {
          const d = doc.data();
          // Map both the firebase_uid and the doc ID so either lookup works
          const entry = { name: d.name || null, phone: d.phone || null, address: d.address || null };
          userMap[d.firebase_uid] = entry;
          userMap[doc.id] = entry;
        });
      } catch (e) {
        console.error('[getAreaOrders] firebase_uid lookup failed:', e.message);
      }
    }
  }

  // Attach user info to each order
  const enriched = orders.map((o) => ({
    ...o,
    user_name:    userMap[o.user_id]?.name    ?? null,
    user_phone:   userMap[o.user_id]?.phone   ?? null,
    user_address: userMap[o.user_id]?.address ?? null,
  }));

  const start = (page - 1) * limit;
  return { orders: enriched.slice(start, start + limit), total: enriched.length, page, limit };
}

/**
 * Admin: update order status.
 */
async function updateOrderStatus(orderId, areaId, newStatus) {
  const validStatuses = ['delivered', 'cancelled'];
  if (!validStatuses.includes(newStatus)) {
    throw Object.assign(new Error('Invalid status. Must be delivered or cancelled'), { statusCode: 400 });
  }

  const orderRef = db.collection('orders').doc(orderId);
  let deliveredOrder = null;
  let cancelledOrder = null;

  await db.runTransaction(async (tx) => {
    deliveredOrder = null;
    cancelledOrder = null;
    const orderDoc = await tx.get(orderRef);
    if (!orderDoc.exists) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

    const order = orderDoc.data();
    if (order.area_id !== areaId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    if (newStatus === order.status) return;
    if (order.status !== 'pending') {
      throw Object.assign(new Error('Finalized orders cannot be changed'), { statusCode: 400 });
    }
    if (newStatus === 'delivered' && order.date > dateUtil.today()) {
      throw Object.assign(new Error('Orders can only be marked delivered on or after the delivery date'), { statusCode: 400 });
    }

    if (newStatus === 'delivered') {
      await dueService.incrementDueInTransaction(tx, order.user_id, order.area_id, order.total_amount);
      deliveredOrder = order;
    }
    if (newStatus === 'cancelled') {
      cancelledOrder = order;
    }

    tx.update(orderRef, {
      status: newStatus,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  if (deliveredOrder) {
    try {
      const updatedDue = await dueService.getUserDue(deliveredOrder.user_id);
      await notificationService.sendDeliveryNotification(
        deliveredOrder.user_id,
        deliveredOrder.area_id,
        deliveredOrder,
        updatedDue.due_amount,
      );
    } catch (notifErr) {
      // Notifications are non-critical after the billing transaction commits.
      console.error('[updateOrderStatus] delivery notification failed:', notifErr.message);
    }
  }

  if (cancelledOrder) {
    try {
      await notificationService.sendOrderCancelledNotification(
        cancelledOrder.user_id,
        cancelledOrder.area_id,
        { date: cancelledOrder.date, amount: cancelledOrder.total_amount || 0 },
      );
    } catch (notifErr) {
      console.error('[updateOrderStatus] cancellation notification failed:', notifErr.message);
    }
  }

  return { id: orderId, status: newStatus };
}

module.exports = {
  createOrder,
  markPastPendingOrdersNotDelivered,
  extrasTotal,
  orderTotal,
  syncPendingOrderExtras,
  getUserOrders,
  getOrderById,
  getAreaOrders,
  updateOrderStatus,
};
