const cron = require('node-cron');
const config = require('../config');
const { expireStaleOrders } = require('../modules/instant/instant.service');

/**
 * Auto-rejects instant orders the admin never accepted within the configured
 * window, so a customer is never stuck on the "Requested" screen indefinitely.
 */
async function runInstantExpiryCheck() {
  try {
    const result = await expireStaleOrders();
    if (result.expired) {
      console.log(`[INSTANT] Auto-expired ${result.expired} unacknowledged order(s)`);
    }
  } catch (err) {
    console.error('[INSTANT] Expiry check failed:', err.message);
  }
}

function initInstantOrderExpiry() {
  cron.schedule('* * * * *', runInstantExpiryCheck, { timezone: config.timezone });
  console.log(`[INSTANT] Order expiry checks every minute in ${config.timezone}`);
}

module.exports = { initInstantOrderExpiry, runInstantExpiryCheck };
