const nodemailer = require('nodemailer');
const emailConfig = require('../settings/emailNotifications.service');

// Gmail credentials come from the environment, never the database:
//   GMAIL_USER            — the sending Gmail address
//   GMAIL_APP_PASSWORD    — a Google "App Password" (not the account password;
//                           requires 2-Step Verification enabled on the account)
// If either is missing, email sending is silently skipped so the account can be
// wired up later without breaking any order flow.
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

let _transporter;

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return _transporter;
}

/**
 * Low-level send. Resolves to false (never throws) so callers can fire-and-forget
 * without an email failure ever affecting the business flow that triggered it.
 */
async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[email] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping email');
    return false;
  }
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length) return false;

  try {
    await transporter.sendMail({
      from: `"YaduOne" <${GMAIL_USER}>`,
      to: recipients.join(', '),
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return false;
  }
}

function money(n) {
  return `Rs. ${Number(n || 0).toFixed(2)}`;
}

function itemsHtml(items = []) {
  if (!items.length) return '';
  const rows = items
    .map((i) => `<tr>
      <td style="padding:4px 12px 4px 0;">${i.product_name || 'Item'}</td>
      <td style="padding:4px 0;text-align:right;">${i.quantity || 0} ${i.unit || ''} · ${money(i.total)}</td>
    </tr>`)
    .join('');
  return `<table style="border-collapse:collapse;margin-top:8px;font-size:14px;">${rows}</table>`;
}

/**
 * Alert email for a newly placed instant order. Reads the live admin config to
 * decide whether to send at all and to whom. Safe to call fire-and-forget.
 */
async function sendInstantOrderCreatedEmail({ orderId, order, customer }) {
  let config;
  try {
    config = await emailConfig.getConfig();
  } catch (err) {
    console.error('[email] failed to load email config:', err.message);
    return false;
  }

  if (!config.enabled || !config.instant_order_created) return false;
  if (!config.recipients.length) return false;

  const customerName = customer?.name || 'A customer';
  const customerPhone = customer?.phone ? ` · ${customer.phone}` : '';
  const address = customer?.address || '';

  const subject = `New Instant Order — ${customerName} (${money(order?.total_amount)})`;
  const text = [
    `A new instant order has been placed.`,
    ``,
    `Order ID: ${orderId}`,
    `Customer: ${customerName}${customerPhone}`,
    address ? `Address: ${address}` : null,
    `Total: ${money(order?.total_amount)}`,
    `Payment: Cash on delivery`,
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:520px;">
      <h2 style="margin:0 0 4px;">New Instant Order</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Order ID: ${orderId}</p>
      <p style="margin:0 0 4px;"><strong>${customerName}</strong>${customerPhone}</p>
      ${address ? `<p style="margin:0 0 12px;color:#475569;">${address}</p>` : ''}
      ${itemsHtml(order?.items)}
      <p style="margin:16px 0 0;font-size:16px;"><strong>Total: ${money(order?.total_amount)}</strong></p>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Payment: Cash on delivery</p>
    </div>`;

  return sendMail({ to: config.recipients, subject, text, html });
}

module.exports = {
  sendMail,
  sendInstantOrderCreatedEmail,
};
