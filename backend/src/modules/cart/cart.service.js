const { db, admin } = require('../../config/firebase');
const manifestSettings = require('../settings/manifestSettings.service');
const orderService = require('../orders/order.service');

const REQUEST_RECORD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

/**
 * Carts created from here on use a deterministic id, so a customer and an
 * admin adding items at the same moment contend on one document instead of
 * each creating a separate cart for the same date (the nightly job only reads
 * one of them, silently dropping the other's items).
 */
function cartDocRef(userId, date) {
  return db.collection('carts').doc(`${encodeURIComponent(userId)}_${date}`);
}

/**
 * Same id scheme as orderService.createOrder.
 */
function orderDocRef(areaId, date, userId) {
  const orderId = ['delivery', areaId, date, userId].map((part) => encodeURIComponent(part)).join('_');
  return db.collection('orders').doc(orderId);
}

/**
 * Read-modify-write a user's cart for `date` inside one transaction.
 *
 * `mutator(items)` receives a copy of the current items and returns the next
 * items array (it may throw an httpError to abort). Guarantees:
 *   - no lost updates between concurrent writers (customer app + admin panel);
 *   - a delivery that is already finalized (delivered / cancelled) for this
 *     date can never be edited;
 *   - when the nightly job has already materialised a pending order for this
 *     date, the order's extras and total are kept in step with the cart.
 *   - with `requestId`, a replayed request (double click, network retry) is
 *     applied exactly once.
 *
 * Returns { items, previousItems, duplicate }.
 */
async function mutateCart(userId, areaId, date, mutator, { requestId = null, requestMeta = {} } = {}) {
  const deterministicRef = cartDocRef(userId, date);
  const legacyQuery = db
    .collection('carts')
    .where('user_id', '==', userId)
    .where('date', '==', date)
    .limit(1);
  const orderRef = orderDocRef(areaId, date, userId);
  const requestRef = requestId ? db.collection('admin_requests').doc(requestId) : null;

  let result = null;

  await db.runTransaction(async (tx) => {
    result = null;

    const reads = [tx.get(deterministicRef), tx.get(legacyQuery), tx.get(orderRef)];
    if (requestRef) reads.push(tx.get(requestRef));
    const [deterministicDoc, legacySnap, orderDoc, requestDoc] = await Promise.all(reads);

    if (requestDoc && requestDoc.exists) {
      const previous = requestDoc.data();
      result = { items: previous.items || [], previousItems: previous.previous_items || [], duplicate: true };
      return;
    }

    if (orderDoc.exists && orderDoc.data().status !== 'pending') {
      throw httpError(`The delivery for ${date} is already finalized and can no longer be changed`, 409);
    }

    let cartRef = null;
    let currentItems = [];
    if (deterministicDoc.exists) {
      cartRef = deterministicRef;
      currentItems = deterministicDoc.data().items || [];
    } else if (!legacySnap.empty) {
      cartRef = legacySnap.docs[0].ref;
      currentItems = legacySnap.docs[0].data().items || [];
    }

    const previousItems = currentItems.map((item) => ({ ...item }));
    const nextItems = mutator(currentItems.map((item) => ({ ...item })));

    if (cartRef) {
      tx.update(cartRef, {
        items: nextItems,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (nextItems.length > 0) {
      tx.set(deterministicRef, {
        user_id: userId,
        area_id: areaId,
        date,
        items: nextItems,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (orderDoc.exists) {
      const order = orderDoc.data();
      tx.update(orderRef, {
        extra_items: nextItems,
        total_amount: orderService.orderTotal(order.milk, nextItems),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (requestRef) {
      tx.create(requestRef, {
        kind: 'cart',
        user_id: userId,
        date,
        items: nextItems,
        previous_items: previousItems,
        ...requestMeta,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        // Replay protection only needs to outlive client retries; a Firestore
        // TTL policy on this field can purge old records.
        expires_at: new Date(Date.now() + REQUEST_RECORD_TTL_MS),
      });
    }

    result = { items: nextItems, previousItems, duplicate: false };
  });

  return result;
}

/**
 * Load a product and assert it can be ordered for a scheduled delivery.
 */
async function loadOrderableProduct(productId) {
  const productDoc = await db.collection('products').doc(productId).get();
  if (!productDoc.exists || !productDoc.data().is_active) {
    throw httpError('Product not found or inactive', 400);
  }
  const product = productDoc.data();
  if ((product.availability || 'scheduled') === 'instant') {
    throw httpError(`${product.name} is only available in the instant store`, 400);
  }
  return { id: productDoc.id, ...product };
}

function lineItem(product, quantity, extra = {}) {
  return {
    product_id: product.id,
    product_name: product.name,
    quantity,
    unit: product.unit,
    price: product.price,
    total: quantity * product.price,
    ...extra,
  };
}

/**
 * Add an extra product to the target date cart (cartTargetDate — day-after-tomorrow if past cutoff).
 */
async function addItem(userId, areaId, { product_id, quantity }) {
  if (!product_id || !quantity || quantity < 1) {
    throw httpError('product_id and quantity (>= 1) are required', 400);
  }

  const product = await loadOrderableProduct(product_id);
  const targetDate = await manifestSettings.getCartTargetDate(areaId);

  await mutateCart(userId, areaId, targetDate, (items) => {
    const existing = items.find((i) => i.product_id === product_id);
    if (existing) {
      existing.quantity += quantity;
      existing.total = existing.quantity * existing.price;
      return items;
    }
    return [...items, lineItem(product, quantity)];
  });

  return { message: 'Item added to cart' };
}

/**
 * Update quantity of an extra product in the target date cart.
 */
async function updateItem(userId, areaId, { product_id, quantity }) {
  if (!product_id || quantity === undefined) {
    throw httpError('product_id and quantity are required', 400);
  }

  const targetDate = await manifestSettings.getCartTargetDate(areaId);

  await mutateCart(userId, areaId, targetDate, (items) => {
    if (items.length === 0) throw httpError('No cart found for target date', 404);
    const idx = items.findIndex((i) => i.product_id === product_id);
    if (idx === -1) throw httpError('Product not in cart', 404);

    if (quantity <= 0) {
      items.splice(idx, 1);
    } else {
      items[idx].quantity = quantity;
      items[idx].total = quantity * items[idx].price;
    }
    return items;
  });

  return { message: 'Cart updated' };
}

/**
 * Remove an extra product from the target date cart.
 */
async function removeItem(userId, areaId, productId) {
  const targetDate = await manifestSettings.getCartTargetDate(areaId);

  await mutateCart(userId, areaId, targetDate, (items) => {
    if (items.length === 0) throw httpError('No cart found for target date', 404);
    return items.filter((i) => i.product_id !== productId);
  });

  return { message: 'Item removed from cart' };
}

module.exports = { addItem, updateItem, removeItem, mutateCart, loadOrderableProduct, lineItem };
