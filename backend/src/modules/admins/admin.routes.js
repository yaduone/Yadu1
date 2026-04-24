const express = require('express');
const router = express.Router();
const { db } = require('../../config/firebase');
const { authenticateAdmin } = require('../../middleware/auth');
const { success } = require('../../utils/response');

/**
 * GET /api/admins/logs
 * Returns activity log entries for the admin's area (+ global entries).
 * Query params:
 *   limit  (default 50)
 *   type   (optional filter, e.g. 'new_user')
 */
router.get('/logs', authenticateAdmin, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const { type } = req.query;
    const { areaId } = req.admin;

    // Fetch area-specific logs
    let areaQuery = db.collection('admin_logs').where('area_id', '==', areaId);
    if (type) areaQuery = areaQuery.where('type', '==', type);
    const areaSnap = await areaQuery.get();

    // Fetch global logs (area_id = null)
    let globalQuery = db.collection('admin_logs').where('area_id', '==', null);
    if (type) globalQuery = globalQuery.where('type', '==', type);
    const globalSnap = await globalQuery.get();

    const serialize = (doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        ...d,
        created_at: d.created_at?.toDate ? d.created_at.toDate().toISOString() : null,
      };
    };

    const logs = [
      ...areaSnap.docs.map(serialize),
      ...globalSnap.docs.map(serialize),
    ]
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
      .slice(0, limit);

    return success(res, { logs, total: logs.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
