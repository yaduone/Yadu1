/**
 * milkQuality.service.js — Daily milk quality report (per area, per day)
 *
 * Area admins record the day's lab results (fat, SNF, lactose, protein,
 * lactometer, pH per milk variety, plus adulteration screens). Customers see
 * the latest published report on the app home screen and can download it as a
 * branded PDF.
 *
 * One Firestore doc per area per day in `milk_quality_reports`, keyed
 * `${areaId}_${YYYY-MM-DD}`. Reads look up fixed date windows by id so no
 * composite index is needed.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { db, admin } = require('../../config/firebase');
const config = require('../../config');
const dateUtil = require('../../utils/date');

const COLLECTION = 'milk_quality_reports';

const MILK_TYPES = ['cow', 'buffalo', 'toned'];
const MILK_TYPE_LABELS = {
  cow: 'Cow Milk',
  buffalo: 'Buffalo Milk',
  toned: 'Child Pack (Toned Milk)',
};
const MILK_TYPE_SHORT_LABELS = { cow: 'Cow Milk', buffalo: 'Buffalo Milk', toned: 'Child Pack' };

// `bounds` rejects obviously mistyped values; REFERENCE_RANGES below are the
// typical ranges shown to customers. Lactometer ranges follow the published
// YaduONE lactometer guide (cow 26–30, buffalo 28–32). `decimals` is the
// minimum shown, so 5 reads as "5.0%".
const PARAMETERS = [
  { key: 'fat', label: 'Fat', unit: '%', bounds: [0, 15], decimals: 1 },
  { key: 'snf', label: 'SNF (Solids-Not-Fat)', unit: '%', bounds: [0, 15], decimals: 1 },
  { key: 'lactose', label: 'Lactose', unit: '%', bounds: [0, 10], decimals: 1 },
  { key: 'protein', label: 'Protein', unit: '%', bounds: [0, 10], decimals: 1 },
  { key: 'lactometer', label: 'Lactometer Reading', unit: '°LR', bounds: [0, 45], decimals: 0 },
  { key: 'ph', label: 'pH', unit: '', bounds: [0, 14], decimals: 1 },
];

const REFERENCE_RANGES = {
  cow: {
    fat: [3.5, 5.0], snf: [8.5, 9.5], lactose: [4.4, 5.0],
    protein: [3.0, 3.6], lactometer: [26, 30], ph: [6.6, 6.8],
  },
  buffalo: {
    fat: [6.0, 8.0], snf: [9.0, 10.0], lactose: [4.5, 5.2],
    protein: [3.5, 4.5], lactometer: [28, 32], ph: [6.6, 6.8],
  },
  toned: {
    fat: [3.0, 3.5], snf: [8.5, 9.0], lactose: [4.4, 5.0],
    protein: [3.0, 3.5], lactometer: [26, 30], ph: [6.6, 6.8],
  },
};

const TESTS = [
  { key: 'added_water', label: 'Added Water' },
  { key: 'urea', label: 'Urea' },
  { key: 'starch', label: 'Starch' },
  { key: 'detergent', label: 'Detergent' },
  { key: 'neutralizer', label: 'Neutralizers' },
  { key: 'formalin', label: 'Formalin' },
];

const TEST_RESULT_LABELS = {
  negative: 'Not detected',
  positive: 'Detected',
  not_tested: 'Not tested',
};

const GRADES = {
  excellent: 'Excellent',
  good: 'Good',
  satisfactory: 'Satisfactory',
};

const STATUS_LABELS = {
  ok: 'Within range',
  low: 'Below range',
  high: 'Above range',
  not_tested: 'Not tested',
};

const USER_LOOKBACK_DAYS = 7;
const ADMIN_HISTORY_DAYS = 14;
const PDF_TOKEN_TTL = '2h';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function meta() {
  return {
    milk_types: MILK_TYPES.map((key) => ({ key, label: MILK_TYPE_LABELS[key] })),
    parameters: PARAMETERS.map(({ key, label, unit, bounds }) => ({ key, label, unit, min: bounds[0], max: bounds[1] })),
    reference_ranges: REFERENCE_RANGES,
    tests: TESTS,
    test_results: TEST_RESULT_LABELS,
    grades: GRADES,
  };
}

function reportId(areaId, date) {
  return `${areaId}_${date}`;
}

function isValidDate(date) {
  return typeof date === 'string' && DATE_RE.test(date) && dateUtil.parseDate(date).isValid();
}

/** Dates from `endDate` going back `days` days, newest first. */
function dateWindow(endDate, days) {
  const end = dateUtil.parseDate(endDate);
  return Array.from({ length: days }, (_, i) => end.clone().subtract(i, 'days').format('YYYY-MM-DD'));
}

