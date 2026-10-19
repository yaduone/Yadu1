const express = require('express');
const router = express.Router();
const adminOrderService = require('./adminOrder.service');
const { authenticateAdmin } = require('../../middleware/auth');
const { success, created } = require('../../utils/response');

// Every route here acts on one customer on the admin's behalf; the service
// enforces the admin's area scope for each request.
router.use(authenticateAdmin);

// GET /api/admin-orders/customers/:userId — profile, subscription, next delivery, dues
router.get('/customers/:userId', async (req, res, next) => {
  try {
    const overview = await adminOrderService.getCustomerOverview(req.admin, req.params.userId);
    return success(res, overview);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin-orders/customers/:userId/products — add products to the next open delivery
// Body: { items: [{ product_id, quantity }], expected_date, note?, request_id? }
router.post('/customers/:userId/products', async (req, res, next) => {
  try {
    const result = await adminOrderService.addProducts(req.admin, req.params.userId, req.body || {});
    return success(res, result, result.duplicate ? 'Order already placed' : 'Order placed for customer');
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin-orders/customers/:userId/products/:productId — set quantity (0 removes)
// Body: { quantity, expected_date, note?, request_id? }
router.put('/customers/:userId/products/:productId', async (req, res, next) => {
  try {
    const result = await adminOrderService.setProductQuantity(
      req.admin,
      req.params.userId,
      req.params.productId,
      req.body || {}
    );
    return success(res, result, req.body?.quantity === 0 ? 'Product removed' : 'Quantity updated');
  } catch (err) {
    next(err);
  }
});

// POST /api/admin-orders/customers/:userId/subscription — start a subscription
// Body: { milk_type, quantity_litres, start_date, delivery_slot }
router.post('/customers/:userId/subscription', async (req, res, next) => {
  try {
    const result = await adminOrderService.createSubscription(req.admin, req.params.userId, req.body || {});
    return created(res, result, 'Subscription created for customer');
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin-orders/customers/:userId/subscription/:subscriptionId
// Body: { action: pause | resume | cancel | quantity | slot, quantity_litres?, delivery_slot? }
router.put('/customers/:userId/subscription/:subscriptionId', async (req, res, next) => {
  try {
    const result = await adminOrderService.updateSubscription(
      req.admin,
      req.params.userId,
      req.params.subscriptionId,
      req.body || {}
    );
    return success(res, result, 'Subscription updated');
  } catch (err) {
    next(err);
  }
});

// POST /api/admin-orders/customers/:userId/next-delivery — one-day milk change
// Body: { action: skip | modify | revert, quantity_litres?, expected_date }
router.post('/customers/:userId/next-delivery', async (req, res, next) => {
  try {
    const result = await adminOrderService.changeNextDelivery(req.admin, req.params.userId, req.body || {});
    return success(res, result, 'Next delivery updated');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
