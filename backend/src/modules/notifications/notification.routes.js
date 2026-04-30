const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { authenticateUser, requireCompleteProfile } = require('../../middleware/auth');
const { success, notFound } = require('../../utils/response');
const { purgeExpiredNotifications } = require('./notification.service');

// GET /api/notifications — User: get non-expired notifications
router.get('/', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page, 10)  || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    // Fire-and-forget cleanup of expired docs
    purgeExpiredNotifications();

    const now = admin.firestore.Timestamp.now();

    // User-specific notifications that haven't expired
    const userSnap = await db
      .collection('notifications')
      .where('user_id', '==', req.user.userId)
      .where('expires_at', '>', now)
      .get();

    // Area-wide broadcast notifications that haven't expired
    const areaSnap = await db
      .collection('notifications')
      .where('area_id', '==', req.user.areaId)
      .where('user_id', '==', null)
      .where('expires_at', '>', now)
      .get();

    const all = [
      ...userSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      ...areaSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    ].sort((a, b) => {
      const aTime = a.created_at?.toDate ? a.created_at.toDate() : new Date(0);
      const bTime = b.created_at?.toDate ? b.created_at.toDate() : new Date(0);
      return bTime - aTime;
    });

    // Serialise Firestore Timestamps to ISO strings for the client
    const serialised = all.map((n) => ({
      ...n,
      created_at: n.created_at?.toDate ? n.created_at.toDate().toISOString() : null,
      expires_at: n.expires_at?.toDate ? n.expires_at.toDate().toISOString() : null,
    }));

    const start = (page - 1) * limit;
    return success(res, {
      notifications: serialised.slice(start, start + limit),
      total: serialised.length,
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/:id/read — Mark a single notification as read
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

// PUT /api/notifications/read-all — Mark all user notifications as read
router.put('/read-all', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const snap = await db
      .collection('notifications')
      .where('user_id', '==', req.user.userId)
      .where('is_read', '==', false)
      .get();

    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.update(d.ref, { is_read: true }));
      await batch.commit();
    }
    return success(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
