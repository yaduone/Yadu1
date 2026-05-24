const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../../middleware/auth');
const { success } = require('../../utils/response');
const dateUtil = require('../../utils/date');
const deliveryFlow = require('./deliveryFlow.service');

router.get('/delivery-flow', authenticateAdmin, async (req, res, next) => {
  try {
    const date = req.query.date || dateUtil.tomorrow();
    const result = await deliveryFlow.inspectDeliveryFlow(req.admin.areaId, date);
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

router.post('/delivery-flow/simulate', authenticateAdmin, async (req, res, next) => {
  try {
    const result = await deliveryFlow.simulateDeliveryFlow(req.admin.areaId, req.body);
    return success(res, result, 'Dry run completed');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
