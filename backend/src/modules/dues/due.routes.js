const express = require('express');
const router = express.Router();
const dueService = require('./due.service');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound } = require('../../utils/response');
const notificationService = require('../notifications/notification.service');

// ─── User routes ─────────────────────────────────────────────────────────────

// GET /api/dues/me — User: get own due balance
router.get('/me', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const due = await dueService.getUserDue(req.user.userId);
    return success(res, due);
  } catch (err) {
    next(err);
  }
});

// POST /api/dues/tickets — User: raise a ticket
router.post('/tickets', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { subject, description } = req.body;
    const result = await dueService.raiseTicket(req.user.userId, req.user.areaId, { subject, description });
    return success(res, result, 'Ticket raised successfully');
  } catch (err) {
    next(err);
  }
});

// GET /api/dues/tickets/me — User: get own tickets
router.get('/tickets/me', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const tickets = await dueService.getUserTickets(req.user.userId);
    return success(res, { tickets });
  } catch (err) {
    next(err);
  }
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

// GET /api/dues/admin/list — Admin: all due amounts in area
router.get('/admin/list', authenticateAdmin, async (req, res, next) => {
  try {
    const dues = await dueService.listAreaDues(req.admin.areaId);
    return success(res, { dues });
  } catch (err) {
    next(err);
  }
});

// GET /api/dues/admin/user/:userId/payments — Admin: payment history for a user
router.get('/admin/user/:userId/payments', authenticateAdmin, async (req, res, next) => {
  try {
    const payments = await dueService.getUserPayments(req.params.userId);
    return success(res, { payments });
  } catch (err) {
    next(err);
  }
});

// POST /api/dues/admin/payment — Admin: record a payment
router.post('/admin/payment', authenticateAdmin, async (req, res, next) => {
  try {
    const { user_id, area_id, amount, method, notes, payment_date } = req.body;
    if (!user_id) return badRequest(res, 'user_id is required');
    if (!amount) return badRequest(res, 'amount is required');
    if (!method) return badRequest(res, 'method is required (cash, upi, other)');

    const result = await dueService.recordPayment(req.admin.adminId, user_id, area_id || req.admin.areaId, {
      amount: parseFloat(amount),
      method,
      notes,
      payment_date,
    });
    return success(res, result, 'Payment recorded');
  } catch (err) {
    next(err);
  }
});

// POST /api/dues/admin/ping/:userId — Admin: ping a user about their outstanding due
router.post('/admin/ping/:userId', authenticateAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const due = await dueService.getUserDue(userId);

    if (due.due_amount <= 0) {
      return badRequest(res, 'User has no outstanding due amount to remind about');
    }

    // Verify user belongs to this admin's area
    const { db } = require('../../config/firebase');
    const dueDoc = await db.collection('due_amounts').doc(userId).get();
    if (!dueDoc.exists) return notFound(res, 'No due record found for this user');
    if (dueDoc.data().area_id !== req.admin.areaId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await notificationService.sendDueReminderNotification(userId, req.admin.areaId, {
      dueAmount: due.due_amount,
      totalBilled: due.total_billed,
      totalPaid: due.total_paid,
    });

    return success(res, null, 'Payment reminder sent to user');
  } catch (err) {
    next(err);
  }
});

// GET /api/dues/admin/tickets — Admin: all tickets in area
router.get('/admin/tickets', authenticateAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const tickets = await dueService.getAreaTickets(req.admin.areaId, status);
    return success(res, { tickets });
  } catch (err) {
    next(err);
  }
});

// PUT /api/dues/admin/tickets/:id — Admin: update ticket
router.put('/admin/tickets/:id', authenticateAdmin, async (req, res, next) => {
  try {
    const { status, admin_notes } = req.body;
    if (!status) return badRequest(res, 'status is required');
    const result = await dueService.resolveTicket(req.params.id, req.admin.areaId, { status, admin_notes });
    return success(res, result, 'Ticket updated');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
