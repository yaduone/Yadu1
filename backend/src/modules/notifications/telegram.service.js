// Telegram alerts for admins — a second, independent path to the admin phones
// alongside the FCM web push in notification.service.js. Useful precisely when
// that path is silent: FCM tokens are pruned when they go stale, so an admin can
// stop receiving pushes without anyone noticing until an order is missed.
//
// Credentials come from the environment, never the database:
//   TELEGRAM_BOT_TOKEN — issued by @BotFather
//   TELEGRAM_CHAT_ID   — the target chat: a group id (negative) or a DM id
//   ADMIN_PANEL_URL    — optional; adds a deep link to the alert
//
// With either of the first two unset every call is a logged no-op, so this is
// safe to deploy before the bot exists — see SKIP_REASONS, which is what each
// skip is logged as.

const SKIP_REASONS = {
  not_configured: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set on the backend',
  api_error: 'Telegram rejected the message',
  network_error: 'Could not reach the Telegram API',
};

// Telegram is normally sub-second. A ceiling matters because this runs inside
// the order-confirmation flow's fire-and-forget task: without one, a wedged
// socket would keep the request alive long after the customer has their order.
const SEND_DEADLINE_MS = 10000;

/**
 * Read the config on every call rather than caching at module load, so tests can
 * set it per-case and a variable added to the host is picked up on restart.
 */
function config() {
  return {
    token: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    chatId: (process.env.TELEGRAM_CHAT_ID || '').trim(),
  };
}

/** True when both Telegram env vars are present. */
function isConfigured() {
  const { token, chatId } = config();
  return Boolean(token && chatId);
}

function skip(reason, detail) {
  return { sent: false, reason, message: detail || SKIP_REASONS[reason] || reason };
}

/** Telegram's HTML parse mode only permits a fixed tag set; everything else must be escaped. */
function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Low-level send. Resolves to a { sent, reason, message } record and never
 * throws, so a failed alert can never affect the business flow that triggered
 * it — while the logs still tell apart "not set up" from "Telegram said no".
 */
async function sendMessage(text) {
  const { token, chatId } = config();
  if (!token || !chatId) {
    console.warn('[telegram] skipped:', SKIP_REASONS.not_configured);
    return skip('not_configured');
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(SEND_DEADLINE_MS),
    });

    // Telegram reports application errors (bad chat id, bot kicked) in the body
    // with a 4xx, so the status alone is not enough to call it a success.
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      const detail = body.description || `HTTP ${response.status}`;
      console.error('[telegram] send failed:', detail);
      return skip('api_error', `Telegram rejected the message: ${detail}`);
    }

    console.log(`[telegram] sent message to chat ${chatId}`);
    return { sent: true, reason: 'ok', message: 'Sent', chatId };
  } catch (err) {
    console.error('[telegram] send failed:', err.message);
    return skip('network_error', `Could not reach the Telegram API: ${err.message}`);
  }
}

/**
 * Alert for a newly placed instant order. Mirrors the email alert's content so
 * whichever channel an admin sees first is equally actionable. Safe to call
 * fire-and-forget.
 */
async function sendInstantOrderCreatedAlert({ orderId, order, customer }) {
  const name = customer?.name || 'A customer';
  const total = Number(order?.total_amount || 0).toFixed(2);
  const items = Array.isArray(order?.items) ? order.items : [];
  const eta = Number(order?.eta_minutes) || 0;
  const adminUrl = (process.env.ADMIN_PANEL_URL || '').trim();

  const lines = [
    '🔔 <b>New Instant Order</b>',
    '',
    `👤 ${escapeHtml(name)}${customer?.phone ? ` · ${escapeHtml(customer.phone)}` : ''}`,
    customer?.address ? `📍 ${escapeHtml(customer.address)}` : null,
    '',
    ...items.map((item) => `• ${escapeHtml(item.name || 'Item')} × ${escapeHtml(item.quantity || 1)}`),
    items.length ? '' : null,
    `💰 <b>Rs. ${total}</b> · cash on delivery`,
    eta ? `⏱ ETA ${eta} min` : null,
    adminUrl ? `\n${escapeHtml(`${adminUrl.replace(/\/+$/, '')}/instant-orders`)}` : null,
  ].filter((line) => line !== null && line !== undefined);

  return sendMessage(lines.join('\n'));
}

/**
 * Alert for a customer-cancelled instant order. Time-critical when the order was
 * already accepted — a delivery may be on the way — so the copy leads with that,
 * matching sendAdminInstantOrderCancelledNotification.
 */
async function sendInstantOrderCancelledAlert({ orderId, customerName, totalAmount, wasAccepted }) {
  const name = customerName || 'A customer';
  const total = Number(totalAmount || 0).toFixed(2);
  const adminUrl = (process.env.ADMIN_PANEL_URL || '').trim();

  const lines = [
    wasAccepted ? '⚠️ <b>Accepted Order Cancelled</b>' : '❌ <b>Instant Order Cancelled</b>',
    '',
    `👤 ${escapeHtml(name)} · Rs. ${total}`,
    wasAccepted ? '<b>Stop the delivery if it is already on the way.</b>' : null,
    adminUrl ? `\n${escapeHtml(`${adminUrl.replace(/\/+$/, '')}/instant-orders`)}` : null,
  ].filter((line) => line !== null && line !== undefined);

  return sendMessage(lines.join('\n'));
}

/**
 * Explicit admin action: prove the bot setup works without waiting for a real
 * order.
 */
async function sendTestAlert({ triggeredBy } = {}) {
  const lines = [
    '✅ <b>Test alert</b>',
    '',
    'Telegram alerts are wired up correctly.',
    triggeredBy ? `Triggered by ${escapeHtml(triggeredBy)}` : null,
  ].filter((line) => line !== null && line !== undefined);

  return sendMessage(lines.join('\n'));
}

module.exports = {
  SKIP_REASONS,
  isConfigured,
  sendMessage,
  sendInstantOrderCreatedAlert,
  sendInstantOrderCancelledAlert,
  sendTestAlert,
};
