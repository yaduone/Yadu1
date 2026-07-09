const { db, admin } = require('../../config/firebase');
const dateUtil = require('../../utils/date');
const notificationService = require('../notifications/notification.service');
const cartCharges = require('../settings/cartCharges.service');
const instantHours = require('../settings/instantHours.service');
const { isInstantAvailable, isValidInstantDeliveryCharge } = require('../../utils/validators');

const CART_COLLECTION = 'instant_carts';
const ORDER_COLLECTION = 'instant_orders';
const PAYMENT_MODE = 'cod'; // Instant deliveries are always settled cash-on-delivery.

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Admin-configured extra charges (platform fee, QA fees, …) for instant delivery.
async function getInstantCharges() {
  try {
    return await cartCharges.getChargesForType('instant');
  } catch (_) {
    return [];
  }
}

function chargesTotal(charges) {
  return (charges || []).reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
}

function computeTotals(items, deliveryCharge, extraChargesTotal = 0) {
  const itemsTotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const charge = Number(deliveryCharge) || 0;
  const extra = Number(extraChargesTotal) || 0;
  return {
    items_total: Math.round(itemsTotal * 100) / 100,
    total_amount: Math.round((itemsTotal + charge + extra) * 100) / 100,
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

async function cartView(userId, areaId, data) {
  const charges = await getInstantCharges();
  const extraTotal = chargesTotal(charges);
  const availability = await instantHours.checkAvailability();
  if (!data) {
    return {
      ...emptyCart(userId, areaId),
      extra_charges: charges,
      extra_charges_total: extraTotal,
      payment_mode: PAYMENT_MODE,
      availability,
    };
  }
  const items = data.items || [];
  const deliveryCharge = Number(data.delivery_charge) || 0;
  return {
    user_id: userId,
    area_id: data.area_id || areaId,
    items,
    delivery_charge: deliveryCharge,
    extra_charges: charges,
    extra_charges_total: Math.round(extraTotal * 100) / 100,
    payment_mode: PAYMENT_MODE,
    availability,
    ...computeTotals(items, deliveryCharge, extraTotal),
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


function availabilityError(availability) {
  const { hours } = availability;
  const message = availability.reason === 'closed'
    ? 'Instant delivery is currently unavailable. Please check back later.'
    : `Instant delivery is available between ${hours.start_time} and ${hours.end_time}. Please try again during that window.`;
  return Object.assign(new Error(message), { statusCode: 400, code: 'INSTANT_UNAVAILABLE', hours });
}

async function addItem(userId, areaId, { product_id, quantity }) {
  if (!product_id || !quantity || quantity < 1) {
    throw Object.assign(new Error('product_id and quantity (>= 1) are required'), { statusCode: 400 });
  }

  const availability = await instantHours.checkAvailability();
  if (!availability.available) throw availabilityError(availability);

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
  const availability = await instantHours.checkAvailability();
  if (!availability.available) throw availabilityError(availability);

  const ref = db.collection(CART_COLLECTION).doc(userId);
  const snap = await ref.get();
  const cart = await cartView(userId, areaId, snap.exists ? snap.data() : null);

  if (!cart.items.length) {
    throw Object.assign(new Error('Your instant cart is empty'), { statusCode: 400 });
  }

  // Re-validate each product is still active & instant-available — catches items
  // an admin disabled/removed while they sat in the customer's persistent cart.
  const productDocs = await db.getAll(
    ...cart.items.map((item) => db.collection('products').doc(item.product_id))
  );
  const unavailable = productDocs.filter((doc) => {
    const p = doc.exists ? doc.data() : null;
    return !p || !p.is_active || !isInstantAvailable(p.availability);
  });
  if (unavailable.length) {
    const names = cart.items
      .filter((item) => unavailable.some((d) => d.id === item.product_id))
      .map((item) => item.product_name)
      .join(', ');
    throw Object.assign(
      new Error(`Some items are no longer available for instant delivery: ${names}. Please remove them and try again.`),
      { statusCode: 400 }
    );
  }

  const orderData = {
    user_id: userId,
    area_id: areaId,
    order_type: 'instant',
    payment_mode: PAYMENT_MODE,
    date: dateUtil.today(),
    items: cart.items,
    items_total: cart.items_total,
    delivery_charge: cart.delivery_charge,
    extra_charges: cart.extra_charges || [],
    extra_charges_total: cart.extra_charges_total || 0,
    total_amount: cart.total_amount,
    status: 'pending',
    eta_minutes: availability.hours.eta_minutes,
    acknowledged_at: null,
    expected_delivery_by: null,
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

  notificationService.sendAdminInstantOrderNotification(areaId, {
    orderId: orderRef.id,
    userId,
    totalAmount: cart.total_amount,
  });

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

  const enriched = (await enrichWithUsers(orders)).map((o) => ({
    ...o,
    // Flag orders acknowledged past their promised ETA so admins can spot delays.
    is_overdue: o.status === 'acknowledged' && o.expected_delivery_by
      ? new Date(o.expected_delivery_by).getTime() < Date.now()
      : false,
  }));
  const start = (page - 1) * limit;
  return { orders: enriched.slice(start, start + limit), total: enriched.length, page, limit };
}

async function getAreaCarts(areaId) {
  const snap = await db.collection(CART_COLLECTION).where('area_id', '==', areaId).get();
  const carts = (await Promise.all(
    snap.docs.map(async (doc) => ({ id: doc.id, ...(await cartView(doc.id, areaId, doc.data())) }))
  ))
    .filter((cart) => cart.items.length > 0)
    .sort((a, b) => b.total_amount - a.total_amount);

  return { carts: await enrichWithUsers(carts), total: carts.length };
}

/**
 * Admin acknowledges a pending instant order — the customer-facing signal that
 * "your order is on the way and will be delivered within N minutes." This is
 * step 1 of the admin's two-step flow (acknowledge, then mark delivered).
 */
async function acknowledgeOrder(orderId, areaId) {
  const orderRef = db.collection(ORDER_COLLECTION).doc(orderId);
  let acknowledgedOrder = null;
  let expectedDeliveryBy = null;

  await db.runTransaction(async (tx) => {
    const orderDoc = await tx.get(orderRef);
    if (!orderDoc.exists) throw Object.assign(new Error('Order not found'), { statusCode: 404 });

    const order = orderDoc.data();
    if (order.area_id !== areaId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    if (order.status !== 'pending') {
      throw Object.assign(new Error('Only pending orders can be acknowledged'), { statusCode: 400 });
    }

    const etaMinutes = Number(order.eta_minutes) || instantHours.DEFAULTS.eta_minutes;
    expectedDeliveryBy = dateUtil.now().add(etaMinutes, 'minutes').toISOString();
    acknowledgedOrder = order;

    tx.update(orderRef, {
      status: 'acknowledged',
      acknowledged_at: admin.firestore.FieldValue.serverTimestamp(),
      expected_delivery_by: expectedDeliveryBy,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  if (acknowledgedOrder) {
    try {
      await notificationService.sendInstantOrderAcknowledgedNotification(
        acknowledgedOrder.user_id,
        acknowledgedOrder.area_id,
        { orderId, etaMinutes: acknowledgedOrder.eta_minutes || instantHours.DEFAULTS.eta_minutes }
      );
    } catch (notifErr) {
      console.error('[instant.acknowledgeOrder] notification failed:', notifErr.message);
    }
  }

  return { id: orderId, status: 'acknowledged', expected_delivery_by: expectedDeliveryBy };
}

/**
 * Admin marks an acknowledged instant order delivered, or cancels a pending/
 * acknowledged one. Instant orders are settled cash-on-delivery, so unlike
 * subscription orders, marking one delivered does NOT add the order amount to
 * the user's due balance.
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
    if (order.status !== 'pending' && order.status !== 'acknowledged') {
      throw Object.assign(new Error('Finalized orders cannot be changed'), { statusCode: 400 });
    }
    if (newStatus === 'delivered' && order.status !== 'acknowledged') {
      throw Object.assign(new Error('Order must be acknowledged before it can be marked delivered'), { statusCode: 400 });
    }

    if (newStatus === 'delivered') {
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
      await notificationService.sendCodDeliveryNotification(
        deliveredOrder.user_id,
        deliveredOrder.area_id,
        {
          date: deliveredOrder.date,
          extra_items: (deliveredOrder.items || []).map((i) => ({ ...i, name: i.product_name })),
          total_amount: deliveredOrder.total_amount,
        },
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
    const status = o.status === 'cancelled' ? 'not_delivered' : (o.status === 'acknowledged' ? 'pending' : o.status);

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
  acknowledgeOrder,
  updateOrderStatus,
  getUserInstantCalendar,
};
