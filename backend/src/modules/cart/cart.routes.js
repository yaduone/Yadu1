const express = require('express');
const router = express.Router();
const cartService = require('./cart.service');
const tomorrowService = require('./tomorrow.service');
const { authenticateUser, requireCompleteProfile } = require('../../middleware/auth');
const { success, badRequest } = require('../../utils/response');

// GET /api/cart/tomorrow — Get complete cart for the active target date
router.get('/tomorrow', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const status = await tomorrowService.getTomorrowStatus(req.user.userId);
    return success(res, status);
  } catch (err) {
    next(err);
  }
});

// POST /api/cart/tomorrow/add-item — Add extra product
router.post('/tomorrow/add-item', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) {
      return badRequest(res, 'product_id and quantity are required');
    }
    await cartService.addItem(req.user.userId, req.user.areaId, { product_id, quantity });
    const status = await tomorrowService.getTomorrowStatus(req.user.userId);
    return success(res, status, 'Item added to cart');
  } catch (err) {
    next(err);
  }
});

// PUT /api/cart/tomorrow/update-item — Update extra product quantity
router.put('/tomorrow/update-item', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || quantity === undefined) {
      return badRequest(res, 'product_id and quantity are required');
    }
    await cartService.updateItem(req.user.userId, { product_id, quantity });
    const status = await tomorrowService.getTomorrowStatus(req.user.userId);
    return success(res, status, 'Cart updated');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart/tomorrow/remove-item/:productId — Remove extra product
router.delete('/tomorrow/remove-item/:productId', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    await cartService.removeItem(req.user.userId, req.params.productId);
    const status = await tomorrowService.getTomorrowStatus(req.user.userId);
    return success(res, status, 'Item removed from cart');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
