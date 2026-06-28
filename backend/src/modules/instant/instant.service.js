const { db, admin } = require('../../config/firebase');
const dateUtil = require('../../utils/date');
const dueService = require('../dues/due.service');
const notificationService = require('../notifications/notification.service');
const { isInstantAvailable, isValidInstantDeliveryCharge } = require('../../utils/validators');

const CART_COLLECTION = 'instant_carts';
const ORDER_COLLECTION = 'instant_orders';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeTotals(items, deliveryCharge) {
  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const charge = Number(deliveryCharge) || 0;
  return {
    items_total: Math.round(itemsTotal * 100) / 100,
    total_amount: Math.round((itemsTotal + charge) * 100) / 100,
  };
}

function emptyCart(userId, areaId) {
  return {
    user_id: userId,
    area_id: areaId,
    items: [],
    delivery_charge: 0,
    items_total: 0,
    total_amount: 0,
  };
}

function cartView(userId, areaId, data) {
  if (!data) return emptyCart(userId, areaId);
  const items = data.items || [];
  const deliveryCharge = Number(data.delivery_charge) || 0;
  return {
    user_id: userId,
    area_id: data.area_id || areaId,
    items,
    delivery_charge: deliveryCharge,
    ...computeTotals(items, deliveryCharge),
  };
}

/**
 * Attach user name/phone/address/location to a list of records that carry user_id.
 * Mirrors the enrichment strategy used by orderService.getAreaOrders.
 */
async function enrichWithUsers(records) {
  const userIds = [...new Set(records.map((r) => r.user_id).filter(Boolean))];
  const userMap = {};
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
          name: d.name || null,
          phone: d.phone || null,
          address: d.address || null,
          location: d.location || null,
        };
      });
    } catch (e) {
      console.error('[instant.enrichWithUsers] doc ID lookup failed:', e.message);
    }
  }

  return records.map((r) => ({
    ...r,
    user_name: userMap[r.user_id]?.name ?? null,
    user_phone: userMap[r.user_id]?.phone ?? null,
    user_address: userMap[r.user_id]?.address ?? null,
    user_location: userMap[r.user_id]?.location ?? null,
  }));
}

// ─── User cart ────────────────────────────────────────────────────────────────

async function getCart(userId, areaId) {
  const snap = await db.collection(CART_COLLECTION).doc(userId).get();
  return cartView(userId, areaId, snap.exists ? snap.data() : null);
}

