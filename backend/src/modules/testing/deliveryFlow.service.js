const { db, admin } = require('../../config/firebase');
const dateUtil = require('../../utils/date');
const manifestSettings = require('../settings/manifestSettings.service');
const manifestService = require('../manifests/manifest.service');
const orderService = require('../orders/order.service');
const { isValidQuantity } = require('../../utils/validators');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function requireDate(date) {
  if (!date || !DATE_RE.test(date)) {
    throw Object.assign(new Error('date must be in YYYY-MM-DD format'), { statusCode: 400 });
  }
  return date;
}

function itemUnits(items = []) {
  return items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

function itemAmount(items = []) {
  return items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
}

function amountEqual(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.01;
}

async function getUsersById(userIds) {
  const userMap = {};
  const distinct = [...new Set(userIds.filter(Boolean))];
  for (let index = 0; index < distinct.length; index += 30) {
    const chunk = distinct.slice(index, index + 30);
    const snap = await db
      .collection('users')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();
    snap.docs.forEach((doc) => {
      userMap[doc.id] = doc.data();
    });
  }
  return userMap;
}

function generatedExpected(date, settings) {
  if (date <= dateUtil.today()) return true;
  if (date === dateUtil.tomorrow()) return manifestSettings.isAtOrPast(settings.generation_time);
  return false;
}

async function inspectDeliveryFlow(areaId, deliveryDate) {
  const date = requireDate(deliveryDate);
  const settings = await manifestSettings.getAreaManifestSettings(areaId);
  const shouldBeGenerated = generatedExpected(date, settings);

  const [productsSnap, cartsSnap, ordersSnap, manifestsSnap] = await Promise.all([
    db.collection('products').where('is_active', '==', true).get(),
    db.collection('carts').where('area_id', '==', areaId).where('date', '==', date).get(),
    db.collection('orders').where('area_id', '==', areaId).where('date', '==', date).get(),
    db.collection('manifests').where('area_id', '==', areaId).where('date', '==', date).limit(1).get(),
  ]);

  const cartsByUser = new Map();
  cartsSnap.docs.forEach((doc) => {
    const cart = doc.data();
    cartsByUser.set(cart.user_id, { id: doc.id, ...cart, items: cart.items || [] });
  });

  const ordersByUser = new Map();
  const orders = ordersSnap.docs.map((doc) => {
    const order = { id: doc.id, ...doc.data(), extra_items: doc.data().extra_items || [] };
    ordersByUser.set(order.user_id, order);
    return order;
  });

  const userIds = [...new Set([...cartsByUser.keys(), ...ordersByUser.keys()])];
  const users = await getUsersById(userIds);
  const rows = userIds.map((userId) => {
    const cart = cartsByUser.get(userId);
    const order = ordersByUser.get(userId);
    const cartUnits = itemUnits(cart?.items);
    const orderUnits = itemUnits(order?.extra_items);
    let state = 'no_extras';

    if (cartUnits > 0 && !order) state = shouldBeGenerated ? 'missing_order' : 'awaiting_generation';
    else if (cart && order && (cartUnits !== orderUnits || !amountEqual(itemAmount(cart.items), itemAmount(order.extra_items)))) {
      state = 'extras_mismatch';
    } else if (orderUnits > 0) state = 'captured';

    return {
      user_id: userId,
      user_name: users[userId]?.name || users[userId]?.phone || 'Unknown user',
      cart_units: cartUnits,
      cart_amount: itemAmount(cart?.items),
      order_id: order?.id || null,
      order_status: order?.status || null,
      order_extra_units: orderUnits,
      order_extra_amount: itemAmount(order?.extra_items),
      state,
    };
  });

  const totals = {
    cart_count: cartsSnap.size,
    cart_extra_units: Array.from(cartsByUser.values()).reduce((sum, cart) => sum + itemUnits(cart.items), 0),
    cart_extra_amount: Array.from(cartsByUser.values()).reduce((sum, cart) => sum + itemAmount(cart.items), 0),
    order_count: orders.length,
    product_order_count: orders.filter((order) => order.extra_items.length > 0).length,
    order_extra_units: orders.reduce((sum, order) => sum + itemUnits(order.extra_items), 0),
    order_extra_amount: orders.reduce((sum, order) => sum + itemAmount(order.extra_items), 0),
    order_amount: orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0),
    delivered_count: orders.filter((order) => order.status === 'delivered').length,
    pending_count: orders.filter((order) => order.status === 'pending').length,
    duplicate_order_count: orders.length - ordersByUser.size,
  };

  const deliveredOrders = orders.filter((order) => order.status === 'delivered');
  const deliveredByUser = new Map();
  deliveredOrders.forEach((order) => {
    deliveredByUser.set(
      order.user_id,
      (deliveredByUser.get(order.user_id) || 0) + (Number(order.total_amount) || 0)
    );
  });
  const dueSnapshots = deliveredByUser.size
    ? await db.getAll(...[...deliveredByUser.keys()]
      .map((userId) => db.collection('due_amounts').doc(userId)))
    : [];
  const dueByUser = new Map(dueSnapshots.map((doc) => [doc.id, doc.exists ? doc.data() : null]));
  const dueMissing = [...deliveredByUser.keys()].filter((userId) => !dueByUser.get(userId));
  const dueBelowDelivery = [...deliveredByUser.entries()].filter(([userId, deliveryTotal]) => {
    const due = dueByUser.get(userId);
    return due && (Number(due.total_billed) || 0) + 0.001 < deliveryTotal;
  });

  const manifest = manifestsSnap.empty ? null : { id: manifestsSnap.docs[0].id, ...manifestsSnap.docs[0].data() };
  const mismatchCount = rows.filter((row) => row.state === 'extras_mismatch').length;
  const missingOrderCount = rows.filter((row) => row.state === 'missing_order').length;
  const previewRows = manifest?.status === 'preview'
    ? await manifestService.buildLivePreviewRows(areaId, date)
    : null;
  const expectedManifestExtraUnits = previewRows
    ? previewRows.reduce((sum, row) => sum + itemUnits(row.extraItems), 0)
    : totals.order_extra_units;
  const expectedManifestAmount = previewRows
    ? previewRows.reduce((sum, row) => sum + (Number(row.totalAmount) || 0), 0)
    : totals.order_amount;
  const manifestMatches = manifest
    && Number(manifest.total_extra_items || 0) === expectedManifestExtraUnits
    && amountEqual(manifest.total_amount, expectedManifestAmount);

  const checks = [
    {
      key: 'products',
      label: 'Active products',
      status: productsSnap.size > 0 ? 'pass' : 'warning',
      detail: `${productsSnap.size} product${productsSnap.size === 1 ? '' : 's'} available`,
    },
    {
      key: 'cart_to_order',
      label: 'Cart extras copied to orders',
      status: mismatchCount || missingOrderCount || totals.duplicate_order_count
        ? 'fail'
        : totals.cart_extra_units > 0 && totals.order_count === 0
          ? 'pending'
          : 'pass',
      detail: `${totals.cart_extra_units} cart units / ${totals.order_extra_units} order units${totals.duplicate_order_count ? ` / ${totals.duplicate_order_count} duplicate orders` : ''}`,
    },
    {
      key: 'manifest',
      label: 'Manifest totals',
      status: manifest ? (manifestMatches ? 'pass' : 'fail') : (shouldBeGenerated ? 'fail' : 'pending'),
      detail: manifest
        ? `${manifest.total_extra_items || 0} extra units in ${manifest.status === 'preview' ? 'live preview' : 'manifest'}`
        : 'No manifest generated for this date',
    },
    {
      key: 'delivery',
      label: 'Delivery marking',
      status: totals.order_count === 0 || totals.pending_count > 0 ? 'pending' : 'pass',
      detail: `${totals.delivered_count} delivered / ${totals.pending_count} pending`,
    },
    {
      key: 'dues',
      label: 'Due amount update',
      status: deliveredOrders.length === 0
        ? 'pending'
        : dueMissing.length || dueBelowDelivery.length ? 'fail' : 'pass',
      detail: deliveredOrders.length === 0
        ? 'No delivered orders to bill'
        : `${deliveredByUser.size - dueMissing.length} billed users have due records`,
    },
  ];

  return {
    date,
    generation_expected: shouldBeGenerated,
    schedule: {
      cutoff_time: settings.cutoff_time,
      generation_time: settings.generation_time,
      timezone: settings.timezone,
    },
    totals,
    manifest: manifest
      ? {
          id: manifest.id,
          total_extra_items: manifest.total_extra_items || 0,
          total_amount: manifest.total_amount || 0,
          generated_at: manifest.generated_at?.toDate
            ? manifest.generated_at.toDate().toISOString()
            : manifest.generated_at || null,
        }
      : null,
    checks,
    rows: rows.filter((row) => row.cart_units > 0 || row.order_extra_units > 0),
  };
}

