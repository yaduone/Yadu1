const { db, admin } = require('../config/firebase');

/**
 * Write an activity log entry to the `admin_logs` Firestore collection.
 *
 * @param {object} opts
 * @param {string} opts.type       - Event type key (e.g. 'new_user', 'manifest_generated')
 * @param {string} opts.title      - Short human-readable title
 * @param {string} opts.message    - Full detail message
 * @param {string} [opts.areaId]   - Area this event belongs to (null = global)
 * @param {object} [opts.meta]     - Any extra key/value pairs to store
 */
async function logActivity({ type, title, message, areaId = null, meta = {} }) {
  try {
    await db.collection('admin_logs').add({
      type,
      title,
      message,
      area_id: areaId,
      meta,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Never let logging crash the main request
    console.error('[activityLog] Failed to write log:', err.message);
  }
}

module.exports = { logActivity };