async function addItem(userId, areaId, { product_id, quantity }) {
  if (!product_id || !quantity || quantity < 1) {
    throw Object.assign(new Error('product_id and quantity (>= 1) are required'), { statusCode: 400 });
  }

  const productDoc = await db.collection('products').doc(product_id).get();
  if (!productDoc.exists || !productDoc.data().is_active) {
    throw Object.assign(new Error('Product not found or inactive'), { statusCode: 400 });
  }
  const product = productDoc.data();
  if (!isInstantAvailable(product.availability)) {
    throw Object.assign(new Error('Product is not available for instant delivery'), { statusCode: 400 });
  }

  const ref = db.collection(CART_COLLECTION).doc(userId);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : null;
  const items = data?.items ? [...data.items] : [];

  const newItem = {
    product_id,
    product_name: product.name,
    quantity,
    unit: product.unit,
    price: product.price,
    total: quantity * product.price,
  };

  const idx = items.findIndex((i) => i.product_id === product_id);
  if (idx >= 0) {
    items[idx].quantity += quantity;
    items[idx].total = items[idx].quantity * items[idx].price;
  } else {
    items.push(newItem);
  }

  const deliveryCharge = Number(data?.delivery_charge) || 0;
  const totals = computeTotals(items, deliveryCharge);

  await ref.set({
    user_id: userId,
    area_id: areaId,
    items,
    delivery_charge: deliveryCharge,
    ...totals,
    created_at: data?.created_at || admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return getCart(userId, areaId);
}

async function updateItem(userId, areaId, { product_id, quantity }) {
  if (!product_id || quantity === undefined) {
    throw Object.assign(new Error('product_id and quantity are required'), { statusCode: 400 });
  }

  const ref = db.collection(CART_COLLECTION).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('No instant cart found'), { statusCode: 404 });

  const data = snap.data();
  const items = [...(data.items || [])];
  const idx = items.findIndex((i) => i.product_id === product_id);
  if (idx === -1) throw Object.assign(new Error('Product not in cart'), { statusCode: 404 });

  if (quantity <= 0) {
    items.splice(idx, 1);
  } else {
    items[idx].quantity = quantity;
    items[idx].total = quantity * items[idx].price;
  }

  const deliveryCharge = Number(data.delivery_charge) || 0;
  await ref.update({
    items,
    ...computeTotals(items, deliveryCharge),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return getCart(userId, areaId);
}

async function removeItem(userId, areaId, productId) {
  const ref = db.collection(CART_COLLECTION).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('No instant cart found'), { statusCode: 404 });

  const data = snap.data();
  const items = (data.items || []).filter((i) => i.product_id !== productId);
  const deliveryCharge = Number(data.delivery_charge) || 0;

  await ref.update({
    items,
    ...computeTotals(items, deliveryCharge),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return getCart(userId, areaId);
}

async function setDeliveryCharge(userId, areaId, deliveryCharge) {
  const charge = Number(deliveryCharge);
  if (!isValidInstantDeliveryCharge(charge)) {
    throw Object.assign(new Error('Invalid delivery charge selection'), { statusCode: 400 });
  }

  const ref = db.collection(CART_COLLECTION).doc(userId);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : null;
  const items = data?.items || [];

  await ref.set({
    user_id: userId,
    area_id: areaId,
    items,
    delivery_charge: charge,
    ...computeTotals(items, charge),
    created_at: data?.created_at || admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return getCart(userId, areaId);
}

async function clearCart(userId, areaId) {
  const ref = db.collection(CART_COLLECTION).doc(userId);
  await ref.set({
    user_id: userId,
    area_id: areaId,
    items: [],
    delivery_charge: 0,
    items_total: 0,
    total_amount: 0,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return getCart(userId, areaId);
}

/**
 * Snapshot the current cart into an instant_orders document, then empty the cart.
 */
async function confirmOrder(userId, areaId) {
  const ref = db.collection(CART_COLLECTION).doc(userId);
  const snap = await ref.get();
  const cart = cartView(userId, areaId, snap.exists ? snap.data() : null);

  if (!cart.items.length) {
    throw Object.assign(new Error('Your instant cart is empty'), { statusCode: 400 });
  }

  const orderData = {
    user_id: userId,
    area_id: areaId,
    order_type: 'instant',
    date: dateUtil.today(),
    items: cart.items,
    items_total: cart.items_total,
    delivery_charge: cart.delivery_charge,
    total_amount: cart.total_amount,
    status: 'pending',
    placed_at: admin.firestore.FieldValue.serverTimestamp(),
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  const orderRef = await db.collection(ORDER_COLLECTION).add(orderData);

  // Empty the cart (keep the doc so it stays "saved" in admin).
  await ref.set({
    user_id: userId,
    area_id: areaId,
    items: [],
    delivery_charge: 0,
    items_total: 0,
    total_amount: 0,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { id: orderRef.id, ...orderData };
}

// ─── User history ───────────────────────────────────────────────────────────

async function getUserOrders(userId, { page = 1, limit = 20 } = {}) {
  const snap = await db.collection(ORDER_COLLECTION).where('user_id', '==', userId).get();
  const orders = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const ta = a.placed_at?.toMillis?.() ?? 0;
      const tb = b.placed_at?.toMillis?.() ?? 0;
      if (tb !== ta) return tb - ta;
      return b.date > a.date ? 1 : -1;
    });

  const start = (page - 1) * limit;
  return { orders: orders.slice(start, start + limit), total: orders.length, page, limit };
}

// ─── Admin ────────────────────────────────────────────────────────────────────

async function getAreaOrders(areaId, { date, status, page = 1, limit = 50 } = {}) {
  let query = db.collection(ORDER_COLLECTION).where('area_id', '==', areaId);
  if (date) query = query.where('date', '==', date);

  const snap = await query.get();
  let orders = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const ta = a.placed_at?.toMillis?.() ?? 0;
      const tb = b.placed_at?.toMillis?.() ?? 0;
      if (tb !== ta) return tb - ta;
      return b.date > a.date ? 1 : -1;
    });

  if (status) {
    orders = orders.filter((o) => (status === 'not_delivered'
      ? (o.status === 'not_delivered' || o.status === 'cancelled')
      : o.status === status));
  }

  const enriched = await enrichWithUsers(orders);
  const start = (page - 1) * limit;
  return { orders: enriched.slice(start, start + limit), total: enriched.length, page, limit };
}

async function getAreaCarts(areaId) {
  const snap = await db.collection(CART_COLLECTION).where('area_id', '==', areaId).get();
  const carts = snap.docs
    .map((doc) => ({ id: doc.id, ...cartView(doc.id, areaId, doc.data()) }))
    .filter((cart) => cart.items.length > 0)
    .sort((a, b) => b.total_amount - a.total_amount);

  return { carts: await enrichWithUsers(carts), total: carts.length };
}

/**
 * Admin marks an instant order delivered/cancelled.
 * On delivered the value (incl. delivery charge) is added to the user's due balance.
 * Mirrors orderService.updateOrderStatus.
 */
async function updateOrderStatus(orderId, areaId, newStatus) {
  const validStatuses = ['delivered', 'cancelled'];
  if (!validStatuses.includes(newStatus)) {
    throw Object.assign(new Error('Invalid status. Must be delivered or cancelled'), { statusCode: 400 });
  }

  const orderRef = db.collection(ORDER_COLLECTION).doc(orderId);
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
        {
          date: deliveredOrder.date,
          milk: null,
          extra_items: (deliveredOrder.items || []).map((i) => ({ ...i, name: i.product_name })),
          total_amount: deliveredOrder.total_amount,
        },
        updatedDue.due_amount,
      );
    } catch (notifErr) {
      console.error('[instant.updateOrderStatus] delivery notification failed:', notifErr.message);
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
      console.error('[instant.updateOrderStatus] cancellation notification failed:', notifErr.message);
    }
  }

  return { id: orderId, status: newStatus };
}

/**
 * Per-day instant order summary for a user/month — feeds the purple calendar markers.
 */
async function getUserInstantCalendar(userId, startDate, endDate) {
  const snap = await db.collection(ORDER_COLLECTION).where('user_id', '==', userId).get();
  const instant = {};

  for (const doc of snap.docs) {
    const o = doc.data();
    if (!o.date || o.date < startDate || o.date >= endDate) continue;
    const status = o.status === 'cancelled' ? 'not_delivered' : o.status;

    if (!instant[o.date]) {
      instant[o.date] = {
        count: 0,
        total_amount: 0,
        delivered: 0,
        pending: 0,
        not_delivered: 0,
        orders: [],
      };
    }
    const day = instant[o.date];
    day.count += 1;
    if (status === 'delivered') day.total_amount += Number(o.total_amount) || 0;
    day[status] = (day[status] || 0) + 1;
    day.orders.push({
      id: doc.id,
      status,
      total_amount: o.total_amount || 0,
      delivery_charge: o.delivery_charge || 0,
      items: o.items || [],
      placed_at: o.placed_at ? dateUtil.formatTimestamp(o.placed_at) : null,
    });
  }

  return instant;
}

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  setDeliveryCharge,
  clearCart,
  confirmOrder,
  getUserOrders,
  getAreaOrders,
  getAreaCarts,
  updateOrderStatus,
  getUserInstantCalendar,
};
