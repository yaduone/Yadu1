// Covers the two halves of the email pipeline separately:
//   1. email.templates — pure rendering, asserted on the exact output strings.
//   2. email.service   — the gates that decide whether a send happens at all,
//                        with nodemailer and Firestore stubbed so no mail leaves
//                        the machine and no credentials are needed.

jest.mock('nodemailer');
jest.mock('../src/modules/settings/emailNotifications.service');

const nodemailer = require('nodemailer');
const emailConfig = require('../src/modules/settings/emailNotifications.service');
const templates = require('../src/modules/notifications/email.templates');
const emailService = require('../src/modules/notifications/email.service');

const ORDER = {
  items: [
    { product_name: 'Full Cream Milk', quantity: 2, unit: 'ltr', total: 130 },
    { product_name: 'Paneer', quantity: 1, unit: 'pkt', total: 100 },
  ],
  items_total: 230,
  delivery_charge: 15,
  extra_charges: [{ id: 'chg_1', name: 'Platform fee', amount: 5 }],
  extra_charges_total: 5,
  total_amount: 250,
  eta_minutes: 30,
  expires_at: '2026-08-09T09:30:00.000Z',
};

const CUSTOMER = { name: 'Ravi Kumar', phone: '9876543210', address: '12 MG Road, Indore' };

describe('email.templates.escapeHtml', () => {
  it('escapes every character that can break out of markup', () => {
    expect(templates.escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;'
    );
  });

  it('renders null and undefined as an empty string, not "null"', () => {
    expect(templates.escapeHtml(null)).toBe('');
    expect(templates.escapeHtml(undefined)).toBe('');
  });
});

describe('email.templates.chargeRows', () => {
  it('breaks the total down into items, delivery and each named extra charge', () => {
    expect(templates.chargeRows(ORDER)).toEqual([
      ['Items', 230],
      ['Delivery', 15],
      ['Platform fee', 5],
    ]);
  });

  it('omits a zero delivery charge and zero-amount extras', () => {
    expect(templates.chargeRows({
      items_total: 100,
      delivery_charge: 0,
      extra_charges: [{ name: 'Waived fee', amount: 0 }],
    })).toEqual([['Items', 100]]);
  });

  it('survives an order with no charge fields at all', () => {
    expect(templates.chargeRows({})).toEqual([['Items', 0]]);
    expect(templates.chargeRows(undefined)).toEqual([['Items', 0]]);
  });
});

describe('email.templates.renderInstantOrderCreated', () => {
  const rendered = templates.renderInstantOrderCreated({
    orderId: 'ord_123',
    order: ORDER,
    customer: CUSTOMER,
    adminUrl: 'https://admin.example.com/instant-orders',
  });

  it('puts the customer and the total in the subject', () => {
    expect(rendered.subject).toBe('New Instant Order — Ravi Kumar (Rs. 250.00)');
  });

  it('lists the items in the plain-text part, not just the HTML part', () => {
    expect(rendered.text).toContain('Full Cream Milk x 2 ltr');
    expect(rendered.text).toContain('Paneer x 1 pkt');
  });

  it('shows the charge breakdown so the total is explained', () => {
    expect(rendered.text).toContain('Items');
    expect(rendered.text).toContain('Delivery');
    expect(rendered.text).toContain('Platform fee');
    expect(rendered.text).toMatch(/Total\s+Rs\. 250\.00/);
    expect(rendered.html).toContain('Platform fee');
  });

  it('carries the ETA and the acceptance deadline', () => {
    expect(rendered.text).toContain('ETA: 30 minutes');
    // 09:30 UTC is 15:00 in Asia/Kolkata — the deadline must be shown in the
    // delivery timezone, not UTC, or the admin reads it 5.5 hours early.
    expect(rendered.text).toContain('Accept before: 9 Aug 2026, 3:00 PM');
    expect(rendered.html).toContain('9 Aug 2026, 3:00 PM');
  });

  it('includes the admin deep link when one is supplied', () => {
    expect(rendered.html).toContain('https://admin.example.com/instant-orders');
    expect(rendered.text).toContain('Open in admin: https://admin.example.com/instant-orders');
  });

  it('omits the deep link entirely when none is supplied', () => {
    const plain = templates.renderInstantOrderCreated({ orderId: 'x', order: ORDER, customer: CUSTOMER });
    expect(plain.html).not.toContain('Open in admin panel');
    expect(plain.text).not.toContain('Open in admin');
  });

  it('escapes customer and product names in the HTML part', () => {
    const nasty = templates.renderInstantOrderCreated({
      orderId: 'ord_1',
      order: { ...ORDER, items: [{ product_name: '<b>Milk</b>', quantity: 1, unit: 'ltr', total: 50 }] },
      customer: { name: `Ravi "The <boss>" & Co`, phone: '99', address: '<script>x</script>' },
    });
    expect(nasty.html).not.toContain('<b>Milk</b>');
    expect(nasty.html).not.toContain('<script>x</script>');
    expect(nasty.html).toContain('&lt;b&gt;Milk&lt;/b&gt;');
    expect(nasty.html).toContain('&amp; Co');
    // The subject is a header, not markup — it stays human-readable.
    expect(nasty.subject).toContain('Ravi "The <boss>" & Co');
  });

  it('degrades gracefully when the customer record is empty', () => {
    const anon = templates.renderInstantOrderCreated({ orderId: 'ord_1', order: ORDER, customer: {} });
    expect(anon.subject).toContain('A customer');
    expect(anon.text).not.toContain('Address:');
    expect(anon.text).toContain('Customer: A customer');
  });

  it('handles an order with no items without emitting an empty table', () => {
    const empty = templates.renderInstantOrderCreated({
      orderId: 'ord_1',
      order: { ...ORDER, items: [] },
      customer: CUSTOMER,
    });
    expect(empty.html).not.toContain('<table style="width:100%;border-collapse:collapse;font-size:14px;">');
    expect(empty.subject).toBe('New Instant Order — Ravi Kumar (Rs. 250.00)');
  });
});

