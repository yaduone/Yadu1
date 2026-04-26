const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');
const { isValidYoutubeUrl } = require('../../utils/validators');

// GET /api/livestreams/active — User: get active livestream for their area
router.get('/active', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const snap = await db
      .collection('livestreams')
      .where('area_id', '==', req.user.areaId)
      .where('is_active', '==', true)
      .limit(1)
      .get();

    const active = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    return success(res, { livestream: active });
  } catch (err) {
    next(err);
  }
});

// GET /api/livestreams/admin/list — Admin: list all for area
router.get('/admin/list', authenticateAdmin, async (req, res, next) => {
  try {
    const snap = await db.collection('livestreams').where('area_id', '==', req.admin.areaId).get();
    const livestreams = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aTime = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at);
        const bTime = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at);
        return bTime - aTime;
      });
    return success(res, { livestreams });
  } catch (err) {
    next(err);
  }
});

// POST /api/livestreams — Admin: create livestream
router.post('/', authenticateAdmin, async (req, res, next) => {
  try {
    const { title, youtube_url } = req.body;
    if (!title || !youtube_url) {
      return badRequest(res, 'title and youtube_url are required');
    }
    if (!isValidYoutubeUrl(youtube_url)) {
      return badRequest(res, 'Invalid YouTube URL');
    }

    const data = {
      area_id: req.admin.areaId,
      title,
      youtube_url,
      is_active: true,
      created_by: req.admin.adminId,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection('livestreams').add(data);
    return created(res, { livestream: { id: docRef.id, ...data } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/livestreams/:id — Admin: update livestream
router.put('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const ref = db.collection('livestreams').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().area_id !== req.admin.areaId) {
      return notFound(res, 'Livestream not found');
    }

    const { title, youtube_url, is_active } = req.body;
    const updateData = { updated_at: admin.firestore.FieldValue.serverTimestamp() };

    if (title !== undefined) updateData.title = title;
    if (youtube_url !== undefined) {
      if (!isValidYoutubeUrl(youtube_url)) return badRequest(res, 'Invalid YouTube URL');
      updateData.youtube_url = youtube_url;
    }
    if (is_active !== undefined) updateData.is_active = is_active;

    await ref.update(updateData);
    const updated = await ref.get();
    return success(res, { livestream: { id: updated.id, ...updated.data() } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/livestreams/:id — Admin: delete livestream
router.delete('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const ref = db.collection('livestreams').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().area_id !== req.admin.areaId) {
      return notFound(res, 'Livestream not found');
    }
    await ref.delete();
    return success(res, null, 'Livestream deleted');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
