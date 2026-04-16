const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const manifestService = require('./manifest.service');
const { runNightlyJob } = require('../../jobs/nightlyManifest');
const { authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound, forbidden } = require('../../utils/response');
const dateUtil = require('../../utils/date');

// GET /api/manifests/next-day — Status of the next-day manifest
// Returns whether the manifest is ready and the manifest record if it exists.
router.get('/next-day', authenticateAdmin, async (req, res, next) => {
  try {
    const status = await manifestService.getNextDayStatus(req.admin.areaId);
    return success(res, status);
  } catch (err) {
    next(err);
  }
});

// GET /api/manifests — Admin: list past manifests (today and earlier)
router.get('/', authenticateAdmin, async (req, res, next) => {
  try {
    const { month } = req.query;
    const manifests = await manifestService.listManifests(req.admin.areaId, month);
    return success(res, { manifests });
  } catch (err) {
    next(err);
  }
});

// GET /api/manifests/:id/download — Admin: download a manifest PDF
// Gate: the manifest must exist AND (date <= today OR current time is past cron hour)
router.get('/:id/download', authenticateAdmin, async (req, res, next) => {
  try {
    const pdfPath = await manifestService.getManifestPdfPath(req.params.id, req.admin.areaId);
    if (!pdfPath) return notFound(res, 'Manifest not found');

    // Determine the date this manifest covers
    const { db } = require('../../config/firebase');
    const doc = await db.collection('manifests').doc(req.params.id).get();
    const manifestDate = doc.data()?.date;
    const tomorrow = dateUtil.tomorrow();

    // Block download if this is tomorrow's manifest and cron hasn't run yet
    if (manifestDate === tomorrow && !dateUtil.isPastCronHour()) {
      const window = dateUtil.nextDayManifestWindow();
      return forbidden(
        res,
        `Tomorrow's manifest is not yet available. It will be ready after ${window.cronTime} tonight.`
      );
    }

    if (!fs.existsSync(pdfPath)) {
      return notFound(res, 'Manifest PDF file not found. Try regenerating.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${path.basename(pdfPath)}`);
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    next(err);
  }
});

// POST /api/manifests/trigger — Admin: manually trigger generation for next day
// Gate: only allowed after the cron hour (in case the scheduled job missed)
router.post('/trigger', authenticateAdmin, async (req, res, next) => {
  try {
    if (!dateUtil.isPastCronHour()) {
      const window = dateUtil.nextDayManifestWindow();
      return forbidden(
        res,
        `Manifest generation is not allowed before ${window.cronTime}. The nightly job will run automatically at ${window.cronTime}.`
      );
    }

    await runNightlyJob();
    const status = await manifestService.getNextDayStatus(req.admin.areaId);
    return success(res, status, 'Manifest generated successfully');
  } catch (err) {
    next(err);
  }
});

// POST /api/manifests/regenerate — Admin: regenerate a manifest for a past date only
// Gate: date must be today or earlier (never tomorrow or future)
router.post('/regenerate', authenticateAdmin, async (req, res, next) => {
  try {
    const { date } = req.body;
    if (!date) return badRequest(res, 'date is required (YYYY-MM-DD)');

    const today = dateUtil.today();
    const tomorrow = dateUtil.tomorrow();

    if (date >= tomorrow) {
      return forbidden(
        res,
        'Cannot regenerate a manifest for a future date. Future manifests are generated automatically by the nightly job.'
      );
    }

    const manifest = await manifestService.generateManifest(req.admin.areaId, date, req.admin.adminId);
    return success(res, { manifest }, `Manifest regenerated for ${date}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
