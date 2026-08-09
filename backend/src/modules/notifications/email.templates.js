const moment = require('moment-timezone');
const config = require('../../config');

// Presentation layer for outgoing email. Everything here is a plain function of
// its arguments — no transport, no Firestore, no Gmail credentials — so the
// rendered subject/text/html can be asserted in tests without sending anything.

const BRAND = 'YaduOne';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Escape a value for interpolation into HTML. Customer names, addresses and
 * product names are all user-supplied, so every one of them goes through here;
 * a stray apostrophe or angle bracket would otherwise mangle the markup.
 */
function escapeHtml(value) {
  if (value == null) return '';
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

function money(n) {
  return `Rs. ${Number(n || 0).toFixed(2)}`;
}

/** Render an ISO timestamp in the configured delivery timezone, not UTC. */
function formatDateTime(iso) {
  if (!iso) return null;
  const m = moment.tz(iso, config.timezone);
  return m.isValid() ? m.format('D MMM YYYY, h:mm A') : null;
}

/**
 * Charge breakdown for an order: items, delivery, then each configured extra
 * charge by name. Without this the recipient sees only a grand total that is
 * larger than the items add up to, with nothing explaining the difference.
 */
function chargeRows(order) {
  const rows = [['Items', Number(order?.items_total) || 0]];

  const delivery = Number(order?.delivery_charge) || 0;
  if (delivery > 0) rows.push(['Delivery', delivery]);

  for (const charge of order?.extra_charges || []) {
    const amount = Number(charge?.amount) || 0;
    if (amount !== 0) rows.push([charge?.name || 'Charge', amount]);
  }

  return rows;
}

/** The charge breakdown plus the grand total, column-aligned for the text part. */
function chargesText(order) {
  const rows = [...chargeRows(order), ['Total', Number(order?.total_amount) || 0]];
  const labelWidth = Math.max(...rows.map(([label]) => String(label).length));
  const amountWidth = Math.max(...rows.map(([, value]) => money(value).length));
  return rows
    .map(([label, value]) => `  ${String(label).padEnd(labelWidth)}   ${money(value).padStart(amountWidth)}`)
    .join('\n');
}

function itemsText(items = []) {
  if (!items.length) return null;
  return items
    .map((i) => `  - ${i?.product_name || 'Item'} x ${i?.quantity || 0} ${i?.unit || ''}`.trimEnd()
      + `  ${money(i?.total)}`)
    .join('\n');
}

function itemsHtml(items = []) {
  if (!items.length) return '';
  const rows = items
    .map((i) => `<tr>
            <td style="padding:6px 12px 6px 0;color:#334155;">${escapeHtml(i?.product_name || 'Item')}
              <span style="color:#94a3b8;">x ${escapeHtml(i?.quantity || 0)} ${escapeHtml(i?.unit || '')}</span>
            </td>
            <td style="padding:6px 0;text-align:right;color:#334155;white-space:nowrap;">${money(i?.total)}</td>
          </tr>`)
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>`;
}

function chargesHtml(order) {
  const rows = chargeRows(order)
    .map(([label, value]) => `<tr>
            <td style="padding:3px 12px 3px 0;color:#64748b;font-size:13px;">${escapeHtml(label)}</td>
            <td style="padding:3px 0;text-align:right;color:#64748b;font-size:13px;white-space:nowrap;">${money(value)}</td>
          </tr>`)
    .join('');
  return `<table style="width:100%;border-collapse:collapse;">${rows}
          <tr>
            <td style="padding:8px 12px 0 0;border-top:1px solid #e2e8f0;font-weight:700;color:#0f172a;">Total</td>
            <td style="padding:8px 0 0;border-top:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0f172a;white-space:nowrap;">${money(order?.total_amount)}</td>
          </tr>
        </table>`;
}

/** Shared chrome so every alert we send looks like it came from the same system. */
function layout({ title, preheader, bodyHtml }) {
  return `<div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f1f5f9;">${escapeHtml(preheader || '')}</span>
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="padding:14px 24px;background:#0f172a;">
      <span style="color:#ffffff;font-size:15px;font-weight:700;letter-spacing:.3px;">${BRAND}</span>
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 18px;font-size:19px;line-height:1.3;color:#0f172a;">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:11px;color:#94a3b8;">Automated alert from the ${BRAND} admin system.</p>
    </div>
  </div>
</div>`;
}

/**
 * Alert for a newly placed instant order. `adminUrl` is optional; when set it
 * becomes a deep link to the orders screen so the alert is one tap from action.
 */
function renderInstantOrderCreated({ orderId, order, customer, adminUrl }) {
  const name = customer?.name || 'A customer';
  const phone = customer?.phone || null;
  const address = customer?.address || null;
  const total = money(order?.total_amount);
  const eta = Number(order?.eta_minutes) || 0;
  const expiresAt = formatDateTime(order?.expires_at);
  const items = Array.isArray(order?.items) ? order.items : [];

  const subject = `New Instant Order — ${name} (${total})`;

  const text = [
    'A new instant order has been placed.',
    '',
    `Order ID: ${orderId}`,
    `Customer: ${name}${phone ? ` · ${phone}` : ''}`,
    address ? `Address: ${address}` : null,
    eta ? `ETA: ${eta} minutes` : null,
    expiresAt ? `Accept before: ${expiresAt}` : null,
    '',
    items.length ? 'Items' : null,
    itemsText(items),
    items.length ? '' : null,
    chargesText(order),
    '',
    'Payment: Cash on delivery',
    adminUrl ? `Open in admin: ${adminUrl}` : null,
  ]
    .filter((line) => line !== null && line !== undefined)
    .join('\n');

  const bodyHtml = `<p style="margin:0 0 2px;font-size:15px;color:#0f172a;"><strong>${escapeHtml(name)}</strong>${
    phone ? `<span style="color:#64748b;"> · ${escapeHtml(phone)}</span>` : ''
  }</p>
      ${address ? `<p style="margin:0 0 14px;font-size:13px;color:#475569;">${escapeHtml(address)}</p>` : ''}
      <p style="margin:0 0 18px;font-size:12px;color:#94a3b8;">Order ${escapeHtml(orderId)}${
        eta ? ` &middot; ETA ${eta} min` : ''
      }</p>
      ${expiresAt ? `<p style="margin:0 0 18px;padding:8px 12px;background:#fff7ed;border-left:3px solid #fb923c;font-size:13px;color:#9a3412;">Accept before <strong>${escapeHtml(expiresAt)}</strong></p>` : ''}
      ${itemsHtml(items)}
      <div style="margin-top:18px;padding-top:14px;border-top:1px solid #f1f5f9;">
        ${chargesHtml(order)}
      </div>
      <p style="margin:14px 0 0;font-size:12px;color:#64748b;">Payment: Cash on delivery</p>
      ${adminUrl ? `<p style="margin:22px 0 0;"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:10px 18px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">Open in admin panel</a></p>` : ''}`;

  return {
    subject,
    text,
    html: layout({
      title: 'New Instant Order',
      preheader: `${name} · ${total}`,
      bodyHtml,
    }),
  };
}

/**
 * Sent by the "Send test email" button so the Gmail credentials can be proven
 * end-to-end without waiting for a real customer order.
 */
function renderTestEmail({ triggeredBy } = {}) {
  const at = formatDateTime(moment.tz(config.timezone).toISOString());
  const by = triggeredBy || 'an admin';

  const text = [
    'This is a test email from the YaduOne admin panel.',
    '',
    'If you are reading this, the Gmail credentials on the backend are working',
    'and this address will receive instant-order alerts.',
    '',
    `Triggered by: ${by}`,
    `Sent at: ${at}`,
  ].join('\n');

  const bodyHtml = `<p style="margin:0 0 14px;font-size:14px;color:#334155;line-height:1.55;">
        If you are reading this, the Gmail credentials on the backend are working and this
        address will receive instant-order alerts.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#64748b;">
        <tr><td style="padding:3px 12px 3px 0;">Triggered by</td><td style="padding:3px 0;text-align:right;">${escapeHtml(by)}</td></tr>
        <tr><td style="padding:3px 12px 3px 0;">Sent at</td><td style="padding:3px 0;text-align:right;">${escapeHtml(at)}</td></tr>
      </table>`;

  return {
    subject: `${BRAND} — test email`,
    text,
    html: layout({
      title: 'Test email',
      preheader: 'Your Gmail alert setup is working.',
      bodyHtml,
    }),
  };
}

module.exports = {
  BRAND,
  escapeHtml,
  money,
  formatDateTime,
  chargeRows,
  renderInstantOrderCreated,
  renderTestEmail,
};
