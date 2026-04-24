const { db, admin } = require('../../config/firebase');
const dateUtil = require('../../utils/date');

/**
 * Add an extra product to the target date cart (cartTargetDate — day-after-tomorrow if past cutoff).
 */
async function addItem(userId, areaId, { product_id, quantity }) {
  if (!product_id || !quantity || quantity < 1) {
    throw Object.assign(new Error('product_id and quantity (>= 1) are required'), { statusCode: 400 });
  }

  // Verify product exists and is active
  const productDoc = await db.collection('products').doc(product_id).get();
  if (!productDoc.exists || !productDoc.data().is_active) {
    throw Object.assign(new Error('Product not found or inactive'), { statusCode: 400 });
  }

  const product = productDoc.data();
  const targetDate = dateUtil.cartTargetDate();

  const cartSnap = await db
    .collection('carts')
    .where('user_id', '==', userId)
    .where('date', '==', targetDate)
    .limit(1)
    .get();

  const newItem = {
    product_id,
    product_name: product.name,
    quantity,
    unit: product.unit,
    price: product.price,
    total: quantity * product.price,
  };

  if (cartSnap.empty) {
    await db.collection('carts').add({
      user_id: userId,
      area_id: areaId,
      date: targetDate,
      items: [newItem],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    const cartDoc = cartSnap.docs[0];
    const items = cartDoc.data().items || [];

    const existingIdx = items.findIndex((i) => i.product_id === product_id);
    if (existingIdx >= 0) {
      items[existingIdx].quantity += quantity;
      items[existingIdx].total = items[existingIdx].quantity * items[existingIdx].price;
    } else {
      items.push(newItem);
    }

    await cartDoc.ref.update({
      items,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { message: 'Item added to cart' };
}

/**
 * Update quantity of an extra product in the target date cart.
 */
async function updateItem(userId, { product_id, quantity }) {
  if (!product_id || quantity === undefined) {
    throw Object.assign(new Error('product_id and quantity are required'), { statusCode: 400 });
  }

  const targetDate = dateUtil.cartTargetDate();

  const cartSnap = await db
    .collection('carts')
    .where('user_id', '==', userId)
    .where('date', '==', targetDate)
    .limit(1)
    .get();

  if (cartSnap.empty) {
    throw Object.assign(new Error('No cart found for target date'), { statusCode: 404 });
  }

  const cartDoc = cartSnap.docs[0];
  let items = cartDoc.data().items || [];

  const idx = items.findIndex((i) => i.product_id === product_id);
  if (idx === -1) {
    throw Object.assign(new Error('Product not in cart'), { statusCode: 404 });
  }

  if (quantity <= 0) {
    items.splice(idx, 1);
  } else {
    items[idx].quantity = quantity;
    items[idx].total = quantity * items[idx].price;
  }

  await cartDoc.ref.update({
    items,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { message: 'Cart updated' };
}

/**
 * Remove an extra product from the target date cart.
 */
async function removeItem(userId, productId) {
  const targetDate = dateUtil.cartTargetDate();

  const cartSnap = await db
    .collection('carts')
    .where('user_id', '==', userId)
    .where('date', '==', targetDate)
    .limit(1)
    .get();

  if (cartSnap.empty) {
    throw Object.assign(new Error('No cart found for target date'), { statusCode: 404 });
  }

  const cartDoc = cartSnap.docs[0];
  const items = (cartDoc.data().items || []).filter((i) => i.product_id !== productId);

  await cartDoc.ref.update({
    items,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { message: 'Item removed from cart' };
}

module.exports = { addItem, updateItem, removeItem };
