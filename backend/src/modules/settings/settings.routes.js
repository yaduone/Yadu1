const express = require('express');
const router = express.Router();
const { authenticateAdmin, authenticateUser } = require('../../middleware/auth');
const { success, badRequest } = require('../../utils/response');
const { db } = require('../../config/firebase');
const manifestSettings = require('./manifestSettings.service');
const cartCharges = require('./cartCharges.service');
const instantHours = require('./instantHours.service');
const appVersion = require('./appVersion.service');

// GET /api/settings/manifest — Admin: read manifest schedule for admin area
router.get('/manifest', authenticateAdmin, async (req, res, next) => {
  try {
    const settings = await manifestSettings.getAreaManifestSettings(req.admin.areaId);
    return success(res, { settings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/manifest — Admin: update manifest cutoff/generation schedule
router.put('/manifest', authenticateAdmin, async (req, res, next) => {
  try {
    const settings = await manifestSettings.updateAreaManifestSettings(
      req.admin.areaId,
      req.body,
      req.admin.adminId
    );
    return success(res, { settings }, 'Manifest schedule updated');
  } catch (err) {
    next(err);
  }
});

// ── Cart confirmation charges (platform fee, delivery charge, QA fees, …) ──────

// GET /api/settings/charges — Admin: read both scheduled & instant charge lists
router.get('/charges', authenticateAdmin, async (req, res, next) => {
  try {
    const charges = await cartCharges.getAllCharges();
    return success(res, { charges });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/charges/:type — Admin: replace charge list for a delivery type
router.put('/charges/:type', authenticateAdmin, async (req, res, next) => {
  try {
    const list = await cartCharges.updateChargesForType(
      req.params.type,
      req.body.charges,
      req.admin.adminId
    );
    return success(res, { type: req.params.type, charges: list }, 'Charges updated');
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/charges/app — App: read charges for a delivery type
// (?type=scheduled|instant, defaults to scheduled)
router.get('/charges/app', authenticateUser, async (req, res, next) => {
  try {
    const type = req.query.type || 'scheduled';
    const charges = await cartCharges.getChargesForType(type);
    return success(res, { type, charges });
  } catch (err) {
    next(err);
  }
});

// ── Instant delivery availability window ────────────────────────────────────

// GET /api/settings/instant-hours — Admin: read the instant delivery hours window
router.get('/instant-hours', authenticateAdmin, async (req, res, next) => {
  try {
    const hours = await instantHours.getHours();
    return success(res, { hours });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/instant-hours — Admin: update the instant delivery hours window
router.put('/instant-hours', authenticateAdmin, async (req, res, next) => {
  try {
    const hours = await instantHours.updateHours(req.body, req.admin.adminId);
    return success(res, { hours }, 'Instant delivery hours updated');
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/instant-hours/app — App: read hours + live availability
router.get('/instant-hours/app', authenticateUser, async (req, res, next) => {
  try {
    const status = await instantHours.checkAvailability();
    return success(res, status);
  } catch (err) {
    next(err);
  }
});

// ── App version / Play Store update gate ────────────────────────────────────

// GET /api/settings/app-version — Admin: read the published-version record
router.get('/app-version', authenticateAdmin, async (req, res, next) => {
  try {
    const version = await appVersion.getSettings();
    return success(res, { version });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings/app-version — Admin: publish a new version / move the
// force-update cutoff without shipping a build
router.put('/app-version', authenticateAdmin, async (req, res, next) => {
  try {
    const version = await appVersion.updateSettings(req.body, req.admin.adminId);
    return success(res, { version }, 'App version settings updated');
  } catch (err) {
    next(err);
  }
});

// GET /api/settings/app-version/app?build=22 — App: is there a newer build?
// Deliberately unauthenticated: the update gate runs on the splash screen,
// before a session is restored, and must also work for a forced update.
router.get('/app-version/app', async (req, res, next) => {
  try {
    const result = await appVersion.checkForUpdate(req.query.build);
    return success(res, result);
  } catch (err) {
    next(err);
  }
});

// ── Admin web push registration ─────────────────────────────────────────────

// PUT /api/settings/admin-fcm-token — Admin: register this browser's push token
// so instant-order alerts can reach the admin panel even when the tab is closed.
router.put('/admin-fcm-token', authenticateAdmin, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return badRequest(res, 'token is required');
    await db.collection('admins').doc(req.admin.adminId).set(
      { fcm_token: token },
      { merge: true }
    );
    return success(res, {}, 'Notification token saved');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
