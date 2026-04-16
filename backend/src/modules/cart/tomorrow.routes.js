const express = require('express');
const router = express.Router();
const tomorrowService = require('./tomorrow.service');
const { authenticateUser, requireCompleteProfile } = require('../../middleware/auth');
const { success, badRequest } = require('../../utils/response');

// GET /api/tomorrow/status — Get tomorrow's delivery status
router.get('/status', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const status = await tomorrowService.getTomorrowStatus(req.user.userId);
    return success(res, status);
  } catch (err) {
    next(err);
  }
});

// POST /api/tomorrow/modify — Modify tomorrow's quantity
router.post('/modify', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { modified_quantity } = req.body;
    if (modified_quantity === undefined) {
      return badRequest(res, 'modified_quantity is required');
    }

    // Get active subscription
    const subSnap = await require('../../config/firebase')
      .db.collection('subscriptions')
      .where('user_id', '==', req.user.userId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (subSnap.empty) return badRequest(res, 'No active subscription found');

    const sub = subSnap.docs[0];
    const result = await tomorrowService.modifyTomorrow(
      req.user.userId,
      sub.id,
      req.user.areaId,
      modified_quantity
    );
    return success(res, result, 'Tomorrow\'s quantity updated');
  } catch (err) {
    next(err);
  }
});

// POST /api/tomorrow/skip — Skip tomorrow's delivery
router.post('/skip', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const subSnap = await require('../../config/firebase')
      .db.collection('subscriptions')
      .where('user_id', '==', req.user.userId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (subSnap.empty) return badRequest(res, 'No active subscription found');

    const sub = subSnap.docs[0];
    const result = await tomorrowService.skipTomorrow(req.user.userId, sub.id, req.user.areaId);
    return success(res, result, 'Tomorrow\'s delivery skipped');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tomorrow/override — Revert tomorrow's override
router.delete('/override', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const result = await tomorrowService.revertOverride(req.user.userId);
    return success(res, result, 'Override reverted to default');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
