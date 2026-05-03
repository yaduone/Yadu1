const express = require('express');
const router = express.Router();

const { db, admin } = require('../../config/firebase');
const { authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');
const { cache, invalidateOn } = require('../../middleware/cache');
const config = require('../../config');

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
router.post('/', authenticateAdmin, invalidateOn(['categories', 'public']), async (req, res, next) => {
  try {
    const { label } = req.body;
    if (!label || !label.trim()) return badRequest(res, 'Category label is required');
    const slug = label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!slug) return badRequest(res, 'Invalid category name');
    const dup = await db.collection('categories').where('slug', '==', slug).get();
    if (!dup.empty) return badRequest(res, 'Category already exists');
    const docRef = await db.collection('categories').add({
      slug,
      label: label.trim(),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return created(res, { category: { id: docRef.id, slug, label: label.trim() } });
  } catch (err) { next(err); }
});

// PUT /api/categories/:id — admin (rename label only; slug kept to avoid breaking products)
router.put('/:id', authenticateAdmin, invalidateOn(['categories', 'public']), async (req, res, next) => {
  try {
    const { label } = req.body;
    if (!label || !label.trim()) return badRequest(res, 'Category label is required');
    const ref = db.collection('categories').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return notFound(res, 'Category not found');
    await ref.update({ label: label.trim(), updated_at: admin.firestore.FieldValue.serverTimestamp() });
    return success(res, { category: { id: doc.id, slug: doc.data().slug, label: label.trim() } });
  } catch (err) { next(err); }
});

// DELETE /api/categories/:id — admin
router.delete('/:id', authenticateAdmin, invalidateOn(['categories', 'public']), async (req, res, next) => {
  try {
    const ref = db.collection('categories').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return notFound(res, 'Category not found');
    await ref.delete();
    return success(res, null, 'Category deleted');
  } catch (err) { next(err); }
});

module.exports = router;
