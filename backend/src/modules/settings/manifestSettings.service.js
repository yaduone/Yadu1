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
    area_doc_id: areaId,
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

async function findAreaDocByIdOrSlug(areaId) {
  if (!areaId || typeof areaId !== 'string') return null;

  const directDoc = await db.collection('areas').doc(areaId).get();
  if (directDoc.exists) return directDoc;

  const slugSnap = await db
    .collection('areas')
    .where('slug', '==', areaId)
    .limit(1)
    .get();
  if (!slugSnap.empty) return slugSnap.docs[0];

  return null;
}

function settingsFromAreaDoc(areaDocId, area = {}, requestedAreaId = areaDocId) {
  const fallback = defaultSettings(requestedAreaId);
  return {
    area_id: requestedAreaId,
    area_doc_id: areaDocId,
    area_name: area.name || null,
    cutoff_time: area.manifest_cutoff_time || fallback.cutoff_time,
    generation_time: area.manifest_generation_time || fallback.generation_time,
    timezone: config.timezone,
    is_default: !area.manifest_cutoff_time && !area.manifest_generation_time,
    is_area_record_missing: false,
  };
}

async function getAreaManifestSettings(areaId) {
  const areaDoc = await findAreaDocByIdOrSlug(areaId);
  if (!areaDoc) {
    return {
      ...defaultSettings(areaId),
      area_doc_id: null,
      area_name: null,
      is_default: true,
      is_area_record_missing: true,
    };
  }

  return settingsFromAreaDoc(areaDoc.id, areaDoc.data(), areaId);
}

async function updateAreaManifestSettings(areaId, { cutoff_time, generation_time }, adminId) {
  const cutoffTime = normalizeTime(cutoff_time, 'cutoff_time');
  const generationTime = normalizeTime(generation_time, 'generation_time');

  if (minutesFromTime(generationTime) < minutesFromTime(cutoffTime)) {
    throw Object.assign(new Error('generation_time must be the same as or after cutoff_time'), { statusCode: 400 });
  }

  const areaDoc = await findAreaDocByIdOrSlug(areaId);
  if (!areaDoc) {
    throw Object.assign(new Error('Area not found'), { statusCode: 404 });
  }

  await areaDoc.ref.update({
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
  findAreaDocByIdOrSlug,
  settingsFromAreaDoc,
  getAreaManifestSettings,
  updateAreaManifestSettings,
  cartTargetDateFromSettings,
  getCartTargetDate,
  isPastCutoff,
  getNextDayManifestWindow,
};