describe('email.service gating', () => {
  let sendMailMock;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService.resetTransport();
    process.env.GMAIL_USER = 'alerts@example.com';
    process.env.GMAIL_APP_PASSWORD = 'abcdefghijklmnop';
    delete process.env.ADMIN_PANEL_URL;

    sendMailMock = jest.fn().mockResolvedValue({ messageId: '<abc@example.com>' });
    nodemailer.createTransport.mockReturnValue({
      sendMail: sendMailMock,
      verify: jest.fn().mockResolvedValue(true),
    });

    emailConfig.getConfig.mockResolvedValue({
      enabled: true,
      instant_order_created: true,
      recipients: ['ops@example.com'],
    });
  });

  const send = () => emailService.sendInstantOrderCreatedEmail({
    orderId: 'ord_123',
    order: ORDER,
    customer: CUSTOMER,
  });

  it('sends when the env vars, the master switch and the recipients all line up', async () => {
    const result = await send();
    expect(result.sent).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const payload = sendMailMock.mock.calls[0][0];
    expect(payload.to).toBe('ops@example.com');
    expect(payload.from).toBe('"YaduOne" <alerts@example.com>');
    expect(payload.subject).toContain('Ravi Kumar');
    expect(payload.text).toBeTruthy();
    expect(payload.html).toBeTruthy();
  });

  it('reports which switch stopped it — the master switch', async () => {
    emailConfig.getConfig.mockResolvedValue({
      enabled: false,
      instant_order_created: true,
      recipients: ['ops@example.com'],
    });
    const result = await send();
    expect(result).toMatchObject({ sent: false, reason: 'disabled' });
    expect(result.message).toContain('Email Alerts');
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('reports which switch stopped it — the per-trigger switch', async () => {
    emailConfig.getConfig.mockResolvedValue({
      enabled: true,
      instant_order_created: false,
      recipients: ['ops@example.com'],
    });
    expect(await send()).toMatchObject({ sent: false, reason: 'trigger_disabled' });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('reports which switch stopped it — an empty recipient list', async () => {
    emailConfig.getConfig.mockResolvedValue({
      enabled: true,
      instant_order_created: true,
      recipients: [],
    });
    expect(await send()).toMatchObject({ sent: false, reason: 'no_recipients' });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('reports missing credentials rather than pretending to send', async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    emailService.resetTransport();

    expect(emailService.isConfigured()).toBe(false);
    expect(await send()).toMatchObject({ sent: false, reason: 'not_configured' });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('tolerates an app password pasted with the spaces Google displays', async () => {
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    emailService.resetTransport();

    await send();
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: 'alerts@example.com', pass: 'abcdefghijklmnop' } })
    );
  });

  it('builds the transport with timeouts so a blocked port cannot hang a request', async () => {
    await send();
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        connectionTimeout: expect.any(Number),
        greetingTimeout: expect.any(Number),
        socketTimeout: expect.any(Number),
      })
    );
    const opts = nodemailer.createTransport.mock.calls[0][0];
    expect(opts.connectionTimeout).toBeLessThanOrEqual(15000);
    expect(opts.socketTimeout).toBeLessThanOrEqual(30000);
  });

  it('gives up rather than hanging when the SMTP socket never answers', async () => {
    // A host that blackholes outbound SMTP looks exactly like this: the promise
    // simply never settles. The request must still come back to the caller.
    nodemailer.createTransport.mockReturnValue({
      sendMail: jest.fn(() => new Promise(() => {})),
      verify: jest.fn(() => new Promise(() => {})),
    });
    emailService.resetTransport();

    const result = await send();
    expect(result).toMatchObject({ sent: false, reason: 'smtp_timeout' });
    expect(result.message).toContain('SMTP_PORT=587');
  }, 40000);

  it('maps a connection-level error to the timeout hint, not a login failure', async () => {
    sendMailMock.mockRejectedValue(Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' }));
    const result = await send();
    expect(result).toMatchObject({ sent: false, reason: 'smtp_timeout' });
  });

  it('honours an SMTP_PORT override for hosts that only allow 587', async () => {
    process.env.SMTP_PORT = '587';
    emailService.resetTransport();
    try {
      await send();
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.gmail.com', port: 587, secure: false })
      );
    } finally {
      delete process.env.SMTP_PORT;
    }
  });

  it('rebuilds the transport when the port changes instead of reusing the old one', async () => {
    await send();
    process.env.SMTP_PORT = '587';
    try {
      await send();
      const ports = nodemailer.createTransport.mock.calls.map(([o]) => o.port);
      expect(ports).toEqual([465, 587]);
    } finally {
      delete process.env.SMTP_PORT;
    }
  });

  it('never throws when Gmail rejects the message', async () => {
    sendMailMock.mockRejectedValue(new Error('Invalid login: 535-5.7.8'));
    const result = await send();
    expect(result).toMatchObject({ sent: false, reason: 'smtp_error' });
    expect(result.message).toContain('535-5.7.8');
  });

  it('never throws when the settings document cannot be read', async () => {
    emailConfig.getConfig.mockRejectedValue(new Error('firestore unavailable'));
    expect(await send()).toMatchObject({ sent: false, reason: 'config_error' });
  });

  it('adds the admin deep link only when ADMIN_PANEL_URL is set', async () => {
    process.env.ADMIN_PANEL_URL = 'https://admin.example.com/';
    await send();
    expect(sendMailMock.mock.calls[0][0].html).toContain('https://admin.example.com/instant-orders');
  });

  it('sends to every configured recipient at once', async () => {
    emailConfig.getConfig.mockResolvedValue({
      enabled: true,
      instant_order_created: true,
      recipients: ['a@example.com', 'b@example.com'],
    });
    await send();
    expect(sendMailMock.mock.calls[0][0].to).toBe('a@example.com, b@example.com');
  });
});

