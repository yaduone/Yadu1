const moment = require('moment-timezone');
const { db, admin } = require('../../config/firebase');
const config = require('../../config');
const { isValidYoutubeUrl } = require('../../utils/validators');
const notificationService = require('../notifications/notification.service');

const STREAM_SLOTS = ['morning', 'evening'];
const REMINDER_LEAD_MINUTES = 30;
const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 240;

function serviceError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function dateFromValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toTimestamp(date) {
  return admin.firestore.Timestamp.fromDate(date);
}

function slotLabel(slot) {
  return slot === 'evening' ? 'Evening' : 'Morning';
}

function formattedScheduleTime(date) {
  return moment(date).tz(config.timezone).format('h:mm A [on] D MMM');
}

function currentStatus(data, now = new Date()) {
  if (data.status === 'cancelled') return 'cancelled';

  const start = dateFromValue(data.scheduled_start_at);
  const end = dateFromValue(data.scheduled_end_at);
  if (!start || !end) return data.is_active ? 'live' : (data.status || 'inactive');
  if (now >= end) return 'completed';
  if (now >= start) return 'live';
  return 'scheduled';
}

function serialiseStream(id, data, { includeUrl = true, now = new Date() } = {}) {
  const stream = {
    id,
    ...data,
    status: currentStatus(data, now),
    is_active: currentStatus(data, now) === 'live',
    scheduled_start_at: dateFromValue(data.scheduled_start_at)?.toISOString() || null,
    scheduled_end_at: dateFromValue(data.scheduled_end_at)?.toISOString() || null,
    reminder_at: dateFromValue(data.reminder_at)?.toISOString() || null,
    created_at: dateFromValue(data.created_at)?.toISOString() || data.created_at || null,
    updated_at: dateFromValue(data.updated_at)?.toISOString() || data.updated_at || null,
  };

  if (!includeUrl) delete stream.youtube_url;
  return stream;
}

function parseSchedule(input, { now = new Date(), enforceLeadTime = true } = {}) {
  if (!STREAM_SLOTS.includes(input.slot)) {
    throw serviceError('slot must be "morning" or "evening"');
  }
  if (!input.youtube_url || !isValidYoutubeUrl(input.youtube_url)) {
    throw serviceError('A valid YouTube URL is required');
  }

  const start = dateFromValue(input.scheduled_start_at);
  if (!start) throw serviceError('scheduled_start_at must be a valid date and time');

  const durationMinutes = Number.parseInt(input.duration_minutes, 10);
  if (!Number.isInteger(durationMinutes) ||
      durationMinutes < MIN_DURATION_MINUTES ||
      durationMinutes > MAX_DURATION_MINUTES) {
    throw serviceError(`duration_minutes must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}`);
  }

  const minimumStart = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60 * 1000);
  if (enforceLeadTime && start < minimumStart) {
    throw serviceError('Schedule the live stream at least 30 minutes in advance so users can be notified');
  }

  return {
    title: input.title?.trim() || `${slotLabel(input.slot)} Slot Live Stream`,
    youtube_url: input.youtube_url.trim(),
    slot: input.slot,
    scheduledStart: start,
    scheduledEnd: new Date(start.getTime() + durationMinutes * 60 * 1000),
    durationMinutes,
  };
}

async function rejectOverlappingStream(areaId, start, end, excludedId = null) {
  const snap = await db.collection('livestreams').where('area_id', '==', areaId).get();
  const conflict = snap.docs.some((doc) => {
    if (doc.id === excludedId) return false;
    const data = doc.data();
    if (data.status === 'cancelled') return false;
    const existingStart = dateFromValue(data.scheduled_start_at);
    const existingEnd = dateFromValue(data.scheduled_end_at);
    if (!existingStart || !existingEnd) return data.is_active === true;
    return start < existingEnd && end > existingStart;
  });

  if (conflict) {
    throw serviceError('Another live stream is already scheduled during this time window', 409);
  }
}

