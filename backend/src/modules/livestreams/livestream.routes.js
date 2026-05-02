const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');
const { isValidYoutubeUrl } = require('../../utils/validators');

// GET /api/livestreams/lactometer/admin — Admin: get current lactometer readings
router.get('/lactometer/admin', authenticateAdmin, async (req, res, next) => {
  try {
    const areaDoc = await db.collection('areas').doc(req.admin.areaId).get();
    const data = areaDoc.exists ? areaDoc.data() : {};
    return success(res, {
      lactometer_morning: data.lactometer_morning !== undefined ? data.lactometer_morning : undefined,
      lactometer_evening: data.lactometer_evening !== undefined ? data.lactometer_evening : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/livestreams/lactometer — User: get today's lactometer readings for their area
router.get('/lactometer', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const areaDoc = await db.collection('areas').doc(req.user.areaId).get();
    const data = areaDoc.exists ? areaDoc.data() : {};
    return success(res, {
      lactometer_morning: data.lactometer_morning !== undefined ? data.lactometer_morning : undefined,
      lactometer_evening: data.lactometer_evening !== undefined ? data.lactometer_evening : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/livestreams/lactometer — Admin: update morning or evening lactometer reading
router.put('/lactometer', authenticateAdmin, async (req, res, next) => {
  try {
    const { slot, reading, is_na } = req.body;
    if (slot !== 'morning' && slot !== 'evening') {
      return badRequest(res, 'slot must be "morning" or "evening"');
    }
    const fieldName = slot === 'morning' ? 'lactometer_morning' : 'lactometer_evening';

    let value;
    if (is_na) {
      value = null;
    } else {
      if (reading === undefined || reading === null || reading === '') {
        return badRequest(res, 'reading is required');
      }
      value = parseFloat(reading);
      if (isNaN(value) || value < 0) {
        return badRequest(res, 'reading must be a valid positive number');
      }
    }

    await db.collection('areas').doc(req.admin.areaId).update({
      [fieldName]: value,
      lactometer_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return success(res, { [fieldName]: value });
  } catch (err) {
    next(err);
  }
});

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
