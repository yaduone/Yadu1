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

async function seedIfEmpty() {
  const snap = await db.collection('categories').limit(1).get();
  if (!snap.empty) return;
  const batch = db.batch();
  for (const slug of config.productCategories) {
    const label = slug.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const ref = db.collection('categories').doc();
    batch.set(ref, {
      slug,
      label,
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
    const snap = await db.collection('categories').orderBy('label').get();
    const categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
    let imageUrl = '';
    try {
      const imageUrls = req.file ? await uploadImages([req.file], 'categories') : [];
      imageUrl = imageUrls[0] || '';
      const categoryData = {
        slug,
        label: label.trim(),
        image_url: imageUrl,
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
