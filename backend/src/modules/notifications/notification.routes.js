const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { authenticateUser, requireCompleteProfile } = require('../../middleware/auth');
const { success, notFound } = require('../../utils/response');
const { purgeExpiredNotifications } = require('./notification.service');

// GET /api/notifications — User: get non-expired notifications (no profile check — notifications are for all authenticated users)
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page, 10)  || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    // Fire-and-forget cleanup of expired docs
    purgeExpiredNotifications();

    const now = admin.firestore.Timestamp.now();

    const queries = [];

    // Single-field queries only — no composite index needed.
    // Expiry filtering is done in JS after fetch.
    if (req.user.userId) {
      queries.push(
        db.collection('notifications')
          .where('user_id', '==', req.user.userId)
          .get()
      );
    }

    if (req.user.areaId) {
      queries.push(
        db.collection('notifications')
          .where('area_id', '==', req.user.areaId)
          .where('user_id', '==', null)
          .get()
      );
    }

    const snaps = await Promise.all(queries);
    const nowMs = now.toMillis();
    const all = snaps
      .flatMap((snap) => snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      .filter((n) => {
        // Drop expired docs in JS — avoids composite index requirement
        if (!n.expires_at) return true;
        const expiresMs = n.expires_at?.toMillis ? n.expires_at.toMillis() : 0;
        return expiresMs > nowMs;
      })
      .sort((a, b) => {
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
router.put('/:id/read', authenticateUser, async (req, res, next) => {
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
router.put('/read-all', authenticateUser, async (req, res, next) => {
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
