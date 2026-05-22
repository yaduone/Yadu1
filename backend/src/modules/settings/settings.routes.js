const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../../middleware/auth');
const { success } = require('../../utils/response');
const manifestSettings = require('./manifestSettings.service');

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

module.exports = router;
