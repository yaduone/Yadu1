const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { authenticateUser, requireCompleteProfile } = require('../../middleware/auth');
const { success, notFound } = require('../../utils/response');

// GET /api/notifications — User: get notifications
router.get('/', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    // Get user-specific + area-wide notifications
    const userSnap = await db
      .collection('notifications')
      .where('user_id', '==', req.user.userId)
      .get();

    const areaSnap = await db
      .collection('notifications')
      .where('area_id', '==', req.user.areaId)
      .where('user_id', '==', null)
      .get();

    const allNotifications = [
      ...userSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      ...areaSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    ].sort((a, b) => {
      const aTime = a.created_at?.toDate ? a.created_at.toDate() : new Date(0);
      const bTime = b.created_at?.toDate ? b.created_at.toDate() : new Date(0);
      return bTime - aTime;
    });

    const start = (page - 1) * limit;
    return success(res, {
      notifications: allNotifications.slice(start, start + limit),
      total: allNotifications.length,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/:id/read — Mark as read
router.put('/:id/read', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const ref = db.collection('notifications').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return notFound(res, 'Notification not found');

    await ref.update({ is_read: true });
    return success(res, null, 'Marked as read');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
