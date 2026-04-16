const express = require('express');
const router = express.Router();
const orderService = require('./order.service');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound } = require('../../utils/response');

// GET /api/orders — User order history
router.get('/', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { page, limit, month } = req.query;
    const result = await orderService.getUserOrders(req.user.userId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      month,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/admin/list — Admin: area orders
router.get('/admin/list', authenticateAdmin, async (req, res, next) => {
  try {
    const { date, status, page, limit } = req.query;
    const result = await orderService.getAreaOrders(req.admin.areaId, {
      date,
      status,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id — User: single order
router.get('/:id', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user.userId);
    if (!order) return notFound(res, 'Order not found');
    return success(res, { order });
  } catch (err) {
    next(err);
  }
});

// PUT /api/orders/admin/:id/status — Admin: update order status
router.put('/admin/:id/status', authenticateAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return badRequest(res, 'status is required');
    const result = await orderService.updateOrderStatus(req.params.id, req.admin.areaId, status);
    return success(res, result, 'Order status updated');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
