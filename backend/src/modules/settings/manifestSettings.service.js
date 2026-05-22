const { db, admin } = require('../../config/firebase');
const config = require('../../config');
const dateUtil = require('../../utils/date');

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function defaultTime(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

function defaultSettings(areaId = null) {
  return {
    area_id: areaId,
    cutoff_time: defaultTime(config.manifestCutoffHour),
    generation_time: defaultTime(config.manifestCronHour),
    timezone: config.timezone,
  };
}

function normalizeTime(value, fieldName) {
  if (typeof value !== 'string' || !TIME_RE.test(value)) {
    throw Object.assign(new Error(`${fieldName} must be in HH:mm 24-hour format`), { statusCode: 400 });
  }
  return value;
}

function minutesFromTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function currentMinutes(current = dateUtil.now()) {
  return current.hour() * 60 + current.minute();
}

function isAtOrPast(time, current = dateUtil.now()) {
  return currentMinutes(current) >= minutesFromTime(time);
}

function isExactMinute(time, current = dateUtil.now()) {
  return current.format('HH:mm') === time;
}

function settingsFromAreaDoc(areaId, area = {}) {
  const fallback = defaultSettings(areaId);
  return {
    area_id: areaId,
    cutoff_time: area.manifest_cutoff_time || fallback.cutoff_time,
    generation_time: area.manifest_generation_time || fallback.generation_time,
    timezone: config.timezone,
  };
}

async function getAreaManifestSettings(areaId) {
  const areaDoc = await db.collection('areas').doc(areaId).get();
  if (!areaDoc.exists) {
    throw Object.assign(new Error('Area not found'), { statusCode: 404 });
  }

  return settingsFromAreaDoc(areaDoc.id, areaDoc.data());
}

async function updateAreaManifestSettings(areaId, { cutoff_time, generation_time }, adminId) {
  const cutoffTime = normalizeTime(cutoff_time, 'cutoff_time');
  const generationTime = normalizeTime(generation_time, 'generation_time');

  if (minutesFromTime(generationTime) < minutesFromTime(cutoffTime)) {
    throw Object.assign(new Error('generation_time must be the same as or after cutoff_time'), { statusCode: 400 });
  }

  const areaRef = db.collection('areas').doc(areaId);
  const areaDoc = await areaRef.get();
  if (!areaDoc.exists) {
    throw Object.assign(new Error('Area not found'), { statusCode: 404 });
  }

  await areaRef.update({
    manifest_cutoff_time: cutoffTime,
    manifest_generation_time: generationTime,
    manifest_schedule_updated_by: adminId || null,
    manifest_schedule_updated_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return getAreaManifestSettings(areaId);
}

function cartTargetDateFromSettings(settings, current = dateUtil.now()) {
  return isAtOrPast(settings.cutoff_time, current)
    ? dateUtil.dayAfterTomorrow()
    : dateUtil.tomorrow();
}

async function getCartTargetDate(areaId) {
  const settings = await getAreaManifestSettings(areaId);
  return cartTargetDateFromSettings(settings);
}

async function isPastCutoff(areaId) {
  const settings = await getAreaManifestSettings(areaId);
  return isAtOrPast(settings.cutoff_time);
}

async function getNextDayManifestWindow(areaId) {
  const settings = await getAreaManifestSettings(areaId);
  return {
    deliveryDate: dateUtil.tomorrow(),
    isReady: isAtOrPast(settings.generation_time),
    cutoffTime: settings.cutoff_time,
    cronTime: settings.generation_time,
    generationTime: settings.generation_time,
    timezone: settings.timezone,
  };
}

module.exports = {
  defaultSettings,
  normalizeTime,
  minutesFromTime,
  isAtOrPast,
  isExactMinute,
  settingsFromAreaDoc,
  getAreaManifestSettings,
  updateAreaManifestSettings,
  cartTargetDateFromSettings,
  getCartTargetDate,
  isPastCutoff,
  getNextDayManifestWindow,
};
