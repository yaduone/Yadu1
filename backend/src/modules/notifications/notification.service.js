const { db, admin } = require('../../config/firebase');

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Looks up the FCM token for a user and sends a push notification.
 * Silently swallows errors so a missing token never breaks the notification flow.
 */
async function _sendFcmPush(userId, title, body, data = {}) {
  if (!userId) return;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const token = userDoc.exists ? userDoc.data().fcm_token : null;
    if (!token) return;

    await admin.messaging().send({
      token,
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'yaduone_default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
  } catch (err) {
    // Invalid / expired token — clear it so we don't retry
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token') {
      try {
        await db.collection('users').doc(userId).update({ fcm_token: admin.firestore.FieldValue.delete() });
      } catch (_) {}
    }
    console.warn('[FCM] push failed for user', userId, err.message);
  }
}

/**
 * Core helper — creates a notification with a 3-day auto-expiry, then pushes FCM.
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

  // Push to device (fire-and-forget)
  _sendFcmPush(userId, title, body, { type });
}

/**
 * Sent automatically when admin marks an order as delivered.
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
 * Sent when admin records a payment against a user's account.
 */
async function sendPaymentRecordedNotification(userId, areaId, { amount, method, remainingDue, paymentDate }) {
  const methodLabel = { cash: 'Cash', upi: 'UPI', other: 'Other' }[method] || method;
  const dateLabel = paymentDate || new Date().toISOString().split('T')[0];
  await createNotification(userId, areaId, {
    type: 'payment_recorded',
    title: `Payment Received · ₹${amount.toFixed(2)}`,
    body: `We've recorded your payment of ₹${amount.toFixed(2)} via ${methodLabel} on ${dateLabel}. Your remaining balance is ₹${remainingDue.toFixed(2)}.`,
    meta: {
      amount,
      method,
      payment_date: dateLabel,
      remaining_due: remainingDue,
    },
  });
}

/**
 * Sent when admin cancels an order.
 */
async function sendOrderCancelledNotification(userId, areaId, { date, amount }) {
  await createNotification(userId, areaId, {
    type: 'order_cancelled',
    title: `Order Cancelled · ${date}`,
    body: `Your order for ${date} has been cancelled${amount > 0 ? `. ₹${amount.toFixed(2)} will not be charged.` : '.'}`,
    meta: { date, amount },
  });
}

/**
 * Sent when the user's subscription is updated by admin.
 */
async function sendSubscriptionUpdatedNotification(userId, areaId, { changeDescription }) {
  await createNotification(userId, areaId, {
    type: 'subscription_updated',
    title: 'Subscription Updated',
    body: changeDescription || 'Your subscription has been updated by your dairy.',
    meta: { change_description: changeDescription },
  });
}

/**
 * Broadcast an info/alert to all users in an area (no specific user).
 */
async function sendAreaBroadcast(areaId, { type = 'info', title, body, meta = {} }) {
  await createNotification(null, areaId, { type, title, body, meta });
}

/**
 * Delete all expired notification docs (fire-and-forget cleanup).
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
  sendPaymentRecordedNotification,
  sendOrderCancelledNotification,
  sendSubscriptionUpdatedNotification,
  sendAreaBroadcast,
  purgeExpiredNotifications,
};
