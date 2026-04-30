const { db, admin } = require('../../config/firebase');

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Core helper — creates a notification with a 3-day auto-expiry.
 */
async function createNotification(userId, areaId, { type, title, body, meta = {} }) {
  const expiresAt = new Date(Date.now() + THREE_DAYS_MS);
  await db.collection('notifications').add({
    user_id: userId,
    area_id: areaId,
    type,
    title,
    body,
    meta,
    is_read: false,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    expires_at: admin.firestore.Timestamp.fromDate(expiresAt),
  });
}

/**
 * Sent automatically when admin marks an order as delivered.
 * Includes full order breakdown and updated due balance.
 */
async function sendDeliveryNotification(userId, areaId, order, newDueAmount) {
  const date = order.date;
  const milk = order.milk;
  const extras = order.extra_items || [];
  const amount = order.total_amount || 0;

  const parts = [];
  if (milk) parts.push(`${milk.milk_type.charAt(0).toUpperCase() + milk.milk_type.slice(1)} milk (${milk.quantity_litres}L)`);
  extras.forEach((e) => parts.push(e.name || 'Extra item'));

  const itemsText = parts.length ? parts.join(', ') : 'Your order';
  const body = `${itemsText} has been delivered. ₹${amount.toFixed(2)} added to your account. Your total due is now ₹${newDueAmount.toFixed(2)}.`;

  await createNotification(userId, areaId, {
    type: 'delivery_summary',
    title: `Delivery Confirmed · ${date}`,
    body,
    meta: {
      date,
      milk: milk || null,
      extra_items: extras,
      order_amount: amount,
      new_due_amount: newDueAmount,
    },
  });
}

/**
 * Sent when admin manually pings a user about their outstanding due.
 */
async function sendDueReminderNotification(userId, areaId, { dueAmount, totalBilled, totalPaid }) {
  await createNotification(userId, areaId, {
    type: 'due_reminder',
    title: 'Payment Reminder from Your Dairy',
    body: `You have an outstanding balance of ₹${dueAmount.toFixed(2)}. Please pay your delivery agent at your earliest convenience. Total billed: ₹${totalBilled.toFixed(2)}, paid: ₹${totalPaid.toFixed(2)}.`,
    meta: {
      due_amount: dueAmount,
      total_billed: totalBilled,
      total_paid: totalPaid,
    },
  });
}

/**
 * Delete all expired notification docs (fire-and-forget cleanup).
 * Called on each GET so stale docs are purged over time.
 */
async function purgeExpiredNotifications() {
  try {
    const cutoff = admin.firestore.Timestamp.now();
    const snap = await db
      .collection('notifications')
      .where('expires_at', '<', cutoff)
      .limit(100)
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.error('[purgeExpiredNotifications]', err.message);
  }
}

module.exports = {
  createNotification,
  sendDeliveryNotification,
  sendDueReminderNotification,
  purgeExpiredNotifications,
};
