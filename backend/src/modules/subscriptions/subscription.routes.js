const express = require('express');
const router = express.Router();
const subscriptionService = require('./subscription.service');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');

// POST /api/subscriptions — Create subscription
router.post('/', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { milk_type, quantity_litres, start_date } = req.body;
    if (!milk_type || !quantity_litres || !start_date) {
      return badRequest(res, 'milk_type, quantity_litres, and start_date are required');
    }
    const subscription = await subscriptionService.createSubscription(req.user.userId, req.user.areaId, {
      milk_type,
      quantity_litres,
      start_date,
    });
    return created(res, { subscription });
  } catch (err) {
    next(err);
  }
});

// GET /api/subscriptions/active — Get active subscription
router.get('/active', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const subscription = await subscriptionService.getActiveSubscription(req.user.userId);
    return success(res, { subscription });
  } catch (err) {
    next(err);
  }
});

// PUT /api/subscriptions/:id/pause
router.put('/:id/pause', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const result = await subscriptionService.pauseSubscription(req.params.id, req.user.userId);
    return success(res, result, 'Subscription paused');
  } catch (err) {
    next(err);
  }
});

// PUT /api/subscriptions/:id/resume
router.put('/:id/resume', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const result = await subscriptionService.resumeSubscription(req.params.id, req.user.userId);
    return success(res, result, 'Subscription resumed');
  } catch (err) {
    next(err);
  }
});

// PUT /api/subscriptions/:id/cancel
router.put('/:id/cancel', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const result = await subscriptionService.cancelSubscription(req.params.id, req.user.userId);
    return success(res, result, 'Subscription cancelled');
  } catch (err) {
    next(err);
  }
});

// GET /api/subscriptions/admin/list — Admin: list by area
router.get('/admin/list', authenticateAdmin, async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await subscriptionService.listByArea(req.admin.areaId, {
      status,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