describe('email.service.sendTestEmail', () => {
  let sendMailMock;
  let verifyMock;

  beforeEach(() => {
    jest.clearAllMocks();
    emailService.resetTransport();
    process.env.GMAIL_USER = 'alerts@example.com';
    process.env.GMAIL_APP_PASSWORD = 'abcdefghijklmnop';

    sendMailMock = jest.fn().mockResolvedValue({ messageId: '<test@example.com>' });
    verifyMock = jest.fn().mockResolvedValue(true);
    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock, verify: verifyMock });

    emailConfig.getConfig.mockResolvedValue({
      enabled: false,
      instant_order_created: true,
      recipients: ['saved@example.com'],
    });
  });

  it('sends even though the master switch is off — you test before enabling', async () => {
    const result = await emailService.sendTestEmail({ to: 'me@example.com', triggeredBy: 'admin1' });
    expect(result.sent).toBe(true);
    expect(sendMailMock.mock.calls[0][0].to).toBe('me@example.com');
    expect(sendMailMock.mock.calls[0][0].subject).toBe('YaduOne — test email');
    expect(sendMailMock.mock.calls[0][0].text).toContain('admin1');
  });

  it('falls back to the saved recipients when no address is given', async () => {
    await emailService.sendTestEmail({});
    expect(sendMailMock.mock.calls[0][0].to).toBe('saved@example.com');
  });

  it('checks the credentials before composing anything', async () => {
    verifyMock.mockRejectedValue(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'));
    const result = await emailService.sendTestEmail({ to: 'me@example.com' });
    expect(result).toMatchObject({ sent: false, reason: 'smtp_error' });
    expect(result.message).toContain('Username and Password not accepted');
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('refuses when there is nowhere to send', async () => {
    emailConfig.getConfig.mockResolvedValue({ enabled: false, instant_order_created: true, recipients: [] });
    expect(await emailService.sendTestEmail({})).toMatchObject({ sent: false, reason: 'no_recipients' });
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
