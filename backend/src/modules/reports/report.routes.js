const express = require('express');
const router = express.Router();
const reportService = require('./report.service');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest } = require('../../utils/response');

// GET /api/reports/user/summary
router.get('/user/summary', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const summary = await reportService.getUserSummary(req.user.userId);
    return success(res, summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/user/calendar?month=YYYY-MM
router.get('/user/calendar', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return badRequest(res, 'month is required in YYYY-MM format');
    }
    const data = await reportService.getUserCalendar(req.user.userId, month);
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/admin/dashboard
router.get('/admin/dashboard', authenticateAdmin, async (req, res, next) => {
  try {
    const dashboard = await reportService.getAdminDashboard(req.admin.areaId);
    return success(res, dashboard);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/admin/daily
router.get('/admin/daily', authenticateAdmin, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return badRequest(res, 'from and to dates are required (YYYY-MM-DD)');
    const stats = await reportService.getDailyStats(req.admin.areaId, from, to);
    return success(res, { stats });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
