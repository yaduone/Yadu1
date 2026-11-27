/**
 * milkQuality.routes.js — Daily milk quality report
 *
 * Admin (area-scoped):
 *   GET    /api/milk-quality/admin?date=YYYY-MM-DD  report for a day + recent history + form metadata
 *   PUT    /api/milk-quality/admin                  create/replace a day's report (body.date, draft or published)
 *   DELETE /api/milk-quality/admin/:date            remove a day's report
 *   GET    /api/milk-quality/admin/pdf?date=        PDF preview (drafts included)
 *
 * App:
 *   GET    /api/milk-quality/today                  latest published report (last 7 days) + PDF link
 *   GET    /api/milk-quality/pdf/:token             PDF via a short-lived signed link (opened in the browser)
 */

const express = require('express');
const router = express.Router();

const { authenticateAdmin, authenticateUser, requireCompleteProfile } = require('../../middleware/auth');
const { success, badRequest, notFound } = require('../../utils/response');
const dateUtil = require('../../utils/date');
const service = require('./milkQuality.service');
const { renderMilkQualityPdf, pdfFilename } = require('./milkQuality.pdf');

async function sendPdf(res, report, disposition = 'inline') {
  const areaName = await service.getAreaName(report.area_id);
  const pdf = await renderMilkQualityPdf(report, { areaName });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Length': pdf.length,
    'Content-Disposition': `${disposition}; filename="${pdfFilename(report)}"`,
    'Cache-Control': 'private, no-store',
  });
  return res.send(pdf);
}

function requestedDate(req) {
  const date = req.query.date ? String(req.query.date) : dateUtil.today();
  return service.isValidDate(date) ? date : null;
}

// Absolute link back to this deployment, so the app opens the PDF on the same
// backend that answered (the app talks to more than one API host).
function absoluteUrl(req, pathFromApi) {
  const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
  const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  return host ? `${proto}://${host}${req.baseUrl}${pathFromApi}` : null;
}

// ── Admin ────────────────────────────────────────────────────────────────────

router.get('/admin', authenticateAdmin, async (req, res, next) => {
  try {
    const date = requestedDate(req);
    if (!date) return badRequest(res, 'date must be YYYY-MM-DD');
    const today = dateUtil.today();
    const [report, recent] = await Promise.all([
      service.getReport(req.admin.areaId, date),
      service.listRecent(req.admin.areaId, today),
    ]);
    return success(res, { date, today, report, recent, meta: service.meta() });
  } catch (err) { next(err); }
});

router.put('/admin', authenticateAdmin, async (req, res, next) => {
  try {
    const date = String(req.body?.date || '');
    if (!service.isValidDate(date)) return badRequest(res, 'date must be YYYY-MM-DD');
    if (date > dateUtil.today()) return badRequest(res, 'Reports cannot be created for a future date');

    const { errors, data } = service.normalizeReportInput(req.body);
    if (errors.length) return badRequest(res, errors[0], errors);

    const report = await service.saveReport(req.admin.areaId, date, data, req.admin.adminId);
    return success(res, { report }, data.published ? 'Report published' : 'Draft saved');
  } catch (err) { next(err); }
});

router.delete('/admin/:date', authenticateAdmin, async (req, res, next) => {
  try {
    const { date } = req.params;
    if (!service.isValidDate(date)) return badRequest(res, 'date must be YYYY-MM-DD');
    const deleted = await service.deleteReport(req.admin.areaId, date);
    if (!deleted) return notFound(res, 'No report for this date');
    return success(res, null, 'Report deleted');
  } catch (err) { next(err); }
});

router.get('/admin/pdf', authenticateAdmin, async (req, res, next) => {
  try {
    const date = requestedDate(req);
    if (!date) return badRequest(res, 'date must be YYYY-MM-DD');
    const report = await service.getReport(req.admin.areaId, date);
    if (!report) return notFound(res, 'No report for this date');
    return sendPdf(res, report);
  } catch (err) { next(err); }
});

// ── App ──────────────────────────────────────────────────────────────────────

router.get('/today', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const today = dateUtil.today();
    const report = await service.getLatestPublished(req.user.areaId, today);
    if (!report) return success(res, { report: null, is_today: false, pdf_url: null, pdf_path: null });

    const pdfPath = `/pdf/${service.signPdfToken(report.id)}`;
    return success(res, {
      report,
      is_today: report.date === today,
      // pdf_path is relative to the API base (…/api/milk-quality); pdf_url is absolute.
      pdf_path: `/milk-quality${pdfPath}`,
      pdf_url: absoluteUrl(req, pdfPath),
    });
  } catch (err) { next(err); }
});

router.get('/pdf/:token', async (req, res, next) => {
  try {
    const id = service.verifyPdfToken(req.params.token);
    if (!id) return notFound(res, 'This report link has expired. Open the report again from the app.');
    const report = await service.getReportById(id);
    if (!report || !report.published) return notFound(res, 'Report not found');
    return sendPdf(res, report);
  } catch (err) { next(err); }
});

module.exports = router;
