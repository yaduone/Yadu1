const { db, admin } = require('../../config/firebase');

// Admin-configurable Gmail email alerts. Right now the only trigger is a new
// instant order, but the shape leaves room for more toggles later.
//
// The Gmail account credentials themselves live in env vars (GMAIL_USER /
// GMAIL_APP_PASSWORD) — never in Firestore — so this doc only carries the
// on/off switch and the list of people who should receive the alert.
const COLLECTION = 'settings';
const DOC_ID = 'email_notifications';

const DEFAULTS = {
  // Master switch. Even with recipients configured, nothing is sent when false.
  enabled: false,
  // Send an email every time a customer places an instant order.
  instant_order_created: true,
  // Who gets the alert. Empty list ⇒ nothing is sent.
  recipients: [],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalize(raw) {
  const recipients = Array.isArray(raw?.recipients)
    ? [...new Set(
      raw.recipients
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e))
    )].slice(0, 20)
    : [];

  return {
    enabled: raw?.enabled === true,
    instant_order_created: raw?.instant_order_created !== false,
    recipients,
  };
}

async function getConfig() {
  const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) return { ...DEFAULTS };
  return normalize(doc.data());
}

async function updateConfig(raw, adminId) {
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

module.exports = {
  DEFAULTS,
  getConfig,
  updateConfig,
};
