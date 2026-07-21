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
  // How long a placed order may sit unacknowledged before the expiry job
  // auto-rejects it. 0 disables auto-expiry entirely.
  auto_expire_minutes: 10,
  // How long the customer may cancel their own order:
  //   until_delivery   — any time before it is marked delivered (default)
  //   until_acceptance — only while the store has not accepted it yet
  //   disabled         — customers cannot cancel; they must call the store
  customer_cancel_window: 'until_delivery',
  // Picklist the admin chooses from when rejecting an order. The admin may also
  // type a free-form reason; these are just the one-tap options.
  rejection_reasons: [
    'Item out of stock',
    'Outside delivery range',
    'No rider available',
    'Store closing soon',
  ],
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
  const auto_expire_minutes = Number(raw?.auto_expire_minutes);
  const reasons = Array.isArray(raw?.rejection_reasons)
    ? raw.rejection_reasons
      .map((r) => String(r || '').trim())
      .filter(Boolean)
      .slice(0, 12)
    : null;

  const CANCEL_WINDOWS = ['until_delivery', 'until_acceptance', 'disabled'];
  const customer_cancel_window = CANCEL_WINDOWS.includes(raw?.customer_cancel_window)
    ? raw.customer_cancel_window
    : DEFAULTS.customer_cancel_window;

  return {
    enabled: raw?.enabled !== false,
    customer_cancel_window,
    start_time,
    end_time,
    eta_minutes: Number.isFinite(eta_minutes) && eta_minutes > 0 ? Math.round(eta_minutes) : DEFAULTS.eta_minutes,
    // >= 0 so an admin can switch auto-expiry off with 0 without falling back
    // to the default.
    auto_expire_minutes: Number.isFinite(auto_expire_minutes) && auto_expire_minutes >= 0
      ? Math.round(auto_expire_minutes)
      : DEFAULTS.auto_expire_minutes,
    rejection_reasons: reasons && reasons.length ? reasons : [...DEFAULTS.rejection_reasons],
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

/** '21:00' → '9:00 PM' — the app and admin panel both display 12-hour time. */
function formatDisplayTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Is instant delivery currently accepting orders?
 *
 * Returns the config plus enough window context for the client to render the
 * "open 8:00 AM – 9:00 PM" banner and a closing-soon countdown, so the customer
 * learns the window up front rather than by hitting an error at checkout.
 */
async function checkAvailability() {
  const hours = await getHours();
  const startMinutes = toMinutes(hours.start_time);
  const endMinutes = toMinutes(hours.end_time);

  const window = {
    start_time: hours.start_time,
    end_time: hours.end_time,
    start_time_display: formatDisplayTime(hours.start_time),
    end_time_display: formatDisplayTime(hours.end_time),
    label: `${formatDisplayTime(hours.start_time)} – ${formatDisplayTime(hours.end_time)}`,
  };

  if (!hours.enabled) {
    return { available: false, reason: 'closed', hours, window, minutes_until_close: null, minutes_until_open: null };
  }

  const now = dateUtil.now();
  const nowMinutes = now.hours() * 60 + now.minutes();
  const available = nowMinutes >= startMinutes && nowMinutes < endMinutes;

  return {
    available,
    reason: available ? null : 'outside_hours',
    hours,
    window,
    minutes_until_close: available ? endMinutes - nowMinutes : null,
    // Before opening: minutes to go today. After closing: minutes until tomorrow's open.
    minutes_until_open: available
      ? null
      : (nowMinutes < startMinutes ? startMinutes - nowMinutes : (24 * 60 - nowMinutes) + startMinutes),
  };
}

module.exports = {
  DEFAULTS,
  getHours,
  updateHours,
  checkAvailability,
  toMinutes,
  formatDisplayTime,
};
