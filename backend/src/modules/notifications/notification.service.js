const { db, admin } = require('../../config/firebase');

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_BATCH_WRITES = 400;
const MAX_PUSH_TOKENS = 500;
const ADMIN_PANEL_URL = process.env.ADMIN_PANEL_URL || 'https://yadu1-ten.vercel.app';

function notificationRecord(userId, areaId, { type, title, body, meta = {} }) {
  const expiresAt = new Date(Date.now() + THREE_DAYS_MS);
  return {
    user_id: userId,
    area_id: areaId,
    type,
    title,
    body,
    meta,
    is_read: false,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    expires_at: admin.firestore.Timestamp.fromDate(expiresAt),
  };
}

function fcmData(data) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])
  );
}

/**
 * Looks up the FCM token for a user and sends a push notification.
 * Silently swallows errors so a missing token never breaks the business flow.
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
      data: fcmData({ ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' }),
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'yaduone_default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token') {
      try {
        await db.collection('users').doc(userId).update({
          fcm_token: admin.firestore.FieldValue.delete(),
        });
      } catch (_) {}
    }
    console.warn('[FCM] push failed for user', userId, err.message);
  }
}

/**
 * Creates an in-app notification with a 3-day expiry, then pushes to the device.
 */
async function createNotification(userId, areaId, { type, title, body, meta = {} }) {
  await db.collection('notifications').add(notificationRecord(userId, areaId, {
    type,
    title,
    body,
    meta,
  }));

  _sendFcmPush(userId, title, body, { type, ...meta });
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
  if (milk) {
    const milkType = milk.milk_type.charAt(0).toUpperCase() + milk.milk_type.slice(1);
    parts.push(`${milkType} milk (${milk.quantity_litres}L)`);
  }
  extras.forEach((item) => parts.push(item.name || 'Extra item'));

  const itemsText = parts.length ? parts.join(', ') : 'Your order';
  const body = `${itemsText} has been delivered. Rs. ${amount.toFixed(2)} added to your account. Your total due is now Rs. ${newDueAmount.toFixed(2)}.`;

  await createNotification(userId, areaId, {
    type: 'delivery_summary',
    title: `Delivery Confirmed - ${date}`,
    body,
    meta: {
      destination: 'orders',
      date,
      milk: milk || null,
      extra_items: extras,
      order_amount: amount,
      new_due_amount: newDueAmount,
    },
  });
}

/**
 * Sent automatically when admin marks a cash-on-delivery (instant) order as delivered.
 * Unlike sendDeliveryNotification, this does not reference the due balance since
 * COD orders are settled in cash at delivery time and never added to the due.
 */
async function sendCodDeliveryNotification(userId, areaId, order) {
  const date = order.date;
  const extras = order.extra_items || [];
  const amount = order.total_amount || 0;

  const itemsText = extras.length
    ? extras.map((item) => item.name || 'Extra item').join(', ')
    : 'Your order';
  const body = `${itemsText} has been delivered. Rs. ${amount.toFixed(2)} collected via cash on delivery.`;

  await createNotification(userId, areaId, {
    type: 'delivery_summary',
    title: `Delivery Confirmed - ${date}`,
    body,
    meta: {
      destination: 'orders',
      date,
      extra_items: extras,
      order_amount: amount,
      payment_method: 'cod',
    },
  });
}

/**
 * Sent when admin manually pings a user about an outstanding due.
 */
