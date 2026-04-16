const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { authenticateAdmin, requireSuperAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');

// GET /api/areas — Public: list active areas
router.get('/', async (req, res, next) => {
  try {
    const snap = await db.collection('areas').where('is_active', '==', true).get();
    const areas = snap.docs.map((doc) => ({ id: doc.id, name: doc.data().name, slug: doc.data().slug }));
    return success(res, { areas });
  } catch (err) {
    next(err);
  }
});

// POST /api/areas — Super admin: create area
router.post('/', authenticateAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) return badRequest(res, 'name and slug are required');

    const existing = await db.collection('areas').where('slug', '==', slug).limit(1).get();
    if (!existing.empty) return badRequest(res, 'Area with this slug already exists');

    const areaData = {
      name,
      slug,
      is_active: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    const docRef = await db.collection('areas').add(areaData);
    return created(res, { area: { id: docRef.id, ...areaData } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/areas/:id — Super admin: update area
router.put('/:id', authenticateAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const { name, slug, is_active } = req.body;
    const areaRef = db.collection('areas').doc(req.params.id);
    const areaDoc = await areaRef.get();
    if (!areaDoc.exists) return notFound(res, 'Area not found');

    const updateData = { updated_at: admin.firestore.FieldValue.serverTimestamp() };
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (is_active !== undefined) updateData.is_active = is_active;

    await areaRef.update(updateData);
    const updated = await areaRef.get();
    return success(res, { area: { id: updated.id, ...updated.data() } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/areas/:id — Super admin: deactivate area
router.delete('/:id', authenticateAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const areaRef = db.collection('areas').doc(req.params.id);
    const areaDoc = await areaRef.get();
    if (!areaDoc.exists) return notFound(res, 'Area not found');

    await areaRef.update({
      is_active: false,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return success(res, null, 'Area deactivated');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
