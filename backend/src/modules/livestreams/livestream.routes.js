const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');
const livestreamService = require('./livestream.service');

// GET /api/livestreams/lactometer/admin - Admin: get current lactometer readings
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

// GET /api/livestreams/lactometer - User: get today's lactometer readings for their area
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

// PUT /api/livestreams/lactometer - Admin: update morning or evening lactometer reading
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
      if (Number.isNaN(value) || value < 0) {
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

// GET /api/livestreams/active - Customer: active stream plus the next scheduled stream without its URL
router.get('/active', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const streams = await livestreamService.getViewerStreams(req.user.areaId);
    return success(res, streams);
  } catch (err) {
    next(err);
  }
});

// GET /api/livestreams/admin/list - Admin: list schedules for their area
router.get('/admin/list', authenticateAdmin, async (req, res, next) => {
  try {
    const livestreams = await livestreamService.listAreaStreams(req.admin.areaId);
    return success(res, { livestreams });
  } catch (err) {
    next(err);
  }
});

// POST /api/livestreams - Admin: schedule a stream with a 30-minute user reminder
router.post('/', authenticateAdmin, async (req, res, next) => {
  try {
    const livestream = await livestreamService.createScheduledStream(
      req.admin.areaId,
      req.admin.adminId,
      req.body
    );
    return created(res, { livestream }, 'Live stream scheduled');
  } catch (err) {
    next(err);
  }
});

// PUT /api/livestreams/:id - Admin: edit an upcoming schedule or cancel it
router.put('/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const livestream = await livestreamService.updateScheduledStream(
      req.params.id,
      req.admin.areaId,
      req.body
    );
    return success(res, { livestream }, 'Live stream updated');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/livestreams/:id - Admin: permanently remove a schedule
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
