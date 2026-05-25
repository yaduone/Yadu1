const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const { db, admin } = require('../../config/firebase');
const { authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');
const { cache, invalidateOn } = require('../../middleware/cache');
const { uploadImages, deleteImages } = require('../../utils/storage');
const config = require('../../config');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['.jpg', '.jpeg', '.png'];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(Object.assign(new Error('Only JPG and PNG images are allowed'), { statusCode: 400 }));
    }
    cb(null, true);
  },
});

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') return badRequest(res, 'File size exceeds 5MB limit');
    return badRequest(res, err.message);
  }
  if (err && err.statusCode === 400) return badRequest(res, err.message);
  next(err);
}

function categoryPriority(category) {
  return Number.isInteger(category.priority) && category.priority > 0
    ? category.priority
    : Number.MAX_SAFE_INTEGER;
}

function compareCategoryOrder(a, b) {
  return categoryPriority(a) - categoryPriority(b)
    || String(a.label || '').localeCompare(String(b.label || ''))
    || String(a.slug || '').localeCompare(String(b.slug || ''));
}

async function getOrderedCategories({ persistNormalizedOrder = false } = {}) {
  const snap = await db.collection('categories').get();
  let categories = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  categories.sort(compareCategoryOrder);

  if (persistNormalizedOrder && categories.some((category, index) => category.priority !== index + 1)) {
    const batch = db.batch();
    categories = categories.map((category, index) => {
      const priority = index + 1;
      batch.update(db.collection('categories').doc(category.id), {
        priority,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ...category, priority };
    });
    await batch.commit();
  }

  return categories;
}

async function seedIfEmpty() {
  const snap = await db.collection('categories').limit(1).get();
  if (!snap.empty) return;
  const batch = db.batch();
  for (const [index, slug] of config.productCategories.entries()) {
    const label = slug.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const ref = db.collection('categories').doc();
    batch.set(ref, {
      slug,
      label,
      priority: index + 1,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

// GET /api/categories — public, auto-seeds on first call
router.get('/', cache.publicStatic, async (req, res, next) => {
  try {
    await seedIfEmpty();
    const categories = await getOrderedCategories({ persistNormalizedOrder: true });
    return success(res, { categories });
  } catch (err) { next(err); }
});

// POST /api/categories — admin
router.post('/', authenticateAdmin, upload.single('image'), handleMulterError, invalidateOn(['categories', 'public']), async (req, res, next) => {
  try {
    const { label } = req.body;
    if (!label || !label.trim()) return badRequest(res, 'Category label is required');
    const slug = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!slug) return badRequest(res, 'Invalid category name');
    const dup = await db.collection('categories').where('slug', '==', slug).get();
    if (!dup.empty) return badRequest(res, 'Category already exists');
    const categories = await getOrderedCategories({ persistNormalizedOrder: true });
    let imageUrl = '';
    try {
      const imageUrls = req.file ? await uploadImages([req.file], 'categories') : [];
      imageUrl = imageUrls[0] || '';
      const categoryData = {
        slug,
        label: label.trim(),
        image_url: imageUrl,
        priority: categories.length + 1,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };
      const docRef = await db.collection('categories').add(categoryData);
      return created(res, { category: { id: docRef.id, ...categoryData } });
    } catch (err) {
      if (imageUrl) await deleteImages([imageUrl]);
      throw err;
    }
  } catch (err) { next(err); }
});

// PUT /api/categories/order - admin; lower priority is listed first in the user app
router.put('/order', authenticateAdmin, invalidateOn(['categories', 'public']), async (req, res, next) => {
  try {
    const categoryIds = req.body.category_ids;
    if (!Array.isArray(categoryIds) || categoryIds.length === 0 || categoryIds.some((id) => typeof id !== 'string')) {
      return badRequest(res, 'category_ids must be a non-empty array of category IDs');
    }
    if (new Set(categoryIds).size !== categoryIds.length) {
      return badRequest(res, 'category_ids must not contain duplicates');
    }

    const categories = await getOrderedCategories();
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    if (categoryIds.length !== categories.length || categoryIds.some((id) => !categoriesById.has(id))) {
      return badRequest(res, 'category_ids must contain every category exactly once');
    }

    const batch = db.batch();
    const reordered = categoryIds.map((id, index) => {
      const priority = index + 1;
      batch.update(db.collection('categories').doc(id), {
        priority,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { ...categoriesById.get(id), priority };
    });
    await batch.commit();

    return success(res, { categories: reordered }, 'Category order updated');
  } catch (err) { next(err); }
});

// PUT /api/categories/:id - admin (slug stays stable so assigned products keep matching)
router.put('/:id', authenticateAdmin, upload.single('image'), handleMulterError, invalidateOn(['categories', 'public']), async (req, res, next) => {
  try {
    const { label } = req.body;
    if (!label || !label.trim()) return badRequest(res, 'Category label is required');
    const ref = db.collection('categories').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return notFound(res, 'Category not found');
    const existing = doc.data();
    let imageUrl = existing.image_url || '';
    let imageToDelete = '';
    if (req.file) {
      const imageUrls = await uploadImages([req.file], 'categories');
      imageUrl = imageUrls[0] || '';
      imageToDelete = existing.image_url || '';
    } else if (req.body.remove_image === 'true') {
      imageToDelete = existing.image_url || '';
      imageUrl = '';
    }
    const updateData = {
      label: label.trim(),
      image_url: imageUrl,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    try {
      await ref.update(updateData);
    } catch (err) {
      if (req.file && imageUrl) await deleteImages([imageUrl]);
      throw err;
    }
    if (imageToDelete) await deleteImages([imageToDelete]);
    return success(res, { category: { id: doc.id, slug: existing.slug, ...updateData } });
  } catch (err) { next(err); }
});

// DELETE /api/categories/:id — admin
router.delete('/:id', authenticateAdmin, invalidateOn(['categories', 'public']), async (req, res, next) => {
  try {
    const ref = db.collection('categories').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return notFound(res, 'Category not found');
    await ref.delete();
    if (doc.data().image_url) await deleteImages([doc.data().image_url]);
    return success(res, null, 'Category deleted');
  } catch (err) { next(err); }
});

module.exports = router;