async function createScheduledStream(areaId, adminId, input, now = new Date()) {
  const schedule = parseSchedule(input, { now });
  await rejectOverlappingStream(areaId, schedule.scheduledStart, schedule.scheduledEnd);

  const data = {
    area_id: areaId,
    title: schedule.title,
    youtube_url: schedule.youtube_url,
    slot: schedule.slot,
    scheduled_start_at: toTimestamp(schedule.scheduledStart),
    scheduled_end_at: toTimestamp(schedule.scheduledEnd),
    reminder_at: toTimestamp(new Date(schedule.scheduledStart.getTime() - REMINDER_LEAD_MINUTES * 60 * 1000)),
    duration_minutes: schedule.durationMinutes,
    start_mode: 'scheduled',
    status: 'scheduled',
    is_active: false,
    created_by: adminId,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ref = await db.collection('livestreams').add(data);
  return serialiseStream(ref.id, data, { now });
}

async function createImmediateStream(areaId, adminId, input, now = new Date()) {
  const schedule = parseSchedule({
    ...input,
    scheduled_start_at: now,
  }, { now, enforceLeadTime: false });
  await rejectOverlappingStream(areaId, schedule.scheduledStart, schedule.scheduledEnd);

  const data = {
    area_id: areaId,
    title: schedule.title,
    youtube_url: schedule.youtube_url,
    slot: schedule.slot,
    scheduled_start_at: toTimestamp(schedule.scheduledStart),
    scheduled_end_at: toTimestamp(schedule.scheduledEnd),
    reminder_at: null,
    duration_minutes: schedule.durationMinutes,
    start_mode: 'immediate',
    status: 'live',
    is_active: true,
    created_by: adminId,
    started_at: admin.firestore.FieldValue.serverTimestamp(),
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ref = await db.collection('livestreams').add(data);
  await sendStartedNotification(ref, ref.id, data, schedule.scheduledStart);
  return serialiseStream(ref.id, data, { now });
}

async function createStream(areaId, adminId, input, now = new Date()) {
  const startMode = input.start_mode || 'scheduled';
  if (startMode === 'scheduled') {
    return createScheduledStream(areaId, adminId, input, now);
  }
  if (startMode === 'immediate') {
    return createImmediateStream(areaId, adminId, input, now);
  }
  throw serviceError('start_mode must be "scheduled" or "immediate"');
}

async function listAreaStreams(areaId, now = new Date()) {
  const snap = await db.collection('livestreams').where('area_id', '==', areaId).get();
  return snap.docs
    .map((doc) => serialiseStream(doc.id, doc.data(), { now }))
    .sort((a, b) => {
      const aTime = new Date(a.scheduled_start_at || a.created_at || 0);
      const bTime = new Date(b.scheduled_start_at || b.created_at || 0);
      return bTime - aTime;
    });
}

async function getViewerStreams(areaId, now = new Date()) {
  const snap = await db.collection('livestreams').where('area_id', '==', areaId).get();
  const docs = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));

  const active = docs
    .filter(({ data }) => currentStatus(data, now) === 'live')
    .sort((a, b) => {
      const aStart = dateFromValue(a.data.scheduled_start_at)?.getTime() || 0;
      const bStart = dateFromValue(b.data.scheduled_start_at)?.getTime() || 0;
      return bStart - aStart;
    })[0] || null;

  const upcoming = docs
    .filter(({ data }) => currentStatus(data, now) === 'scheduled')
    .sort((a, b) => dateFromValue(a.data.scheduled_start_at) - dateFromValue(b.data.scheduled_start_at))[0] || null;

  return {
    livestream: active ? serialiseStream(active.id, active.data, { now }) : null,
    upcoming: upcoming ? serialiseStream(upcoming.id, upcoming.data, { includeUrl: false, now }) : null,
  };
}

async function updateScheduledStream(id, areaId, input, now = new Date()) {
  const ref = db.collection('livestreams').doc(id);
  const doc = await ref.get();
  if (!doc.exists || doc.data().area_id !== areaId) {
    throw serviceError('Livestream not found', 404);
  }

  const existing = doc.data();
  if (input.status === 'cancelled' || input.is_active === false) {
    const update = {
      status: 'cancelled',
      is_active: false,
      cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.update(update);
    return serialiseStream(id, { ...existing, ...update }, { now });
  }

  if (input.is_active === true) {
    throw serviceError('Streams go live automatically at their scheduled start time');
  }

  const update = { updated_at: admin.firestore.FieldValue.serverTimestamp() };
  if (input.title !== undefined) update.title = input.title.trim() || existing.title;
  if (input.youtube_url !== undefined) {
    if (!isValidYoutubeUrl(input.youtube_url)) throw serviceError('Invalid YouTube URL');
    update.youtube_url = input.youtube_url.trim();
  }

  const changesSchedule = input.slot !== undefined ||
    input.scheduled_start_at !== undefined ||
    input.duration_minutes !== undefined;
  if (changesSchedule) {
    if (currentStatus(existing, now) !== 'scheduled') {
      throw serviceError('Only upcoming live streams can be rescheduled');
    }
    if (existing.reminder_sent_at) {
      throw serviceError('This reminder has already been sent. Cancel it and create a new schedule instead.');
    }

    const schedule = parseSchedule({
      title: update.title || existing.title,
      youtube_url: update.youtube_url || existing.youtube_url,
      slot: input.slot ?? existing.slot,
      scheduled_start_at: input.scheduled_start_at ?? existing.scheduled_start_at,
      duration_minutes: input.duration_minutes ?? existing.duration_minutes,
    }, { now });
    await rejectOverlappingStream(areaId, schedule.scheduledStart, schedule.scheduledEnd, id);
    Object.assign(update, {
      title: schedule.title,
      youtube_url: schedule.youtube_url,
      slot: schedule.slot,
      scheduled_start_at: toTimestamp(schedule.scheduledStart),
      scheduled_end_at: toTimestamp(schedule.scheduledEnd),
      reminder_at: toTimestamp(new Date(schedule.scheduledStart.getTime() - REMINDER_LEAD_MINUTES * 60 * 1000)),
      duration_minutes: schedule.durationMinutes,
    });
  }

  await ref.update(update);
  return serialiseStream(id, { ...existing, ...update }, { now });
}

async function markNotificationClaimed(ref, field) {
  let claimed = false;
  await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(ref);
    const data = latest.data();
    if (data[field] || data[`${field}_claimed_at`]) return;
    transaction.update(ref, { [`${field}_claimed_at`]: admin.firestore.FieldValue.serverTimestamp() });
    claimed = true;
  });
  return claimed;
}

