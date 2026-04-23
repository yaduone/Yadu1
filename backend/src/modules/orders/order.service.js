const { db, admin } = require('../../config/firebase');
const dueService = require('../dues/due.service');

/**
 * Create an order from subscription + cart data (called by nightly job).
 */
async function createOrder({ userId, areaId, date, milk, deliverySlot, extraItems, totalAmount }) {
  const orderData = {
    user_id: userId,
    area_id: areaId,
    date,
    delivery_slot: deliverySlot || 'morning',
    milk: milk || null,
    extra_items: extraItems || [],
    total_amount: totalAmount,
    status: 'pending',
    notes: null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const docRef = await db.collection('orders').add(orderData);
  return { id: docRef.id, ...orderData };
}

/**
 * Get order history for a user.
 */
async function getUserOrders(userId, { page = 1, limit = 20, month }) {
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
  const doc = await db.collection('orders').doc(orderId).get();
  if (!doc.exists || doc.data().user_id !== userId) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Admin: list orders for area.
 */
async function getAreaOrders(areaId, { date, status, page = 1, limit = 50 }) {
  let query = db.collection('orders').where('area_id', '==', areaId);
  if (date) query = query.where('date', '==', date);
  if (status) query = query.where('status', '==', status);

  const snap = await query.get();
  const orders = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  const start = (page - 1) * limit;
  return { orders: orders.slice(start, start + limit), total: orders.length, page, limit };
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
  const orderDoc = await orderRef.get();

  if (!orderDoc.exists) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (orderDoc.data().area_id !== areaId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });

  await orderRef.update({
    status: newStatus,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // When delivered: add order total to user's due amount
  if (newStatus === 'delivered') {
    const order = orderDoc.data();
    await dueService.incrementDue(order.user_id, order.area_id, order.total_amount);
  }

  return { id: orderId, status: newStatus };
}

module.exports = { createOrder, getUserOrders, getOrderById, getAreaOrders, updateOrderStatus };
