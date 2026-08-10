const nodemailer = require('nodemailer');
const emailConfig = require('../settings/emailNotifications.service');
const templates = require('./email.templates');

// Gmail credentials come from the environment, never the database:
//   GMAIL_USER            — the sending Gmail address
//   GMAIL_APP_PASSWORD    — a Google "App Password" (not the account password;
//                           requires 2-Step Verification enabled on the account)
//   ADMIN_PANEL_URL       — optional; adds a deep link to the alert email
//
// Who receives an alert, and whether alerts are on at all, is admin-editable and
// lives in Firestore (settings/email_notifications). Both gates default to OFF,
// so setting the env vars alone sends nothing — see SKIP_REASONS below, which is
// what every skip is logged as.

const SKIP_REASONS = {
  not_configured: 'GMAIL_USER / GMAIL_APP_PASSWORD are not set on the backend',
  disabled: 'Email alerts are switched off in Settings → Email Alerts',
  trigger_disabled: 'The "new instant order" alert is switched off in Settings → Email Alerts',
  no_recipients: 'No recipients are configured in Settings → Email Alerts',
  config_error: 'Could not load the email alert settings',
  smtp_error: 'Gmail rejected the message',
  smtp_timeout:
    'Timed out connecting to Gmail. The host is most likely blocking outbound SMTP — '
    + 'try setting SMTP_PORT=587, and check whether your hosting plan permits outbound mail.',
};

// Gmail listens on 465 (implicit TLS) and 587 (STARTTLS). Several PaaS providers
// block one or both on lower plans, so the port is overridable rather than baked
// in via nodemailer's `service: 'gmail'` shorthand. Read per call, like the
// credentials — nothing here is captured at module load.
function smtpSettings() {
  const port = Number(process.env.SMTP_PORT) || 465;
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
  };
}

// Without these nodemailer waits ~2 minutes to connect and up to 10 minutes on a
// silent socket. On a host that blackholes SMTP that read as an request that
// never returns — which is exactly what a blocked port looks like from the UI.
const CONNECTION_TIMEOUT_MS = 10000;
const GREETING_TIMEOUT_MS = 10000;
const SOCKET_TIMEOUT_MS = 20000;

// Belt-and-braces ceiling in case a socket wedges in a state the timeouts above
// do not cover. Every exported call resolves within this.
const VERIFY_DEADLINE_MS = 15000;
const SEND_DEADLINE_MS = 25000;

class DeadlineError extends Error {}

