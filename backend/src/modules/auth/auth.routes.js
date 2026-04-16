const express = require('express');
const router = express.Router();
const authService = require('./auth.service');
const { authenticateUser } = require('../../middleware/auth');
const { success, badRequest, error: errorRes } = require('../../utils/response');

// POST /api/auth/user/verify
router.post('/user/verify', async (req, res, next) => {
  try {
    const { firebase_token } = req.body;
    if (!firebase_token) {
      return badRequest(res, 'firebase_token is required');
    }
    const result = await authService.verifyUserToken(firebase_token);
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/user/complete-profile
router.post('/user/complete-profile', authenticateUser, async (req, res, next) => {
  try {
    if (!req.user.userId) {
      // User record missing — create it now (handles case where /verify was skipped or failed)
      const result = await authService.verifyUserToken(req.headers.authorization.split('Bearer ')[1]);
      req.user.userId = result.user.id;
    }
    const { name, area_id, address } = req.body;
    if (!name || !area_id || !address || !address.line1 || !address.pincode) {
      return badRequest(res, 'name, area_id, address.line1, and address.pincode are required');
    }
    const user = await authService.completeProfile(req.user.userId, { name, area_id, address });
    return success(res, { user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/admin/login
router.post('/admin/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return badRequest(res, 'username and password are required');
    }
    const result = await authService.adminLogin(username, password);
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
