const express = require('express');
const router = express.Router();
const subscriptionService = require('./subscription.service');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, created } = require('../../utils/response');

// POST /api/subscriptions — Create subscription
router.post('/', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { milk_type, quantity_litres, start_date, delivery_slot } = req.body;
    if (!milk_type || !quantity_litres || !start_date || !delivery_slot) {
      return badRequest(res, 'milk_type, quantity_litres, start_date, and delivery_slot are required');
    }
    const subscription = await subscriptionService.createSubscription(req.user.userId, req.user.areaId, {
      milk_type,
      quantity_litres,
      start_date,
      delivery_slot,
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

// PUT /api/subscriptions/:id/quantity — Update daily quantity
router.put('/:id/quantity', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { quantity_litres } = req.body;
    if (quantity_litres === undefined) {
      return badRequest(res, 'quantity_litres is required');
    }
    const result = await subscriptionService.updateQuantity(req.params.id, req.user.userId, quantity_litres);
    return success(res, result, 'Quantity updated');
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
