const { db, admin } = require('../../config/firebase');

// Admin-configured "what is the newest build on the Play Store" record. The app
// sends the build number it is running and we tell it whether to nag, or to
// block until the user updates. Keeping the comparison server-side means the
// cutoff can be moved without shipping a new build.
const COLLECTION = 'settings';
const DOC_ID = 'app_version';

const PACKAGE_NAME = 'in.yaduone.app';

const DEFAULTS = {
  enabled: true,
  // Newest build published to the Play Store (pubspec `version: x.y.z+BUILD`).
  latest_version: '1.0.12',
  latest_build: 22,
  // Builds below this are refused entry — the dialog cannot be dismissed.
  min_build: 0,
  release_notes: '',
  store_url: `https://play.google.com/store/apps/details?id=${PACKAGE_NAME}`,
};

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function normalize(raw) {
  const latest_build = toInt(raw?.latest_build, DEFAULTS.latest_build);
  const min_build = toInt(raw?.min_build, DEFAULTS.min_build);

  if (min_build > latest_build) {
    throw Object.assign(
      new Error('min_build cannot be greater than latest_build'),
      { statusCode: 400 }
    );
  }

  return {
    enabled: raw?.enabled !== false,
    latest_version:
      typeof raw?.latest_version === 'string' && raw.latest_version.trim()
        ? raw.latest_version.trim()
        : DEFAULTS.latest_version,
    latest_build,
    min_build,
    release_notes:
      typeof raw?.release_notes === 'string' ? raw.release_notes.trim() : '',
    store_url:
      typeof raw?.store_url === 'string' && raw.store_url.startsWith('http')
        ? raw.store_url.trim()
        : DEFAULTS.store_url,
  };
}

async function getSettings() {
  const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!doc.exists) return { ...DEFAULTS };
  return normalize(doc.data());
}

async function updateSettings(body, adminId) {
  const next = normalize(body);
  await db.collection(COLLECTION).doc(DOC_ID).set(
    {
      ...next,
      updated_by: adminId || null,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return next;
}

// Compares the caller's build against the configured one. `build` is the
// Android versionCode / iOS build number, which is monotonic — unlike the
// display version, it never needs string parsing to order correctly.
async function checkForUpdate(currentBuild) {
  const settings = await getSettings();
  const build = toInt(currentBuild, null);

  // Unknown or disabled → never prompt. A missing build number means we cannot
  // compare safely, and a false "update available" is worse than staying quiet.
  if (build === null || !settings.enabled) {
    return {
      update_available: false,
      force_update: false,
      latest_version: settings.latest_version,
      latest_build: settings.latest_build,
      release_notes: settings.release_notes,
      store_url: settings.store_url,
    };
  }

  return {
    update_available: build < settings.latest_build,
    force_update: build < settings.min_build,
    current_build: build,
    latest_version: settings.latest_version,
    latest_build: settings.latest_build,
    release_notes: settings.release_notes,
    store_url: settings.store_url,
  };
}

module.exports = {
  DEFAULTS,
  PACKAGE_NAME,
  normalize,
  getSettings,
  updateSettings,
  checkForUpdate,
};