async function simulateDeliveryFlow(areaId, input = {}) {
  const productId = input.product_id;
  const quantity = Number(input.quantity);
  if (!productId) {
    throw Object.assign(new Error('product_id is required'), { statusCode: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    throw Object.assign(new Error('quantity must be a whole number between 1 and 100'), { statusCode: 400 });
  }

  const productDoc = await db.collection('products').doc(productId).get();
  if (!productDoc.exists || productDoc.data().is_active !== true) {
    throw Object.assign(new Error('Active product not found'), { statusCode: 400 });
  }

  const product = productDoc.data();
  const includeMilk = input.include_milk !== false;
  let milk = null;
  if (includeMilk) {
    const milkType = input.milk_type || 'cow';
    const litres = Number(input.quantity_litres || 1);
    if (!isValidQuantity(litres)) {
      throw Object.assign(new Error('quantity_litres must be 0.5-10 litres in 0.5L increments'), { statusCode: 400 });
    }
    const priceSnap = await db.collection('price_config').where('milk_type', '==', milkType).limit(1).get();
    if (priceSnap.empty || priceSnap.docs[0].data().is_active === false) {
      throw Object.assign(new Error('Active milk price not found'), { statusCode: 400 });
    }
    const price = Number(priceSnap.docs[0].data().price_per_litre) || 0;
    milk = {
      milk_type: milkType,
      quantity_litres: litres,
      price_per_litre: price,
      total: litres * price,
    };
  }

  const extraItem = {
    product_id: productDoc.id,
    product_name: product.name,
    unit: product.unit,
    quantity,
    price: Number(product.price) || 0,
    total: quantity * (Number(product.price) || 0),
  };
  const totalAmount = orderService.orderTotal(milk, [extraItem]);
  const startingDue = Number(input.starting_due) || 0;
  const payment = Math.max(0, Number(input.payment_amount) || 0);
  const afterDelivery = startingDue + totalAmount;

  return {
    mode: 'dry_run',
    writes_performed: false,
    area_id: areaId,
    steps: [
      { key: 'cart', label: 'Product added to cart', extra_items: [extraItem], amount: extraItem.total },
      { key: 'order', label: 'Order generated', milk, extra_items: [extraItem], total_amount: totalAmount, status: 'pending' },
      { key: 'manifest', label: 'Manifest generated', total_extra_items: quantity, total_amount: totalAmount },
      { key: 'delivery', label: 'Delivery marked', status: 'delivered', billed_amount: totalAmount },
      {
        key: 'dues',
        label: 'Due updated',
        starting_due: startingDue,
        billed_amount: totalAmount,
        payment_amount: payment,
        due_after_delivery: afterDelivery,
        due_after_payment: afterDelivery - payment,
      },
    ],
  };
}

module.exports = { inspectDeliveryFlow, simulateDeliveryFlow, requireDate, itemUnits, itemAmount };
