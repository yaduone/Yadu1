const express = require('express');
const router = express.Router();
const instantService = require('./instant.service');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, created, badRequest } = require('../../utils/response');

// ─── User cart ────────────────────────────────────────────────────────────────

// GET /api/instant/cart — current instant cart
router.get('/cart', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const cart = await instantService.getCart(req.user.userId, req.user.areaId);
    return success(res, cart);
  } catch (err) { next(err); }
});

// POST /api/instant/cart/add-item
router.post('/cart/add-item', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) return badRequest(res, 'product_id and quantity are required');
    const cart = await instantService.addItem(req.user.userId, req.user.areaId, { product_id, quantity });
    return success(res, cart, 'Item added to instant cart');
  } catch (err) { next(err); }
});

// PUT /api/instant/cart/update-item
router.put('/cart/update-item', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || quantity === undefined) return badRequest(res, 'product_id and quantity are required');
    const cart = await instantService.updateItem(req.user.userId, req.user.areaId, { product_id, quantity });
    return success(res, cart, 'Instant cart updated');
  } catch (err) { next(err); }
});

// DELETE /api/instant/cart/remove-item/:productId
router.delete('/cart/remove-item/:productId', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const cart = await instantService.removeItem(req.user.userId, req.user.areaId, req.params.productId);
    return success(res, cart, 'Item removed from instant cart');
  } catch (err) { next(err); }
});

// PUT /api/instant/cart/delivery-charge
router.put('/cart/delivery-charge', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { delivery_charge } = req.body;
    if (delivery_charge === undefined) return badRequest(res, 'delivery_charge is required');
    const cart = await instantService.setDeliveryCharge(req.user.userId, req.user.areaId, delivery_charge);
    return success(res, cart, 'Delivery charge updated');
  } catch (err) { next(err); }
});

// DELETE /api/instant/cart — empty the cart
router.delete('/cart', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const cart = await instantService.clearCart(req.user.userId, req.user.areaId);
    return success(res, cart, 'Instant cart cleared');
  } catch (err) { next(err); }
});

// POST /api/instant/cart/confirm — place the instant order
router.post('/cart/confirm', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const order = await instantService.confirmOrder(req.user.userId, req.user.areaId);
    return created(res, { order }, 'Instant order placed');
  } catch (err) { next(err); }
});

// ─── User history ───────────────────────────────────────────────────────────

// GET /api/instant/orders — own instant order history
router.get('/orders', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await instantService.getUserOrders(req.user.userId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    return success(res, result);
  } catch (err) { next(err); }
});

// ─── Admin ────────────────────────────────────────────────────────────────────

// GET /api/instant/orders/admin/list — area instant orders
router.get('/orders/admin/list', authenticateAdmin, async (req, res, next) => {
  try {
    const { date, status, page, limit } = req.query;
    const result = await instantService.getAreaOrders(req.admin.areaId, {
      date,
      status,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    });
    return success(res, result);
  } catch (err) { next(err); }
});

// GET /api/instant/carts/admin/list — live saved instant carts
router.get('/carts/admin/list', authenticateAdmin, async (req, res, next) => {
  try {
    const result = await instantService.getAreaCarts(req.admin.areaId);
    return success(res, result);
  } catch (err) { next(err); }
});

// PUT /api/instant/orders/admin/:id/status — mark delivered/cancelled
router.put('/orders/admin/:id/status', authenticateAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return badRequest(res, 'status is required');
    const result = await instantService.updateOrderStatus(req.params.id, req.admin.areaId, status);
    return success(res, result, 'Instant order status updated');
  } catch (err) { next(err); }
});

module.exports = router;
