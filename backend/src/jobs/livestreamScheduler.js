const cron = require('node-cron');
const config = require('../config');
const { processScheduledStreams } = require('../modules/livestreams/livestream.service');

async function runLivestreamScheduleCheck() {
  try {
    const result = await processScheduledStreams();
    if (result.reminders || result.started || result.completed) {
      console.log(
        `[LIVESTREAM] reminders=${result.reminders} started=${result.started} completed=${result.completed}`
      );
    }
  } catch (err) {
    console.error('[LIVESTREAM] Scheduler check failed:', err.message);
  }
}

function initLivestreamScheduler() {
  cron.schedule('* * * * *', runLivestreamScheduleCheck, { timezone: config.timezone });
  console.log(`[LIVESTREAM] Scheduler checks every minute in ${config.timezone}`);
}

module.exports = { initLivestreamScheduler, runLivestreamScheduleCheck };