function trimmed(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function parseNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Validate and normalize an admin's report payload.
 * Returns { errors: string[], data } — `data` is only meaningful when there are no errors.
 */
function normalizeReportInput(body = {}) {
  const errors = [];

  const rawSamples = Array.isArray(body.samples) ? body.samples : [];
  if (rawSamples.length === 0) errors.push('Add results for at least one milk variety');

  const seen = new Set();
  const samples = [];
  for (const raw of rawSamples) {
    const milkType = String(raw?.milk_type || '');
    if (!MILK_TYPES.includes(milkType)) {
      errors.push(`Unknown milk variety "${milkType}"`);
      continue;
    }
    if (seen.has(milkType)) {
      errors.push(`${MILK_TYPE_LABELS[milkType]} is listed more than once`);
      continue;
    }
    seen.add(milkType);

    const sample = { milk_type: milkType };
    let filled = 0;
    for (const { key, label, bounds } of PARAMETERS) {
      const n = parseNumber(raw[key]);
      if (Number.isNaN(n)) {
        errors.push(`${MILK_TYPE_LABELS[milkType]}: ${label} must be a number`);
        sample[key] = null;
        continue;
      }
      if (n !== null && (n < bounds[0] || n > bounds[1])) {
        errors.push(`${MILK_TYPE_LABELS[milkType]}: ${label} must be between ${bounds[0]} and ${bounds[1]}`);
      }
      sample[key] = n === null ? null : Math.round(n * 100) / 100;
      if (n !== null) filled += 1;
    }
    if (filled === 0) errors.push(`${MILK_TYPE_LABELS[milkType]}: enter at least one test result`);
    samples.push(sample);
  }
  // Keep a stable order regardless of how the admin added them.
  samples.sort((a, b) => MILK_TYPES.indexOf(a.milk_type) - MILK_TYPES.indexOf(b.milk_type));

  const rawTests = body.tests && typeof body.tests === 'object' ? body.tests : {};
  const tests = {};
  for (const { key, label } of TESTS) {
    const result = rawTests[key] === undefined || rawTests[key] === '' ? 'not_tested' : String(rawTests[key]);
    if (!TEST_RESULT_LABELS[result]) errors.push(`${label}: result must be negative, positive or not_tested`);
    tests[key] = result;
  }

  let grade = body.grade === undefined || body.grade === null || body.grade === '' ? null : String(body.grade);
  if (grade !== null && !GRADES[grade]) {
    errors.push('grade must be excellent, good or satisfactory');
    grade = null;
  }

  const sampleTime = trimmed(body.sample_time, 5);
  if (sampleTime && !TIME_RE.test(sampleTime)) errors.push('sample_time must be HH:mm');

  return {
    errors,
    data: {
      samples,
      tests,
      grade,
      tested_by: trimmed(body.tested_by, 80),
      sample_time: sampleTime,
      notes: trimmed(body.notes, 600),
      published: body.published === true || body.published === 'true',
    },
  };
}

function rangeStatus(value, range) {
  if (value === null || value === undefined) return 'not_tested';
  if (!range) return 'ok';
  if (value < range[0]) return 'low';
  if (value > range[1]) return 'high';
  return 'ok';
}

function formatNumber(value, minDecimals = 0) {
  const text = Number(value.toFixed(2)).toString();
  const [whole, frac = ''] = text.split('.');
  return frac.length >= minDecimals ? text : `${whole}.${frac.padEnd(minDecimals, '0')}`;
}

function withUnit(text, unit) {
  if (!unit) return text;
  return unit === '%' ? `${text}%` : `${text} ${unit}`;
}

function toIso(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return typeof ts === 'string' ? ts : null;
}

/**
 * Expand a stored report into what clients render: per-parameter display
 * strings, reference ranges and in/out-of-range status, plus a summary.
 */
function decorateReport(id, data) {
  if (!data) return null;

  let tested = 0;
  let inRange = 0;
  const samples = (data.samples || []).map((sample) => {
    const ranges = REFERENCE_RANGES[sample.milk_type] || {};
    const values = {};
    let sampleTested = 0;
    let sampleInRange = 0;
    const parameters = PARAMETERS.map(({ key, label, unit, decimals }) => {
      const value = sample[key] ?? null;
      values[key] = value;
      const range = ranges[key] || null;
      const status = rangeStatus(value, range);
      if (status !== 'not_tested') sampleTested += 1;
      if (status === 'ok') sampleInRange += 1;
      return {
        key,
        label,
        unit,
        value,
        display: value === null ? '—' : withUnit(formatNumber(value, decimals), unit),
        reference: range ? { min: range[0], max: range[1] } : null,
        reference_display: range
          ? withUnit(`${formatNumber(range[0], decimals)} – ${formatNumber(range[1], decimals)}`, unit)
          : '—',
        status,
        status_label: STATUS_LABELS[status],
      };
    });
    tested += sampleTested;
    inRange += sampleInRange;
    return {
      milk_type: sample.milk_type,
      label: MILK_TYPE_LABELS[sample.milk_type] || sample.milk_type,
      short_label: MILK_TYPE_SHORT_LABELS[sample.milk_type] || sample.milk_type,
      values,
      parameters,
      tested: sampleTested,
      in_range: sampleInRange,
    };
  });

  const tests = {};
  const testResults = TESTS.map(({ key, label }) => {
    const result = data.tests?.[key] || 'not_tested';
    tests[key] = result;
    return { key, label, result, result_label: TEST_RESULT_LABELS[result] || result };
  });
  const testsDone = testResults.filter((t) => t.result !== 'not_tested').length;
  const testsFlagged = testResults.filter((t) => t.result === 'positive').length;

  return {
    id,
    area_id: data.area_id,
    date: data.date,
    published: data.published === true,
    grade: data.grade || null,
    grade_label: data.grade ? GRADES[data.grade] || null : null,
    tested_by: data.tested_by || '',
    sample_time: data.sample_time || '',
    notes: data.notes || '',
    samples,
    tests,
    test_results: testResults,
    summary: {
      parameters_tested: tested,
      parameters_in_range: inRange,
      tests_done: testsDone,
      tests_flagged: testsFlagged,
      tests_clear: testsDone > 0 && testsFlagged === 0,
    },
    updated_at: toIso(data.updated_at),
    published_at: toIso(data.published_at),
  };
}

async function getReport(areaId, date) {
  const id = reportId(areaId, date);
  const doc = await db.collection(COLLECTION).doc(id).get();
  return doc.exists ? decorateReport(id, doc.data()) : null;
}

async function saveReport(areaId, date, data, adminId) {
  const ref = db.collection(COLLECTION).doc(reportId(areaId, date));
  const existing = await ref.get();
  const prev = existing.exists ? existing.data() : null;
  const now = admin.firestore.FieldValue.serverTimestamp();

  const record = {
    ...data,
    area_id: areaId,
    date,
    created_at: prev?.created_at || now,
    created_by: prev?.created_by || adminId || null,
    updated_at: now,
    updated_by: adminId || null,
    // First publish time survives later edits; unpublishing clears it.
    published_at: data.published ? (prev?.published_at || now) : null,
  };
  await ref.set(record);
  const saved = await ref.get();
  return decorateReport(ref.id, saved.data());
}

async function deleteReport(areaId, date) {
  const ref = db.collection(COLLECTION).doc(reportId(areaId, date));
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}

/** Most recent published report for the area within the last week, or null. */
async function getLatestPublished(areaId, today = dateUtil.today()) {
  const dates = dateWindow(today, USER_LOOKBACK_DAYS);
  const docs = await Promise.all(dates.map((d) => db.collection(COLLECTION).doc(reportId(areaId, d)).get()));
  const hit = docs.find((doc) => doc.exists && doc.data().published === true);
  return hit ? decorateReport(hit.id, hit.data()) : null;
}

/** One row per day for the admin's history strip, newest first. */
async function listRecent(areaId, today = dateUtil.today()) {
  const dates = dateWindow(today, ADMIN_HISTORY_DAYS);
  const docs = await Promise.all(dates.map((d) => db.collection(COLLECTION).doc(reportId(areaId, d)).get()));
  return dates.map((date, i) => {
    const doc = docs[i];
    if (!doc.exists) return { date, exists: false, published: false, grade: null };
    const data = doc.data();
    return { date, exists: true, published: data.published === true, grade: data.grade || null };
  });
}

async function getAreaName(areaId) {
  if (!areaId) return '';
  const doc = await db.collection('areas').doc(areaId).get();
  return doc.exists ? doc.data().name || '' : '';
}

// ── PDF download links ───────────────────────────────────────────────────────
// The app opens the PDF in the phone's browser, which cannot send the user's
// Firebase token, so the link carries a short-lived signed token instead.
// The key is derived from JWT_SECRET but distinct from it, so a PDF token can
// never pass `authenticateAdmin`.
function pdfKey() {
  return crypto.createHmac('sha256', config.jwt.secret).update('milk-quality-pdf').digest();
}

function signPdfToken(id) {
  return jwt.sign({ rid: id }, pdfKey(), { expiresIn: PDF_TOKEN_TTL });
}

function verifyPdfToken(token) {
  try {
    const decoded = jwt.verify(String(token || ''), pdfKey());
    return typeof decoded.rid === 'string' ? decoded.rid : null;
  } catch {
    return null;
  }
}

async function getReportById(id) {
  const doc = await db.collection(COLLECTION).doc(id).get();
  return doc.exists ? decorateReport(id, doc.data()) : null;
}

module.exports = {
  COLLECTION,
  MILK_TYPES,
  PARAMETERS,
  REFERENCE_RANGES,
  TESTS,
  GRADES,
  meta,
  reportId,
  isValidDate,
  normalizeReportInput,
  decorateReport,
  getReport,
  getReportById,
  saveReport,
  deleteReport,
  getLatestPublished,
  listRecent,
  getAreaName,
  signPdfToken,
  verifyPdfToken,
};