async function sendStartedNotification(ref, id, data, start) {
  if (!(await markNotificationClaimed(ref, 'started_notification_sent_at'))) {
    return false;
  }

  try {
    await notificationService.sendAreaBroadcast(data.area_id, {
      type: 'livestream_started',
      title: `${slotLabel(data.slot)} Live Stream Is Live`,
      body: `Your ${data.slot} slot live stream has started. Tap to watch now.`,
      meta: {
        destination: 'livestream',
        livestream_id: id,
        title: data.title,
        slot: data.slot,
        scheduled_start_at: start.toISOString(),
        youtube_url: data.youtube_url,
      },
    });
    await ref.update({ started_notification_sent_at: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  } catch (err) {
    await ref.update({
      started_notification_sent_at_claimed_at: admin.firestore.FieldValue.delete(),
      started_notification_failed_at: admin.firestore.FieldValue.serverTimestamp(),
      started_notification_error: err.message,
    });
    console.error(`[LIVESTREAM] Start alert failed for ${id}:`, err.message);
    return false;
  }
}

async function processScheduledStreams(now = new Date()) {
  const snap = await db.collection('livestreams').where('status', 'in', ['scheduled', 'live']).get();
  const results = { reminders: 0, started: 0, completed: 0 };

  for (const doc of snap.docs) {
    const data = doc.data();
    const start = dateFromValue(data.scheduled_start_at);
    const end = dateFromValue(data.scheduled_end_at);
    if (!start || !end || data.status === 'cancelled') continue;

    if (now >= end) {
      await doc.ref.update({
        status: 'completed',
        is_active: false,
        completed_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      results.completed += 1;
      continue;
    }

    const reminderAt = new Date(start.getTime() - REMINDER_LEAD_MINUTES * 60 * 1000);
    if (now >= reminderAt && now < start &&
        await markNotificationClaimed(doc.ref, 'reminder_sent_at')) {
      try {
        await notificationService.sendAreaBroadcast(data.area_id, {
          type: 'livestream_reminder',
          title: `${slotLabel(data.slot)} Live Stream in 30 Minutes`,
          body: `${slotLabel(data.slot)} slot live stream starts at ${formattedScheduleTime(start)}. Tap to view the schedule.`,
          meta: {
            destination: 'livestream',
            livestream_id: doc.id,
            title: data.title,
            slot: data.slot,
            scheduled_start_at: start.toISOString(),
          },
        });
        await doc.ref.update({ reminder_sent_at: admin.firestore.FieldValue.serverTimestamp() });
        results.reminders += 1;
      } catch (err) {
        await doc.ref.update({
          reminder_sent_at_claimed_at: admin.firestore.FieldValue.delete(),
          reminder_failed_at: admin.firestore.FieldValue.serverTimestamp(),
          reminder_error: err.message,
        });
        console.error(`[LIVESTREAM] Reminder failed for ${doc.id}:`, err.message);
      }
    }

    if (now >= start && now < end) {
      if (data.status !== 'live') {
        await doc.ref.update({
          status: 'live',
          is_active: true,
          started_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      if (await sendStartedNotification(doc.ref, doc.id, data, start)) {
        results.started += 1;
      }
    }
  }

  return results;
}

module.exports = {
  REMINDER_LEAD_MINUTES,
  createStream,
  createScheduledStream,
  createImmediateStream,
  listAreaStreams,
  getViewerStreams,
  updateScheduledStream,
  processScheduledStreams,
  currentStatus,
};
