const express = require('express');
const router = express.Router();

const { db, admin } = require('../../config/firebase');
const { authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');

const COLLECTIONS = {
  products: 'inventory_products',
  vendors: 'inventory_vendors',
  purchases: 'inventory_purchases',
  logs: 'inventory_logs',
};

function now() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : null;
}

function serialize(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    created_at: toIso(data.created_at),
    updated_at: toIso(data.updated_at),
  };
}

function sortByName(items) {
  return items.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function sortPurchases(items) {
  return items.sort((a, b) => {
    const dateOrder = String(b.purchased_on || '').localeCompare(String(a.purchased_on || ''));
    if (dateOrder) return dateOrder;
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

function sortLogs(items) {
  return items.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

async function listOwned(collectionName, adminId) {
  const snap = await db.collection(collectionName).where('admin_id', '==', adminId).get();
  return snap.docs.map(serialize);
}

async function getOwnedDoc(collectionName, id, adminId) {
  const ref = db.collection(collectionName).doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data().admin_id !== adminId) return null;
  return { ref, doc, value: serialize(doc) };
}

async function writeLog(req, type, title, message, entityType, entityId, meta = {}) {
  try {
    await db.collection(COLLECTIONS.logs).add({
      admin_id: req.admin.adminId,
      type,
      title,
      message,
      entity_type: entityType,
      entity_id: entityId,
      meta,
      created_at: now(),
    });
  } catch (err) {
    console.error('[inventory] Failed to create log:', err.message);
  }
}

function productFields(body) {
  return {
    name: cleanString(body.name),
    sku: cleanString(body.sku),
    unit: cleanString(body.unit),
    notes: cleanString(body.notes),
  };
}

function vendorFields(body) {
  return {
    name: cleanString(body.name),
    contact_person: cleanString(body.contact_person),
    phone: cleanString(body.phone),
    email: cleanString(body.email),
    address: cleanString(body.address),
    notes: cleanString(body.notes),
  };
}

function parsePurchase(body) {
  const quantity = body.quantity === '' || body.quantity == null ? NaN : Number(body.quantity);
  const amountPaid = body.amount_paid === '' || body.amount_paid == null ? NaN : Number(body.amount_paid);
  const purchasedOn = cleanString(body.purchased_on) || new Date().toISOString().slice(0, 10);
  return {
    product_id: cleanString(body.product_id),
    vendor_id: cleanString(body.vendor_id),
    quantity,
    amount_paid: amountPaid,
    purchased_on: purchasedOn,
    notes: cleanString(body.notes),
  };
}

function validatePurchase(payload) {
  if (!payload.product_id || !payload.vendor_id) return 'Product and vendor are required';
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) return 'Quantity must be greater than zero';
  if (!Number.isFinite(payload.amount_paid) || payload.amount_paid < 0) return 'Amount paid must be zero or greater';
  const date = new Date(`${payload.purchased_on}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.purchased_on)
    || Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== payload.purchased_on
  ) {
    return 'Purchase date must be a valid date in YYYY-MM-DD format';
  }
  return '';
}

async function duplicateNameExists(collectionName, adminId, name, ignoreId = null) {
  const items = await listOwned(collectionName, adminId);
  const normalized = name.toLowerCase();
  return items.some((item) => item.id !== ignoreId && String(item.name || '').toLowerCase() === normalized);
}

async function purchasesForAdmin(adminId) {
  return listOwned(COLLECTIONS.purchases, adminId);
}

// All inventory data lives in inventory_* collections and never modifies sales/catalog records.
router.use(authenticateAdmin);

// GET /api/inventory/products
router.get('/products', async (req, res, next) => {
  try {
    const products = sortByName(await listOwned(COLLECTIONS.products, req.admin.adminId));
    return success(res, { products });
  } catch (err) { next(err); }
});

// POST /api/inventory/products
router.post('/products', async (req, res, next) => {
  try {
    const fields = productFields(req.body);
    if (!fields.name) return badRequest(res, 'Product name is required');
    if (await duplicateNameExists(COLLECTIONS.products, req.admin.adminId, fields.name)) {
      return badRequest(res, 'An inventory product with this name already exists');
    }

    const data = {
      ...fields,
      admin_id: req.admin.adminId,
      created_at: now(),
      updated_at: now(),
    };
    const ref = await db.collection(COLLECTIONS.products).add(data);
    await writeLog(
      req,
      'product_created',
      'Product added',
      `${fields.name} was added to the stock catalog.`,
      'product',
      ref.id,
      { product_name: fields.name, sku: fields.sku, unit: fields.unit }
    );
    return created(res, { product: { id: ref.id, ...data } }, 'Inventory product created');
  } catch (err) { next(err); }
});

// PUT /api/inventory/products/:id
router.put('/products/:id', async (req, res, next) => {
  try {
    const owned = await getOwnedDoc(COLLECTIONS.products, req.params.id, req.admin.adminId);
    if (!owned) return notFound(res, 'Inventory product not found');

    const fields = productFields(req.body);
    if (!fields.name) return badRequest(res, 'Product name is required');
    if (await duplicateNameExists(COLLECTIONS.products, req.admin.adminId, fields.name, req.params.id)) {
      return badRequest(res, 'An inventory product with this name already exists');
    }

    const update = { ...fields, updated_at: now() };
    await owned.ref.update(update);
    await writeLog(
      req,
      'product_updated',
      'Product updated',
      `${fields.name} was updated in the stock catalog.`,
      'product',
      req.params.id,
      { product_name: fields.name, previous_name: owned.value.name, sku: fields.sku, unit: fields.unit }
    );
    return success(res, { product: { ...owned.value, ...update } }, 'Inventory product updated');
  } catch (err) { next(err); }
});

// DELETE /api/inventory/products/:id
router.delete('/products/:id', async (req, res, next) => {
  try {
    const owned = await getOwnedDoc(COLLECTIONS.products, req.params.id, req.admin.adminId);
    if (!owned) return notFound(res, 'Inventory product not found');
    const purchases = await purchasesForAdmin(req.admin.adminId);
    if (purchases.some((purchase) => purchase.product_id === req.params.id)) {
      return badRequest(res, 'This product has purchase history and cannot be deleted');
    }

    await owned.ref.delete();
    await writeLog(
      req,
      'product_deleted',
      'Product deleted',
      `${owned.value.name} was removed from the stock catalog.`,
      'product',
      req.params.id,
      { product_name: owned.value.name }
    );
    return success(res, null, 'Inventory product deleted');
  } catch (err) { next(err); }
});

// GET /api/inventory/vendors
router.get('/vendors', async (req, res, next) => {
  try {
    const vendors = sortByName(await listOwned(COLLECTIONS.vendors, req.admin.adminId));
    return success(res, { vendors });
  } catch (err) { next(err); }
});

// POST /api/inventory/vendors
router.post('/vendors', async (req, res, next) => {
  try {
    const fields = vendorFields(req.body);
    if (!fields.name) return badRequest(res, 'Vendor name is required');
    if (await duplicateNameExists(COLLECTIONS.vendors, req.admin.adminId, fields.name)) {
      return badRequest(res, 'A vendor with this name already exists');
    }

    const data = {
      ...fields,
      admin_id: req.admin.adminId,
      created_at: now(),
      updated_at: now(),
    };
    const ref = await db.collection(COLLECTIONS.vendors).add(data);
    await writeLog(
      req,
      'vendor_created',
      'Vendor added',
      `${fields.name} was added to vendor contacts.`,
      'vendor',
      ref.id,
      { vendor_name: fields.name, phone: fields.phone, contact_person: fields.contact_person }
    );
    return created(res, { vendor: { id: ref.id, ...data } }, 'Inventory vendor created');
  } catch (err) { next(err); }
});

// PUT /api/inventory/vendors/:id
router.put('/vendors/:id', async (req, res, next) => {
  try {
    const owned = await getOwnedDoc(COLLECTIONS.vendors, req.params.id, req.admin.adminId);
    if (!owned) return notFound(res, 'Vendor not found');

    const fields = vendorFields(req.body);
    if (!fields.name) return badRequest(res, 'Vendor name is required');
    if (await duplicateNameExists(COLLECTIONS.vendors, req.admin.adminId, fields.name, req.params.id)) {
      return badRequest(res, 'A vendor with this name already exists');
    }

    const update = { ...fields, updated_at: now() };
    await owned.ref.update(update);
    await writeLog(
      req,
      'vendor_updated',
      'Vendor updated',
      `${fields.name} contact details were updated.`,
      'vendor',
      req.params.id,
      { vendor_name: fields.name, previous_name: owned.value.name, phone: fields.phone }
    );
    return success(res, { vendor: { ...owned.value, ...update } }, 'Inventory vendor updated');
  } catch (err) { next(err); }
});

// DELETE /api/inventory/vendors/:id
router.delete('/vendors/:id', async (req, res, next) => {
  try {
    const owned = await getOwnedDoc(COLLECTIONS.vendors, req.params.id, req.admin.adminId);
    if (!owned) return notFound(res, 'Vendor not found');
    const purchases = await purchasesForAdmin(req.admin.adminId);
    if (purchases.some((purchase) => purchase.vendor_id === req.params.id)) {
      return badRequest(res, 'This vendor has purchase history and cannot be deleted');
    }

    await owned.ref.delete();
    await writeLog(
      req,
      'vendor_deleted',
      'Vendor deleted',
      `${owned.value.name} was removed from vendor contacts.`,
      'vendor',
      req.params.id,
      { vendor_name: owned.value.name }
    );
    return success(res, null, 'Inventory vendor deleted');
  } catch (err) { next(err); }
});

// GET /api/inventory/purchases
router.get('/purchases', async (req, res, next) => {
  try {
    let purchases = await purchasesForAdmin(req.admin.adminId);
    if (req.query.product_id) purchases = purchases.filter((item) => item.product_id === req.query.product_id);
    if (req.query.vendor_id) purchases = purchases.filter((item) => item.vendor_id === req.query.vendor_id);
    return success(res, { purchases: sortPurchases(purchases) });
  } catch (err) { next(err); }
});

// POST /api/inventory/purchases
router.post('/purchases', async (req, res, next) => {
  try {
    const payload = parsePurchase(req.body);
    const validationError = validatePurchase(payload);
    if (validationError) return badRequest(res, validationError);

    const product = await getOwnedDoc(COLLECTIONS.products, payload.product_id, req.admin.adminId);
    if (!product) return notFound(res, 'Inventory product not found');
    const vendor = await getOwnedDoc(COLLECTIONS.vendors, payload.vendor_id, req.admin.adminId);
    if (!vendor) return notFound(res, 'Vendor not found');

    const data = {
      ...payload,
      product_name: product.value.name,
      product_unit: product.value.unit || '',
      vendor_name: vendor.value.name,
      admin_id: req.admin.adminId,
      created_at: now(),
      updated_at: now(),
    };
    const ref = await db.collection(COLLECTIONS.purchases).add(data);
    await writeLog(
      req,
      'purchase_created',
      'Purchase recorded',
      `${payload.quantity} ${product.value.unit || 'unit(s)'} of ${product.value.name} purchased from ${vendor.value.name}.`,
      'purchase',
      ref.id,
      {
        product_name: product.value.name,
        vendor_name: vendor.value.name,
        quantity: payload.quantity,
        amount_paid: payload.amount_paid,
        purchased_on: payload.purchased_on,
      }
    );
    return created(res, { purchase: { id: ref.id, ...data } }, 'Purchase recorded');
  } catch (err) { next(err); }
});

// PUT /api/inventory/purchases/:id
router.put('/purchases/:id', async (req, res, next) => {
  try {
    const owned = await getOwnedDoc(COLLECTIONS.purchases, req.params.id, req.admin.adminId);
    if (!owned) return notFound(res, 'Purchase record not found');

    const payload = parsePurchase(req.body);
    const validationError = validatePurchase(payload);
    if (validationError) return badRequest(res, validationError);
    const product = await getOwnedDoc(COLLECTIONS.products, payload.product_id, req.admin.adminId);
    if (!product) return notFound(res, 'Inventory product not found');
    const vendor = await getOwnedDoc(COLLECTIONS.vendors, payload.vendor_id, req.admin.adminId);
    if (!vendor) return notFound(res, 'Vendor not found');

    const update = {
      ...payload,
      product_name: product.value.name,
      product_unit: product.value.unit || '',
      vendor_name: vendor.value.name,
      updated_at: now(),
    };
    await owned.ref.update(update);
    await writeLog(
      req,
      'purchase_updated',
      'Purchase corrected',
      `Purchase record for ${product.value.name} was updated.`,
      'purchase',
      req.params.id,
      {
        product_name: product.value.name,
        vendor_name: vendor.value.name,
        quantity: payload.quantity,
        amount_paid: payload.amount_paid,
        purchased_on: payload.purchased_on,
        previous_quantity: owned.value.quantity,
        previous_amount_paid: owned.value.amount_paid,
      }
    );
    return success(res, { purchase: { ...owned.value, ...update } }, 'Purchase updated');
  } catch (err) { next(err); }
});

// DELETE /api/inventory/purchases/:id
router.delete('/purchases/:id', async (req, res, next) => {
  try {
    const owned = await getOwnedDoc(COLLECTIONS.purchases, req.params.id, req.admin.adminId);
    if (!owned) return notFound(res, 'Purchase record not found');
    await owned.ref.delete();
    await writeLog(
      req,
      'purchase_deleted',
      'Purchase deleted',
      `Purchase record for ${owned.value.product_name} was deleted.`,
      'purchase',
      req.params.id,
      {
        product_name: owned.value.product_name,
        vendor_name: owned.value.vendor_name,
        quantity: owned.value.quantity,
        amount_paid: owned.value.amount_paid,
        purchased_on: owned.value.purchased_on,
      }
    );
    return success(res, null, 'Purchase deleted');
  } catch (err) { next(err); }
});

// GET /api/inventory/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const [products, vendors, purchases] = await Promise.all([
      listOwned(COLLECTIONS.products, req.admin.adminId),
      listOwned(COLLECTIONS.vendors, req.admin.adminId),
      purchasesForAdmin(req.admin.adminId),
    ]);
    const productSummaries = products.map((product) => {
      const history = purchases.filter((purchase) => purchase.product_id === product.id);
      return {
        ...product,
        purchase_count: history.length,
        total_quantity: history.reduce((sum, purchase) => sum + Number(purchase.quantity || 0), 0),
        total_amount_paid: history.reduce((sum, purchase) => sum + Number(purchase.amount_paid || 0), 0),
        last_purchased_on: sortPurchases(history.slice())[0]?.purchased_on || null,
      };
    });

    return success(res, {
      totals: {
        products: products.length,
        vendors: vendors.length,
        purchases: purchases.length,
        quantity: purchases.reduce((sum, purchase) => sum + Number(purchase.quantity || 0), 0),
        amount_paid: purchases.reduce((sum, purchase) => sum + Number(purchase.amount_paid || 0), 0),
      },
      products: sortByName(productSummaries),
    });
  } catch (err) { next(err); }
});

// GET /api/inventory/products/:id/history
router.get('/products/:id/history', async (req, res, next) => {
  try {
    const product = await getOwnedDoc(COLLECTIONS.products, req.params.id, req.admin.adminId);
    if (!product) return notFound(res, 'Inventory product not found');
    const purchases = sortPurchases(
      (await purchasesForAdmin(req.admin.adminId)).filter((purchase) => purchase.product_id === req.params.id)
    );
    return success(res, {
      product: product.value,
      summary: {
        purchase_count: purchases.length,
        total_quantity: purchases.reduce((sum, purchase) => sum + Number(purchase.quantity || 0), 0),
        total_amount_paid: purchases.reduce((sum, purchase) => sum + Number(purchase.amount_paid || 0), 0),
      },
      purchases,
    });
  } catch (err) { next(err); }
});

// GET /api/inventory/logs
router.get('/logs', async (req, res, next) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || 100, 300);
    const logs = sortLogs(await listOwned(COLLECTIONS.logs, req.admin.adminId)).slice(0, limit);
    return success(res, { logs });
  } catch (err) { next(err); }
});

module.exports = router;
