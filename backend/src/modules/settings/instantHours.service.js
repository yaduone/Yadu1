const { db, admin } = require('../../config/firebase');
const dateUtil = require('../../utils/date');

// Admin-configured daily availability window for instant delivery, plus the
// promised delivery time shown to customers ("delivered within N minutes").
const COLLECTION = 'settings';
const DOC_ID = 'instant_hours';

const DEFAULTS = {
  enabled: true,
  start_time: '08:00',
  end_time: '21:00',
  eta_minutes: 30,
};

function isValidTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function normalize(raw) {
  const start_time = isValidTime(raw?.start_time) ? raw.start_time : DEFAULTS.start_time;
  const end_time = isValidTime(raw?.end_time) ? raw.end_time : DEFAULTS.end_time;
  if (toMinutes(start_time) >= toMinutes(end_time)) {
    throw Object.assign(new Error('start_time must be before end_time'), { statusCode: 400 });
  }
  const eta_minutes = Number(raw?.eta_minutes);
  return {
    enabled: raw?.enabled !== false,
    start_time,
    end_time,
    eta_minutes: Number.isFinite(eta_minutes) && eta_minutes > 0 ? Math.round(eta_minutes) : DEFAULTS.eta_minutes,
  };
}

async function getHours() {
  const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) return { ...DEFAULTS };
  return normalize(doc.data());
}

async function updateHours(raw, adminId) {
  const normalized = normalize(raw);
  await db.collection(COLLECTION).doc(DOC_ID).set(
    {
      ...normalized,
      updated_by: adminId || null,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return normalized;
}

/**
 * Is instant delivery currently accepting orders?
 * Returns the config too so callers can build a useful error message.
 */
async function checkAvailability() {
  const hours = await getHours();
  if (!hours.enabled) {
    return { available: false, reason: 'closed', hours };
  }
  const nowMinutes = dateUtil.now().hours() * 60 + dateUtil.now().minutes();
  const available = nowMinutes >= toMinutes(hours.start_time) && nowMinutes < toMinutes(hours.end_time);
  return { available, reason: available ? null : 'outside_hours', hours };
}

module.exports = {
  DEFAULTS,
  getHours,
  updateHours,
  checkAvailability,
  toMinutes,
};
