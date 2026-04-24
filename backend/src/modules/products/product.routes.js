const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();

const { db, admin }              = require('../../config/firebase');
const { authenticateAdmin }      = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');
const { isValidProductCategory } = require('../../utils/validators');
const { uploadImages, deleteImages } = require('../../utils/storage');

// ─── Multer — memory storage (files buffered in RAM, sent to Firebase Storage) ─

const upload = multer({
  storage: multer.memoryStorage(),
  limits : { fileSize: 5 * 1024 * 1024 },   // 5 MB per file
  fileFilter(_req, file, cb) {
    const allowed = ['.jpg', '.jpeg', '.png'];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(Object.assign(new Error('Only JPG and PNG images are allowed'), { statusCode: 400 }));
    }
    cb(null, true);
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/products — active products (public)
router.get('/', async (req, res, next) => {
  try {
    let query = db.collection('products').where('is_active', '==', true);
    if (req.query.category) {
      if (!isValidProductCategory(req.query.category)) return badRequest(res, 'Invalid category');
      query = query.where('category', '==', req.query.category);
    }
    const snap = await query.get();
    return success(res, { products: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) { next(err); }
});

// GET /api/products/all — admin: all products including inactive
router.get('/all', authenticateAdmin, async (req, res, next) => {
  try {
    const snap = await db.collection('products').get();
    return success(res, { products: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) { next(err); }
});

// POST /api/products — admin: create product  (multipart/form-data)
router.post('/', authenticateAdmin, upload.array('images', 10), async (req, res, next) => {
  try {
    const { name, category, unit, price, description } = req.body;

    if (!name || !category || !unit || price === undefined) {
      if (req.files?.length) await deleteImages(req.files.map((f) => f.originalname));
      return badRequest(res, 'name, category, unit, and price are required');
    }
    if (!isValidProductCategory(category)) {
      return badRequest(res, 'Invalid category');
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return badRequest(res, 'Price must be a positive number');
    }

    const imageUrls = req.files?.length ? await uploadImages(req.files) : [];

    const productData = {
      name,
      category,
      unit,
      price      : parsedPrice,
      description: description || '',
      images     : imageUrls,
      is_active  : true,
      created_at : admin.firestore.FieldValue.serverTimestamp(),
      updated_at : admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('products').add(productData);
    return created(res, { product: { id: docRef.id, ...productData } });
  } catch (err) { next(err); }
});

// PUT /api/products/:id — admin: update product + manage images  (multipart/form-data)
//
// Text fields : name, category, unit, price, description, is_active
// File field  : images         — new files to upload (appended, or replaces if replace_images=true)
// Text field  : replace_images — "true" → delete all existing images, replace with new uploads
// Text field  : remove_images  — JSON array of existing image URLs to delete individually
router.put('/:id', authenticateAdmin, upload.array('images', 10), async (req, res, next) => {
  try {
    const productRef = db.collection('products').doc(req.params.id);
    const productDoc = await productRef.get();
    if (!productDoc.exists) return notFound(res, 'Product not found');

    const existing = productDoc.data();
    const { name, category, unit, price, description, is_active, replace_images, remove_images } = req.body;
    const updateData = { updated_at: admin.firestore.FieldValue.serverTimestamp() };

    if (name        !== undefined) updateData.name        = name;
    if (unit        !== undefined) updateData.unit        = unit;
    if (description !== undefined) updateData.description = description;
    if (is_active   !== undefined) updateData.is_active   = is_active === 'true' || is_active === true;
    if (category    !== undefined) {
      if (!isValidProductCategory(category)) return badRequest(res, 'Invalid category');
      updateData.category = category;
    }
    if (price !== undefined) {
      const p = parseFloat(price);
      if (isNaN(p) || p <= 0) return badRequest(res, 'Price must be positive');
      updateData.price = p;
    }

    let currentImages = Array.isArray(existing.images) ? [...existing.images] : [];

    // 1. Remove individually selected images
    if (remove_images) {
      const toRemove = JSON.parse(remove_images);
      await deleteImages(toRemove);
      currentImages = currentImages.filter((u) => !toRemove.includes(u));
    }

    // 2. Handle new uploads
    if (req.files?.length) {
      const newUrls = await uploadImages(req.files);
      if (replace_images === 'true') {
        await deleteImages(currentImages);
        currentImages = newUrls;
      } else {
        currentImages = [...currentImages, ...newUrls];
      }
    }

    updateData.images = currentImages;
    await productRef.update(updateData);
    const updated = await productRef.get();
    return success(res, { product: { id: updated.id, ...updated.data() } });
  } catch (err) { next(err); }
});

// DELETE /api/products/:id — admin: permanently delete product + its images
router.delete('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const productRef = db.collection('products').doc(req.params.id);
    const productDoc = await productRef.get();
    if (!productDoc.exists) return notFound(res, 'Product not found');

    await deleteImages(productDoc.data().images || []);
    await productRef.delete();
    return success(res, null, 'Product deleted');
  } catch (err) { next(err); }
});

module.exports = router;
