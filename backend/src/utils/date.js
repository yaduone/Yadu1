const moment = require('moment-timezone');
const config = require('../config');

/**
 * Get current moment in configured timezone.
 */
function now() {
  return moment.tz(config.timezone);
}

/**
 * Get today's date string (YYYY-MM-DD) in configured timezone.
 */
function today() {
  return now().format('YYYY-MM-DD');
}

/**
 * Get tomorrow's date string (YYYY-MM-DD) in configured timezone.
 */
function tomorrow() {
  return now().add(1, 'day').format('YYYY-MM-DD');
}

/**
 * Get day-after-tomorrow's date string (YYYY-MM-DD) in configured timezone.
 */
function dayAfterTomorrow() {
  return now().add(2, 'days').format('YYYY-MM-DD');
}

/**
 * Return the target delivery date for cart modifications.
 * Before cutoff → tomorrow; after cutoff → day after tomorrow.
 */
function cartTargetDate() {
  return isPastCutoff() ? dayAfterTomorrow() : tomorrow();
}

/**
 * Check if current time is past the cutoff hour for tomorrow's modifications.
 */
function isPastCutoff() {
  return now().hour() >= config.manifestCutoffHour;
}

/**
 * Check if current time is past the cron hour — i.e. the nightly job has run.
 * Manifests for the next day are only valid/downloadable after this point.
 */
function isPastCronHour() {
  return now().hour() >= config.manifestCronHour;
}

/**
 * Return the next-day manifest window info:
 *  - deliveryDate: the date the manifest covers (tomorrow)
 *  - isReady: whether the cron has already run today (manifest should exist)
 *  - cronHour: the hour at which it becomes ready
 */
function nextDayManifestWindow() {
  const current = now();
  return {
    deliveryDate: tomorrow(),
    isReady: current.hour() >= config.manifestCronHour,
    cronHour: config.manifestCronHour,
    cronTime: `${String(config.manifestCronHour).padStart(2, '0')}:00`,
  };
}

/**
 * Parse a date string to moment in configured timezone.
 */
function parseDate(dateStr) {
  return moment.tz(dateStr, 'YYYY-MM-DD', config.timezone);
}

/**
 * Format a Firestore timestamp to date string.
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return null;
  return moment(timestamp.toDate()).tz(config.timezone).format('YYYY-MM-DD HH:mm:ss');
}

module.exports = { now, today, tomorrow, dayAfterTomorrow, cartTargetDate, isPastCutoff, isPastCronHour, nextDayManifestWindow, parseDate, formatTimestamp };