async function sendDueReminderNotification(userId, areaId, { dueAmount, totalBilled, totalPaid }) {
  await createNotification(userId, areaId, {
    type: 'due_reminder',
    title: 'Payment Reminder from Your Dairy',
    body: `You have an outstanding balance of Rs. ${dueAmount.toFixed(2)}. Please pay your delivery agent at your earliest convenience. Total billed: Rs. ${totalBilled.toFixed(2)}, paid: Rs. ${totalPaid.toFixed(2)}.`,
    meta: {
      destination: 'dues',
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
    title: `Payment Received - Rs. ${amount.toFixed(2)}`,
    body: `We've recorded your payment of Rs. ${amount.toFixed(2)} via ${methodLabel} on ${dateLabel}. Your remaining balance is Rs. ${remainingDue.toFixed(2)}.`,
    meta: {
      destination: 'dues',
      amount,
      method,
      payment_date: dateLabel,
      remaining_due: remainingDue,
    },
  });
}

/**
 * Sent when admin cancels an order before delivery.
 */
async function sendOrderCancelledNotification(userId, areaId, { date, amount }) {
  await createNotification(userId, areaId, {
    type: 'order_cancelled',
    title: `Order Cancelled - ${date}`,
    body: `Your order for ${date} has been cancelled${amount > 0 ? `. Rs. ${amount.toFixed(2)} will not be charged.` : '.'}`,
    meta: { destination: 'orders', date, amount },
  });
}

/**
 * Sent when a user's subscription lifecycle or daily quantity changes.
 */
async function sendSubscriptionUpdatedNotification(
  userId,
  areaId,
  { title = 'Subscription Updated', changeDescription, action = 'updated', details = {} }
) {
  await createNotification(userId, areaId, {
    type: 'subscription_updated',
    title,
    body: changeDescription || 'Your subscription has been updated by your dairy.',
    meta: {
      destination: 'subscription',
      action,
      change_description: changeDescription,
      ...details,
    },
  });
}

/**
 * Broadcast to every customer in an area.
 * Each customer receives an individual in-app record so read status is private,
 * while FCM delivery is batched to avoid a request per device.
 */
async function sendAreaBroadcast(areaId, { type = 'info', title, body, meta = {} }) {
  const usersSnap = await db.collection('users').where('area_id', '==', areaId).get();
  if (usersSnap.empty) return { recipients: 0, pushed: 0 };

  const users = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  for (let i = 0; i < users.length; i += MAX_BATCH_WRITES) {
    const batch = db.batch();
    users.slice(i, i + MAX_BATCH_WRITES).forEach((user) => {
      const ref = db.collection('notifications').doc();
      batch.set(ref, notificationRecord(user.id, areaId, { type, title, body, meta }));
    });
    await batch.commit();
  }

  const tokenUsers = users.filter((user) => user.fcm_token);
  let pushed = 0;
  for (let i = 0; i < tokenUsers.length; i += MAX_PUSH_TOKENS) {
    const recipients = tokenUsers.slice(i, i + MAX_PUSH_TOKENS);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: recipients.map((user) => user.fcm_token),
      notification: { title, body },
      data: fcmData({ type, ...meta, click_action: 'FLUTTER_NOTIFICATION_CLICK' }),
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'yaduone_default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
    pushed += response.successCount;

    const invalidUsers = recipients.filter((_, index) => {
      const errorCode = response.responses[index]?.error?.code;
      return errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token';
    });
    if (invalidUsers.length) {
      const batch = db.batch();
      invalidUsers.forEach((user) => {
        batch.update(db.collection('users').doc(user.id), {
          fcm_token: admin.firestore.FieldValue.delete(),
        });
      });
      await batch.commit();
    }
  }

  return { recipients: users.length, pushed };
}

/**
 * Admin-authored ping. Sends to every customer in the area, or to a chosen
 * subset of user IDs (also scoped to the area) when targetUserIds is given.
 */
async function sendCustomNotification(areaId, { title, body, targetUserIds = null }) {
  let usersSnap;
  if (targetUserIds && targetUserIds.length) {
    const refs = targetUserIds.map((id) => db.collection('users').doc(id));
    const docs = await db.getAll(...refs);
    usersSnap = { docs: docs.filter((d) => d.exists && d.data().area_id === areaId) };
  } else {
    usersSnap = await db.collection('users').where('area_id', '==', areaId).get();
  }
  if (!usersSnap.docs.length) return { recipients: 0, pushed: 0 };

  const users = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const type = 'admin_announcement';
  const meta = { destination: 'notifications' };

  for (let i = 0; i < users.length; i += MAX_BATCH_WRITES) {
    const batch = db.batch();
    users.slice(i, i + MAX_BATCH_WRITES).forEach((user) => {
      const ref = db.collection('notifications').doc();
      batch.set(ref, notificationRecord(user.id, areaId, { type, title, body, meta }));
    });
    await batch.commit();
  }

  const tokenUsers = users.filter((user) => user.fcm_token);
  let pushed = 0;
  for (let i = 0; i < tokenUsers.length; i += MAX_PUSH_TOKENS) {
    const recipients = tokenUsers.slice(i, i + MAX_PUSH_TOKENS);
    const response = await admin.messaging().sendEachForMulticast({
      tokens: recipients.map((user) => user.fcm_token),
      notification: { title, body },
      data: fcmData({ type, ...meta, click_action: 'FLUTTER_NOTIFICATION_CLICK' }),
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'yaduone_default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
    pushed += response.successCount;

    const invalidUsers = recipients.filter((_, index) => {
      const errorCode = response.responses[index]?.error?.code;
      return errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token';
    });
    if (invalidUsers.length) {
      const batch = db.batch();
      invalidUsers.forEach((user) => {
        batch.update(db.collection('users').doc(user.id), {
          fcm_token: admin.firestore.FieldValue.delete(),
        });
      });
      await batch.commit();
    }
  }

  return { recipients: users.length, pushed };
}

/**
 * Sent to every admin assigned to an area when a user places an instant order.
 * Web push (works even when the admin panel tab is closed) — targets the
 * `fcm_token` stored on each `admins/{adminId}` doc via the settings config button.
 */
async function sendAdminInstantOrderNotification(areaId, { orderId, userId, totalAmount }) {
  try {
    const adminsSnap = await db.collection('admins').where('area_id', '==', areaId).get();
    const tokens = adminsSnap.docs.map((doc) => doc.data().fcm_token).filter(Boolean);
    if (!tokens.length) return;

    const userDoc = userId ? await db.collection('users').doc(userId).get() : null;
    const userData = userDoc && userDoc.exists ? userDoc.data() : {};
    const userName = userData.name || 'A customer';
    const shortAddress = (userData.address || '').toString().slice(0, 60);

    const title = 'New Instant Order';
    const body = `${userName} · Rs. ${Number(totalAmount || 0).toFixed(2)}${shortAddress ? ` · ${shortAddress}` : ''}`;
    const adminPanelUrl = `${ADMIN_PANEL_URL}/instant-orders`;

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: fcmData({ type: 'instant_order', order_id: orderId, url: adminPanelUrl }),
      webpush: {
        fcmOptions: { link: adminPanelUrl },
        notification: { icon: '/favicon.svg' },
      },
    });

    const invalidTokens = tokens.filter((_, index) => {
      const errorCode = response.responses[index]?.error?.code;
      return errorCode === 'messaging/registration-token-not-registered' ||
        errorCode === 'messaging/invalid-registration-token';
    });
    if (invalidTokens.length) {
      const batch = db.batch();
      adminsSnap.docs
        .filter((doc) => invalidTokens.includes(doc.data().fcm_token))
        .forEach((doc) => batch.update(doc.ref, { fcm_token: admin.firestore.FieldValue.delete() }));
      await batch.commit();
    }
  } catch (err) {
    console.warn('[FCM] admin instant order push failed:', err.message);
  }
}

/**
 * Delete expired notification records during routine cleanup.
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
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (err) {
    console.error('[purgeExpiredNotifications]', err.message);
  }
}

module.exports = {
  createNotification,
  sendDeliveryNotification,
  sendCodDeliveryNotification,
  sendDueReminderNotification,
  sendPaymentRecordedNotification,
  sendOrderCancelledNotification,
  sendSubscriptionUpdatedNotification,
  sendAreaBroadcast,
  sendCustomNotification,
  sendAdminInstantOrderNotification,
  purgeExpiredNotifications,
};
