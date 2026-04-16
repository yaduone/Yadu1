const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');
const { isValidProductCategory } = require('../../utils/validators');

// GET /api/products — list active products (public for authenticated users)
router.get('/', async (req, res, next) => {
  try {
    let query = db.collection('products').where('is_active', '==', true);
    if (req.query.category) {
      if (!isValidProductCategory(req.query.category)) {
        return badRequest(res, 'Invalid product category');
      }
      query = query.where('category', '==', req.query.category);
    }
    const snap = await query.get();
    const products = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return success(res, { products });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/all — Admin: list all products including inactive
router.get('/all', authenticateAdmin, async (req, res, next) => {
  try {
    const snap = await db.collection('products').get();
    const products = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return success(res, { products });
  } catch (err) {
    next(err);
  }
});

// POST /api/products — Admin: create product
router.post('/', authenticateAdmin, async (req, res, next) => {
  try {
    const { name, category, unit, price, description, images } = req.body;
    if (!name || !category || !unit || price === undefined) {
      return badRequest(res, 'name, category, unit, and price are required');
    }
    if (!isValidProductCategory(category)) {
      return badRequest(res, `Invalid category. Must be one of: ${require('../../config').productCategories.join(', ')}`);
    }
    if (typeof price !== 'number' || price <= 0) {
      return badRequest(res, 'Price must be a positive number');
    }
    if (images !== undefined && (!Array.isArray(images) || images.some((u) => typeof u !== 'string'))) {
      return badRequest(res, 'images must be an array of URL strings');
    }

    const productData = {
      name,
      category,
      unit,
      price,
      description: description || '',
      images: Array.isArray(images) ? images.filter(Boolean) : [],
      is_active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    const docRef = await db.collection('products').add(productData);
    return created(res, { product: { id: docRef.id, ...productData } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id — Admin: update product
router.put('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const productRef = db.collection('products').doc(req.params.id);
    const productDoc = await productRef.get();
    if (!productDoc.exists) return notFound(res, 'Product not found');

    const { name, category, unit, price, description, is_active, images } = req.body;
    const updateData = { updated_at: admin.firestore.FieldValue.serverTimestamp() };

    if (name !== undefined) updateData.name = name;
    if (category !== undefined) {
      if (!isValidProductCategory(category)) return badRequest(res, 'Invalid category');
      updateData.category = category;
    }
    if (unit !== undefined) updateData.unit = unit;
    if (price !== undefined) {
      if (typeof price !== 'number' || price <= 0) return badRequest(res, 'Price must be positive');
      updateData.price = price;
    }
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (images !== undefined) {
      if (!Array.isArray(images) || images.some((u) => typeof u !== 'string')) {
        return badRequest(res, 'images must be an array of URL strings');
      }
      updateData.images = images.filter(Boolean);
    }

    await productRef.update(updateData);
    const updated = await productRef.get();
    return success(res, { product: { id: updated.id, ...updated.data() } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id — Admin: deactivate product
router.delete('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const productRef = db.collection('products').doc(req.params.id);
    const productDoc = await productRef.get();
    if (!productDoc.exists) return notFound(res, 'Product not found');

    await productRef.update({
      is_active: false,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return success(res, null, 'Product deactivated');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