/** Reject with a DeadlineError if `promise` has not settled within `ms`. */
function withDeadline(promise, ms, label) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineError(`${label} exceeded ${ms}ms`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/** A connection that never opened is a different problem from a rejected login. */
function isTimeout(err) {
  return err instanceof DeadlineError
    || ['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'EDNS'].includes(err?.code)
    || /timed?\s?out/i.test(err?.message || '');
}

function skip(reason, detail) {
  const message = detail || SKIP_REASONS[reason] || reason;
  return { sent: false, reason, message };
}

/**
 * Read credentials on every call rather than caching them at module load, so a
 * variable added to the host after boot is picked up on the next restart-free
 * require and tests can set them per-case.
 */
function credentials() {
  const user = (process.env.GMAIL_USER || '').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  return { user, pass };
}

/** True when both Gmail env vars are present. Cheap enough to call per request. */
function isConfigured() {
  const { user, pass } = credentials();
  return Boolean(user && pass);
}

let _transporter = null;
let _transporterKey = '';

function getTransporter() {
  const { user, pass } = credentials();
  if (!user || !pass) return null;

  // Rebuild if the credentials or the endpoint changed under us; otherwise reuse.
  const smtp = smtpSettings();
  const key = `${user}:${pass.length}:${smtp.host}:${smtp.port}`;
  if (!_transporter || _transporterKey !== key) {
    _transporter = nodemailer.createTransport({
      ...smtp,
      auth: { user, pass },
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: GREETING_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    });
    _transporterKey = key;
  }
  return _transporter;
}

/** Drop the cached transporter. Exported for tests. */
function resetTransport() {
  _transporter = null;
  _transporterKey = '';
}

/**
 * Open a connection and authenticate without sending anything. Used by the admin
 * panel's test button to tell "bad app password" apart from "bad recipient".
 */
async function verifyTransport() {
  const transporter = getTransporter();
  if (!transporter) return skip('not_configured');
  try {
    await withDeadline(transporter.verify(), VERIFY_DEADLINE_MS, 'SMTP verify');
    return { sent: true, reason: 'ok', message: 'Gmail credentials accepted' };
  } catch (err) {
    if (isTimeout(err)) {
      const { host, port } = smtpSettings();
      console.error(`[email] SMTP connect timed out (${host}:${port}):`, err.message);
      return skip('smtp_timeout');
    }
    console.error('[email] SMTP verify failed:', err.message);
    return skip('smtp_error', `Gmail rejected the credentials: ${err.message}`);
  }
}

/**
 * Low-level send. Resolves to a { sent, reason, message } record and never
 * throws, so a mail failure can never affect the business flow that triggered
 * it — but the caller and the logs can still tell apart "off on purpose" from
 * "Gmail said no".
 */
async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[email] skipped:', SKIP_REASONS.not_configured);
    return skip('not_configured');
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .map((e) => String(e || '').trim())
    .filter(Boolean);
  if (!recipients.length) {
    console.warn('[email] skipped:', SKIP_REASONS.no_recipients);
    return skip('no_recipients');
  }

  const { user } = credentials();
  try {
    const info = await withDeadline(
      transporter.sendMail({
        from: `"${templates.BRAND}" <${user}>`,
        to: recipients.join(', '),
        subject,
        text,
        html,
      }),
      SEND_DEADLINE_MS,
      'SMTP send'
    );
    console.log(`[email] sent "${subject}" to ${recipients.length} recipient(s) [${info?.messageId || 'no-id'}]`);
    return { sent: true, reason: 'ok', message: 'Sent', recipients, messageId: info?.messageId || null };
  } catch (err) {
    if (isTimeout(err)) {
      const { host, port } = smtpSettings();
      console.error(`[email] send timed out (${host}:${port}):`, err.message);
      return skip('smtp_timeout');
    }
    console.error('[email] send failed:', err.message);
    return skip('smtp_error', `Gmail rejected the message: ${err.message}`);
  }
}

/**
 * Alert for a newly placed instant order. Reads the live admin config to decide
 * whether to send at all and to whom. Safe to call fire-and-forget.
 */
async function sendInstantOrderCreatedEmail({ orderId, order, customer }) {
  let config;
  try {
    config = await emailConfig.getConfig();
  } catch (err) {
    console.error('[email] failed to load email config:', err.message);
    return skip('config_error', `Could not load the email alert settings: ${err.message}`);
  }

  // Each of these used to return a bare `false` with no log line, which made a
  // switched-off alert indistinguishable from a broken one.
  if (!config.enabled) {
    console.warn('[email] instant-order alert skipped:', SKIP_REASONS.disabled);
    return skip('disabled');
  }
  if (!config.instant_order_created) {
    console.warn('[email] instant-order alert skipped:', SKIP_REASONS.trigger_disabled);
    return skip('trigger_disabled');
  }
  if (!config.recipients.length) {
    console.warn('[email] instant-order alert skipped:', SKIP_REASONS.no_recipients);
    return skip('no_recipients');
  }

  const adminUrl = (process.env.ADMIN_PANEL_URL || '').trim();
  const { subject, text, html } = templates.renderInstantOrderCreated({
    orderId,
    order,
    customer,
    adminUrl: adminUrl ? `${adminUrl.replace(/\/+$/, '')}/instant-orders` : null,
  });

  return sendMail({ to: config.recipients, subject, text, html });
}

/**
 * Explicit admin action: prove the Gmail setup works without waiting for a real
 * order. Deliberately ignores the `enabled` master switch — you test first, then
 * turn alerts on — but still falls back to the configured recipients so the
 * common case is a one-click check.
 */
async function sendTestEmail({ to, triggeredBy } = {}) {
  const verified = await verifyTransport();
  if (!verified.sent) return verified;

  let recipients = (Array.isArray(to) ? to : [to])
    .map((e) => String(e || '').trim().toLowerCase())
    .filter(Boolean);

  if (!recipients.length) {
    try {
      const config = await emailConfig.getConfig();
      recipients = config.recipients;
    } catch (err) {
      return skip('config_error', `Could not load the email alert settings: ${err.message}`);
    }
  }
  if (!recipients.length) return skip('no_recipients');

  const { subject, text, html } = templates.renderTestEmail({ triggeredBy });
  return sendMail({ to: recipients, subject, text, html });
}

module.exports = {
  SKIP_REASONS,
  isConfigured,
  verifyTransport,
  resetTransport,
  sendMail,
  sendInstantOrderCreatedEmail,
  sendTestEmail,
};
