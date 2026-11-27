/**
 * dueReport.export.js — render a customer statement (see dueReport.service)
 * as CSV, Excel (.xlsx) or a branded A4 PDF.
 *
 * Every renderer reads the same statement object, so the three formats always
 * agree on the numbers.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment-timezone');
const config = require('../../config');

const BRAND = {
  name: 'YaduONE',
  tagline: 'Pure Milk  ·  Pure Health  ·  Pure Trust',
  email: 'yaduone111@gmail.com',
  phone: '+91 92867 34980',
};

const LOGO_PATH = path.join(__dirname, '../../../assets/brand/yaduone-logo.png');
const HAS_LOGO = fs.existsSync(LOGO_PATH);

// ─── Shared formatting ────────────────────────────────────────────────────────

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** pdfkit's built-in fonts have no ₹ glyph, so the PDF spells it "Rs.". */
function rs(value) {
  const n = Number(value) || 0;
  return `${n < 0 ? '-' : ''}Rs. ${inr.format(Math.abs(n))}`;
}

function balanceLabel(value) {
  const n = Number(value) || 0;
  if (n > 0) return `${rs(n)} due`;
  if (n < 0) return `${rs(-n)} advance`;
  return rs(0);
}

function shortDate(date) {
  return date ? moment.tz(date, 'YYYY-MM-DD', config.timezone).format('D MMM YYYY') : '';
}

function stamp(iso) {
  return iso ? moment(iso).tz(config.timezone).format('D MMM YYYY, h:mm A') : '';
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

function statementNumber(statement) {
  const id = String(statement.customer.id || '').replace(/[^a-z0-9]/gi, '').slice(-5).toUpperCase();
  return `ST-${statement.period.to.replace(/-/g, '')}${id ? `-${id}` : ''}`;
}

function reportFilename(statement, ext) {
  const who = slug(statement.customer.name) || slug(statement.customer.phone) || 'customer';
  return `statement_${who}_${statement.period.from}_to_${statement.period.to}.${ext}`;
}

const METHOD_ORDER = ['cash', 'upi', 'other'];
const METHOD_LABELS = { cash: 'Cash', upi: 'UPI', other: 'Other' };

function methodBreakdown(byMethod) {
  return Object.keys(byMethod || {})
    .sort((a, b) => METHOD_ORDER.indexOf(a) - METHOD_ORDER.indexOf(b))
    .map((m) => `${METHOD_LABELS[m] || m} ${rs(byMethod[m])}`)
    .join(', ');
}

function summaryRows(statement) {
  const s = statement.summary;
  const rows = [
    ['Opening balance', s.opening_balance, 'money'],
    ['Charges for deliveries', s.billed, 'money'],
    ['Dues added manually', s.adjustment_charges, 'money'],
    ['Payments received', s.paid, 'money'],
    ['Dues reduced manually', s.adjustment_credits, 'money'],
    ['Closing balance', s.closing_balance, 'money'],
    ['Scheduled orders in period', s.orders_total, 'count'],
    ['Delivered', s.orders_delivered, 'count'],
    ['Not delivered / cancelled / skipped', s.orders_not_delivered, 'count'],
    ['Pending', s.orders_pending, 'count'],
    ['Milk delivered (litres)', s.milk_litres_delivered, 'number'],
    ['Milk charges', s.milk_amount, 'money'],
    ['Extra product charges', s.extras_amount, 'money'],
    ['Payments recorded', s.payments_count, 'count'],
    ['Manual adjustments', s.adjustments_count, 'count'],
  ];
  METHOD_ORDER.concat(Object.keys(s.payments_by_method || {}).filter((m) => !METHOD_ORDER.includes(m)))
    .filter((m) => s.payments_by_method?.[m])
    .forEach((m) => rows.push([`  Paid by ${METHOD_LABELS[m] || m}`, s.payments_by_method[m], 'money']));
  rows.push(
    ['Instant orders (cash on delivery)', s.instant_orders_total, 'count'],
    ['Instant orders delivered', s.instant_orders_delivered, 'count'],
    ['Instant COD collected', s.instant_cod_amount, 'money'],
    ['Instant orders added to due', s.instant_added_to_due_amount, 'money'],
    ['  of which delivery charges', s.instant_delivery_charges, 'money'],
    ['  of which other charges', s.instant_extra_charges, 'money'],
    ['Account balance today', s.account_balance_today, 'money'],
  );
  if (s.unreconciled_adjustment) {
    rows.push(['Balance changes with no record', s.unreconciled_adjustment, 'money']);
  }
  return rows;
}

function adjustmentNote(statement) {
  const adj = statement.summary.unreconciled_adjustment;
  if (!adj) return null;
  return `The account balance today (${balanceLabel(statement.summary.account_balance_today)}) differs from the balance `
    + `rebuilt from orders, payments and adjustments by ${rs(adj)}. Something changed the balance without leaving `
    + 'a record (for example an old script or a direct database edit).';
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

const KIND_LABELS = {
  opening: 'Opening',
  charge: 'Delivery',
  payment: 'Payment',
  adjustment_charge: 'Due added',
  adjustment_credit: 'Due reduced',
  reversal: 'Reversal',
};

function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = String(value);
  // A name or note starting with = + - @ would run as a formula in Excel.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(statement) {
  const c = statement.customer;
  const lines = [];
  const row = (...cells) => lines.push(cells.map(csvCell).join(','));
  const blank = () => lines.push('');

  row(`${BRAND.name} Account Statement`);
  row('Statement no.', statementNumber(statement));
  row('Customer', c.name);
  row('Phone', c.phone);
  row('Address', c.address);
  row('Area', c.area_name);
  row('Period from', statement.period.from);
  row('Period to', statement.period.to);
  row('Generated at', stamp(statement.generated_at));
  blank();

  row('SUMMARY');
  summaryRows(statement).forEach(([label, value]) => row(label.trim(), value));
  const note = adjustmentNote(statement);
  if (note) row('Note', note);
  blank();

  row('LEDGER');
  row('Date', 'Type', 'Particulars', 'Charges', 'Payments / credits', 'Balance');
  statement.ledger.forEach((e) => row(
    e.date,
    KIND_LABELS[e.kind] || e.kind,
    e.description,
    e.debit || '',
    e.credit || '',
    e.balance,
  ));
  row('', '', 'Closing balance', statement.summary.total_charges, statement.summary.total_credits, statement.summary.closing_balance);
  blank();

  row('ORDERS');
  row('Date', 'Slot', 'Status', 'Reason', 'Items', 'Milk (L)', 'Milk amount', 'Extras amount', 'Order total', 'Billed');
  statement.orders.forEach((o) => row(
    o.date, o.slot_label, o.status_label, o.reason_label || '', o.description,
    o.milk ? o.milk.quantity_litres : '', o.milk_amount, o.extras_amount, o.total_amount, o.billed_amount,
  ));
  blank();

  row('PAYMENTS');
  row('Date', 'Method', 'Notes', 'Amount');
  statement.payments.forEach((p) => row(p.date, p.method_label, p.notes || '', p.amount));
  blank();

  row('MANUAL ADJUSTMENTS');
  row('Date', 'Type', 'Category', 'Note', 'Amount', 'Status', 'Reversed on', 'Reversal reason', 'By');
  statement.adjustments.forEach((a) => row(
    a.date, a.type_label, a.category_label, a.note || '', a.type === 'credit' ? -a.amount : a.amount,
    a.voided ? 'Reversed' : 'Active', a.voided_on || '', a.void_reason || '', a.created_by || '',
  ));
  blank();

  row('INSTANT ORDERS (cash on delivery - only in the balance when added to due)');
  row('Date', 'Placed at', 'Status', 'Items', 'Items total', 'Delivery charge', 'Other charges', 'Total', 'Added to due');
  statement.instant_orders.forEach((o) => row(
    o.date, stamp(o.placed_at), o.status_label, o.description,
    o.items_total, o.delivery_charge, o.extra_charges_total, o.total_amount, o.added_to_due ? 'Yes' : 'No',
  ));

  // BOM so Excel opens the file as UTF-8 (names, notes, product names).
  return Buffer.from(`﻿${lines.join('\r\n')}\r\n`, 'utf8');
}

// ─── Excel ────────────────────────────────────────────────────────────────────

const XL = {
  money: '"₹"#,##0.00;[Red]-"₹"#,##0.00',
  number: '#,##0.###',
  count: '0',
  date: 'dd-mmm-yyyy',
  headerFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D3F8F' } },
  softFill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F8FC' } },
};

function xlDate(date) {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addTableSheet(workbook, name, columns, rows, { totals } = {}) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map((col) => ({ header: col.header, key: col.key, width: col.width || 14 }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = XL.headerFill;
  header.alignment = { vertical: 'middle' };
  header.height = 20;

  rows.forEach((r) => sheet.addRow(r));
  if (totals) {
    const totalRow = sheet.addRow(totals);
    totalRow.font = { bold: true };
    totalRow.fill = XL.softFill;
  }

  columns.forEach((col, i) => {
    const column = sheet.getColumn(i + 1);
    if (col.format) column.numFmt = XL[col.format] || col.format;
    if (col.wrap) column.alignment = { wrapText: true, vertical: 'top' };
  });
  header.alignment = { vertical: 'middle' };

  if (rows.length) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: columns.length } };
  }
  return sheet;
}

async function toXlsx(statement) {
  const c = statement.customer;
  const s = statement.summary;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.name;
  workbook.created = new Date(statement.generated_at);

  // Summary sheet
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ width: 42 }, { width: 22 }];
  summary.mergeCells('A1:B1');
  summary.getCell('A1').value = `${BRAND.name} — Account Statement`;
  summary.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF0B2540' } };
  summary.getRow(1).height = 24;

  const info = [
    ['Statement no.', statementNumber(statement)],
    ['Customer', c.name],
    ['Phone', c.phone],
    ['Address', c.address],
    ['Area', c.area_name],
    ['Period from', xlDate(statement.period.from)],
    ['Period to', xlDate(statement.period.to)],
    ['Days', statement.period.days],
    ['Generated at', stamp(statement.generated_at)],
  ];
  info.forEach(([label, value]) => {
    const r = summary.addRow([label, value]);
    r.getCell(1).font = { bold: true, color: { argb: 'FF5B7083' } };
    if (value instanceof Date) r.getCell(2).numFmt = XL.date;
    r.getCell(2).alignment = { horizontal: 'left', wrapText: true };
  });
  summary.addRow([]);

  const head = summary.addRow(['Summary', 'Amount']);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = XL.headerFill;
  summaryRows(statement).forEach(([label, value, kind]) => {
    const r = summary.addRow([label, value]);
    r.getCell(2).numFmt = XL[kind];
    if (['Opening balance', 'Closing balance'].includes(label)) {
      r.font = { bold: true };
      r.fill = XL.softFill;
    }
  });
  const note = adjustmentNote(statement);
  if (note) {
    summary.addRow([]);
    const r = summary.addRow([`Note: ${note}`]);
    summary.mergeCells(`A${r.number}:B${r.number}`);
    r.getCell(1).alignment = { wrapText: true };
    r.height = 48;
  }

  addTableSheet(workbook, 'Ledger', [
    { header: 'Date', key: 'date', width: 13, format: 'date' },
    { header: 'Type', key: 'type', width: 13 },
    { header: 'Particulars', key: 'description', width: 60, wrap: true },
    { header: 'Charges', key: 'debit', width: 14, format: 'money' },
    { header: 'Payments / credits', key: 'credit', width: 17, format: 'money' },
    { header: 'Balance', key: 'balance', width: 15, format: 'money' },
  ], statement.ledger.map((e) => ({
    date: xlDate(e.date),
    type: KIND_LABELS[e.kind] || e.kind,
    description: e.description,
    debit: e.debit || null,
    credit: e.credit || null,
    balance: e.balance,
  })), {
    totals: { description: 'Closing balance', debit: s.total_charges, credit: s.total_credits, balance: s.closing_balance },
  });

  addTableSheet(workbook, 'Orders', [
    { header: 'Date', key: 'date', width: 13, format: 'date' },
    { header: 'Slot', key: 'slot', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Reason', key: 'reason', width: 22 },
    { header: 'Milk', key: 'milk', width: 14 },
    { header: 'Milk qty (L)', key: 'qty', width: 12, format: 'number' },
    { header: 'Rate / L', key: 'rate', width: 11, format: 'money' },
    { header: 'Milk amount', key: 'milk_amount', width: 13, format: 'money' },
    { header: 'Extra items', key: 'extras', width: 40, wrap: true },
    { header: 'Extras amount', key: 'extras_amount', width: 14, format: 'money' },
    { header: 'Order total', key: 'total', width: 13, format: 'money' },
    { header: 'Billed', key: 'billed', width: 13, format: 'money' },
  ], statement.orders.map((o) => ({
    date: xlDate(o.date),
    slot: o.slot_label,
    status: o.status_label,
    reason: o.reason_label || '',
    milk: o.milk?.label || '',
    qty: o.milk ? o.milk.quantity_litres : null,
    rate: o.milk ? o.milk.price_per_litre : null,
    milk_amount: o.milk_amount,
    extras: o.extra_items.map((i) => `${i.product_name} x${i.quantity}${i.unit ? ` ${i.unit}` : ''}`).join(', '),
    extras_amount: o.extras_amount,
    total: o.total_amount,
    billed: o.billed_amount,
  })), {
    totals: {
      slot: 'Total delivered',
      qty: s.milk_litres_delivered,
      milk_amount: s.milk_amount,
      extras_amount: s.extras_amount,
      billed: s.billed,
    },
  });

  const itemRows = [];
  statement.orders.forEach((o) => {
    if (o.milk) {
      itemRows.push({
        date: xlDate(o.date), order: o.id, item: o.milk.label, qty: o.milk.quantity_litres, unit: 'L',
        rate: o.milk.price_per_litre, amount: o.milk.total, status: o.status_label,
        billed: o.status === 'delivered' ? o.milk.total : 0,
      });
    }
    o.extra_items.forEach((i) => itemRows.push({
      date: xlDate(o.date), order: o.id, item: i.product_name, qty: i.quantity, unit: i.unit,
      rate: i.price, amount: i.total, status: o.status_label, billed: o.status === 'delivered' ? i.total : 0,
    }));
  });
  addTableSheet(workbook, 'Order items', [
    { header: 'Date', key: 'date', width: 13, format: 'date' },
    { header: 'Order ID', key: 'order', width: 30 },
    { header: 'Item', key: 'item', width: 28 },
    { header: 'Qty', key: 'qty', width: 8, format: 'number' },
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'Rate', key: 'rate', width: 11, format: 'money' },
    { header: 'Amount', key: 'amount', width: 12, format: 'money' },
    { header: 'Order status', key: 'status', width: 14 },
    { header: 'Billed', key: 'billed', width: 12, format: 'money' },
  ], itemRows);

  addTableSheet(workbook, 'Payments', [
    { header: 'Date', key: 'date', width: 13, format: 'date' },
    { header: 'Method', key: 'method', width: 10 },
    { header: 'Notes', key: 'notes', width: 40, wrap: true },
    { header: 'Amount', key: 'amount', width: 14, format: 'money' },
    { header: 'Recorded at', key: 'recorded', width: 22 },
  ], statement.payments.map((p) => ({
    date: xlDate(p.date), method: p.method_label, notes: p.notes || '', amount: p.amount, recorded: stamp(p.recorded_at),
  })), { totals: { notes: 'Total received', amount: s.paid } });

  addTableSheet(workbook, 'Adjustments', [
    { header: 'Date', key: 'date', width: 13, format: 'date' },
    { header: 'Type', key: 'type', width: 13 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Note', key: 'note', width: 40, wrap: true },
    { header: 'Amount', key: 'amount', width: 14, format: 'money' },
    { header: 'Status', key: 'status', width: 11 },
    { header: 'Reversed on', key: 'voided_on', width: 13, format: 'date' },
    { header: 'Reversal reason', key: 'void_reason', width: 28, wrap: true },
    { header: 'By', key: 'by', width: 16 },
  ], statement.adjustments.map((a) => ({
    date: xlDate(a.date),
    type: a.type_label,
    category: a.category_label,
    note: a.note || '',
    amount: a.type === 'credit' ? -a.amount : a.amount,
    status: a.voided ? 'Reversed' : 'Active',
    voided_on: xlDate(a.voided_on),
    void_reason: a.void_reason || '',
    by: a.created_by || '',
  })));

  addTableSheet(workbook, 'Instant orders', [
    { header: 'Date', key: 'date', width: 13, format: 'date' },
    { header: 'Placed at', key: 'placed', width: 20 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Items', key: 'items', width: 44, wrap: true },
    { header: 'Items total', key: 'items_total', width: 13, format: 'money' },
    { header: 'Delivery charge', key: 'delivery', width: 15, format: 'money' },
    { header: 'Other charges', key: 'other', width: 14, format: 'money' },
    { header: 'Total (COD)', key: 'total', width: 13, format: 'money' },
    { header: 'Added to due', key: 'added', width: 13 },
    { header: 'Rejection reason', key: 'reason', width: 24 },
  ], statement.instant_orders.map((o) => ({
    date: xlDate(o.date), placed: stamp(o.placed_at), status: o.status_label, items: o.description,
    items_total: o.items_total, delivery: o.delivery_charge, other: o.extra_charges_total,
    total: o.total_amount, added: o.added_to_due ? 'Yes' : 'No', reason: o.rejection_reason || '',
  })), {
    totals: {
      items: 'Delivered, paid in cash',
      delivery: s.instant_delivery_charges,
      other: s.instant_extra_charges,
      total: s.instant_cod_amount,
    },
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

const PAGE = { w: 595.28, h: 841.89, m: 36 };
const CONTENT_W = PAGE.w - PAGE.m * 2;
const FOOTER_H = 34;
const BOTTOM_LIMIT = PAGE.h - FOOTER_H - 16;

const C = {
  ink: '#0B2540',
  muted: '#5B7083',
  faint: '#8DA2B5',
  line: '#DCE6EF',
  soft: '#F3F8FC',
  zebra: '#F8FBFD',
  green: '#2F9E5B',
  teal: '#1C7FA6',
  navy: '#1D3F8F',
  red: '#B91C1C',
};

const TONES = {
  green: { bg: '#E3F5EA', fg: '#1E7B45' },
  amber: { bg: '#FFF1DC', fg: '#B45309' },
  red: { bg: '#FDE7E7', fg: '#B91C1C' },
  gray: { bg: '#EEF2F6', fg: '#64748B' },
  blue: { bg: '#E4EFFB', fg: '#1D4F91' },
};

const ORDER_TONE = { delivered: 'green', pending: 'amber', not_delivered: 'gray', cancelled: 'red', skipped: 'gray' };
const INSTANT_TONE = { delivered: 'green', pending: 'amber', acknowledged: 'blue', cancelled: 'red', rejected: 'red' };

function brandGradient(doc, x1, y1, x2, y2) {
  return doc.linearGradient(x1, y1, x2, y2).stop(0, C.green).stop(0.55, C.teal).stop(1, C.navy);
}

function drawLogo(doc, x, y, size) {
  if (!HAS_LOGO) return false;
  doc.roundedRect(x, y, size, size, size * 0.22).fill('#FFFFFF');
  const pad = size * 0.08;
  doc.image(LOGO_PATH, x + pad, y + pad, { width: size - pad * 2, height: size - pad * 2 });
  return true;
}

function pill(doc, x, y, text, tone, width) {
  const h = 14;
  doc.font('Helvetica-Bold').fontSize(7);
  const w = width || doc.widthOfString(text) + 14;
  doc.roundedRect(x, y, w, h, h / 2).fill(tone.bg);
  doc.fillColor(tone.fg).text(text, x, y + 4, { width: w, align: 'center', lineBreak: false });
}

function periodLabel(statement) {
  return `${shortDate(statement.period.from)}  –  ${shortDate(statement.period.to)}`;
}

function drawHeader(doc, statement) {
  const h = 118;
  doc.save();
  doc.moveTo(0, 0).lineTo(PAGE.w, 0).lineTo(PAGE.w, h - 20)
    .bezierCurveTo(PAGE.w * 0.72, h + 8, PAGE.w * 0.36, h - 36, 0, h - 4)
    .closePath()
    .fill(brandGradient(doc, 0, 0, PAGE.w, h));
  doc.fillColor('#FFFFFF').fillOpacity(0.08);
  doc.circle(PAGE.w - 40, 10, 70).fill();
  doc.circle(PAGE.w - 160, 96, 26).fill();
  doc.fillOpacity(1);
  doc.restore();

  const textX = drawLogo(doc, PAGE.m, 26, 56) ? PAGE.m + 70 : PAGE.m;
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(23).text(BRAND.name, textX, 32, { lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor('#E6F4FF').text(BRAND.tagline, textX + 1, 60, { lineBreak: false });

  const rw = 240;
  const rx = PAGE.w - PAGE.m - rw;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#D7ECFF')
    .text('ACCOUNT STATEMENT', rx, 30, { width: rw, align: 'right', characterSpacing: 1.4, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#FFFFFF')
    .text(periodLabel(statement), rx, 44, { width: rw, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor('#E6F4FF')
    .text(`${statement.period.days} day${statement.period.days === 1 ? '' : 's'}  ·  No. ${statementNumber(statement)}`,
      rx, 64, { width: rw, align: 'right', lineBreak: false });
  return h + 12;
}

function drawContinuation(doc, statement) {
  const h = 48;
  doc.rect(0, 0, PAGE.w, h).fill(brandGradient(doc, 0, 0, PAGE.w, h));
  const textX = drawLogo(doc, PAGE.m, 10, 28) ? PAGE.m + 38 : PAGE.m;
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12).text(BRAND.name, textX, 13, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#E6F4FF')
    .text(`Account statement  ·  ${statement.customer.name || statement.customer.phone}  ·  ${periodLabel(statement)} (continued)`,
      textX, 29, { lineBreak: false });
  return h + 18;
}

function drawFooter(doc, statement, pageNo, pageCount) {
  const y = PAGE.h - FOOTER_H;
  doc.rect(0, y, PAGE.w, FOOTER_H).fill(brandGradient(doc, 0, y, PAGE.w, y));
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF')
    .text(BRAND.name, PAGE.m, y + 13, { continued: true, lineBreak: false })
    .font('Helvetica').fillColor('#E6F4FF')
    .text(`   ${BRAND.email}   ·   ${BRAND.phone}`, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor('#E6F4FF')
    .text(`Generated ${stamp(statement.generated_at)}   ·   Page ${pageNo} of ${pageCount}`, PAGE.m, y + 14, {
      width: CONTENT_W, align: 'right', lineBreak: false,
    });
}

function drawCustomer(doc, y, statement) {
  const c = statement.customer;
  doc.font('Helvetica').fontSize(9);
  const addressH = c.address ? Math.min(doc.heightOfString(c.address, { width: CONTENT_W - 32 }), 24) : 11;
  const h = 58 + addressH;
  doc.roundedRect(PAGE.m, y, CONTENT_W, h, 10).fill(C.soft);

  const cells = [
    ['BILLED TO', c.name || '—'],
    ['PHONE', c.phone || '—'],
    ['AREA', c.area_name || '—'],
  ];
  const widths = [CONTENT_W * 0.42, CONTENT_W * 0.26, CONTENT_W * 0.32];
  let x = PAGE.m + 16;
  cells.forEach(([label, value], i) => {
    const w = widths[i] - 20;
    doc.font('Helvetica-Bold').fontSize(6.6).fillColor(C.faint)
      .text(label, x, y + 11, { width: w, characterSpacing: 0.8, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink)
      .text(value, x, y + 22, { width: w, height: 13, ellipsis: true, lineBreak: false });
    x += widths[i];
  });
  doc.font('Helvetica-Bold').fontSize(6.6).fillColor(C.faint)
    .text('ADDRESS', PAGE.m + 16, y + 42, { characterSpacing: 0.8, lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(C.ink)
    .text(c.address || '—', PAGE.m + 16, y + 52, { width: CONTENT_W - 32, height: 24, ellipsis: true });
  return y + h + 12;
}

function drawSummary(doc, y, statement) {
  const s = statement.summary;
  const gap = 8;
  const tileW = (CONTENT_W - gap * 3) / 4;
  const tileH = s.adjustment_charges || s.adjustment_credits ? 64 : 54;
  const closingTone = s.closing_balance > 0 ? TONES.red : s.closing_balance < 0 ? TONES.green : TONES.gray;
  const tiles = [
    { label: 'OPENING BALANCE', value: rs(Math.abs(s.opening_balance)), sub: s.opening_balance < 0 ? 'advance' : s.opening_balance > 0 ? 'due' : 'settled' },
    {
      label: 'CHARGES',
      value: rs(s.total_charges),
      sub: `${s.orders_delivered} deliver${s.orders_delivered === 1 ? 'y' : 'ies'}${s.adjustment_charges ? ` + ${rs(s.adjustment_charges)} added` : ''}`,
    },
    {
      label: s.adjustment_credits ? 'PAYMENTS & CREDITS' : 'PAYMENTS RECEIVED',
      value: rs(s.total_credits),
      sub: `${s.payments_count} payment${s.payments_count === 1 ? '' : 's'}${s.adjustment_credits ? ` + ${rs(s.adjustment_credits)} reduced` : ''}`,
    },
    { label: 'CLOSING BALANCE', value: rs(Math.abs(s.closing_balance)), sub: s.closing_balance < 0 ? 'advance' : s.closing_balance > 0 ? 'amount due' : 'settled', tone: closingTone },
  ];
  tiles.forEach((t, i) => {
    const x = PAGE.m + i * (tileW + gap);
    if (t.tone) doc.roundedRect(x, y, tileW, tileH, 10).fill(t.tone.bg);
    else doc.roundedRect(x, y, tileW, tileH, 10).lineWidth(0.8).strokeColor(C.line).stroke();
    doc.font('Helvetica-Bold').fontSize(6.6).fillColor(t.tone ? t.tone.fg : C.faint)
      .text(t.label, x + 12, y + 10, { width: tileW - 24, characterSpacing: 0.7, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(t.tone ? t.tone.fg : C.ink)
      .text(t.value, x + 12, y + 22, { width: tileW - 24, lineBreak: false, ellipsis: true });
    doc.font('Helvetica').fontSize(7.5).fillColor(t.tone ? t.tone.fg : C.muted)
      .text(t.sub, x + 12, y + 39, { width: tileW - 24, lineBreak: false });
  });
  y += tileH + 10;

  const facts = [
    `Orders: ${s.orders_total} (${s.orders_delivered} delivered, ${s.orders_not_delivered} not delivered${s.orders_pending ? `, ${s.orders_pending} pending` : ''})`,
    `Milk: ${s.milk_litres_delivered} L = ${rs(s.milk_amount)}`,
    `Extras: ${rs(s.extras_amount)}`,
  ];
  if (s.payments_count) facts.push(`Paid via ${methodBreakdown(s.payments_by_method)}`);
  doc.font('Helvetica').fontSize(8.2).fillColor(C.muted)
    .text(facts.join('    ·    '), PAGE.m, y, { width: CONTENT_W, lineGap: 2 });
  return doc.y + 14;
}

function sectionTitle(doc, y, title, accent, aside) {
  doc.roundedRect(PAGE.m, y + 1, 4, 13, 2).fill(accent);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.ink)
    .text(title, PAGE.m + 11, y + 2, { characterSpacing: 0.3, lineBreak: false });
  if (aside) {
    doc.font('Helvetica').fontSize(8).fillColor(C.muted)
      .text(aside, PAGE.m, y + 3.5, { width: CONTENT_W, align: 'right', lineBreak: false });
  }
  return y + 21;
}

/**
 * Table with wrapped cells, zebra rows and page breaks that repeat the header.
 * columns: [{ title, w, align, render(row) -> string | { pill, tone }, bold }]
 */
function drawTable(ctx, columns, rows, { totals, emptyText = 'Nothing in this period.' } = {}) {
  const { doc } = ctx;
  const padX = 7;
  const headerH = 20;
  const fontSize = 8.4;

  const drawHeaderRow = () => {
    doc.roundedRect(PAGE.m, ctx.y, CONTENT_W, headerH, 5).fill(C.soft);
    let x = PAGE.m;
    columns.forEach((col) => {
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(C.muted)
        .text(col.title, x + padX, ctx.y + 7, { width: col.w - padX * 2, align: col.align || 'left', characterSpacing: 0.6, lineBreak: false });
      x += col.w;
    });
    ctx.y += headerH;
  };

  const cellText = (col, row) => {
    const v = col.render(row);
    return v && typeof v === 'object' ? v : { text: v === null || v === undefined ? '' : String(v) };
  };

  const rowHeight = (cells) => {
    let h = 0;
    cells.forEach((cell, i) => {
      if (cell.pill) { h = Math.max(h, 14); return; }
      doc.font(columns[i].bold || cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
      h = Math.max(h, doc.heightOfString(cell.text || ' ', { width: columns[i].w - padX * 2, lineGap: 1 }));
    });
    return Math.max(20, h + 11);
  };

  ctx.ensureSpace(headerH + 22);
  drawHeaderRow();

  if (!rows.length) {
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(C.faint)
      .text(emptyText, PAGE.m + padX, ctx.y + 8, { width: CONTENT_W - padX * 2 });
    ctx.y += 26;
    return;
  }

  const allRows = totals ? [...rows, { __totals: true }] : rows;
  allRows.forEach((row, index) => {
    const isTotal = row.__totals;
    const cells = isTotal
      ? columns.map((col, i) => ({ text: totals[i] === undefined ? '' : String(totals[i]), bold: true }))
      : columns.map((col) => cellText(col, row));
    const h = rowHeight(cells);
    if (ctx.y + h > BOTTOM_LIMIT) {
      ctx.newPage();
      drawHeaderRow();
    }
    if (isTotal) {
      doc.rect(PAGE.m, ctx.y, CONTENT_W, h).fill(C.soft);
    } else if (index % 2 === 1) {
      doc.rect(PAGE.m, ctx.y, CONTENT_W, h).fill(C.zebra);
    }
    let x = PAGE.m;
    cells.forEach((cell, i) => {
      const col = columns[i];
      if (cell.pill) {
        pill(doc, x + padX, ctx.y + (h - 14) / 2, cell.pill, TONES[cell.tone] || TONES.gray);
      } else {
        doc.font(col.bold || cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize)
          .fillColor(cell.color || (col.muted ? C.muted : C.ink))
          .text(cell.text, x + padX, ctx.y + 6, { width: col.w - padX * 2, align: col.align || 'left', lineGap: 1 });
      }
      x += col.w;
    });
    ctx.y += h;
  });
  doc.moveTo(PAGE.m, ctx.y).lineTo(PAGE.m + CONTENT_W, ctx.y).lineWidth(0.7).strokeColor(C.line).stroke();
  ctx.y += 18;
}

function toPdf(statement) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
      info: {
        Title: `${BRAND.name} statement — ${statement.customer.name || statement.customer.phone} — ${periodLabel(statement)}`,
        Author: BRAND.name,
        Subject: 'Customer account statement',
      },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const s = statement.summary;
      const ctx = {
        doc,
        y: drawHeader(doc, statement),
        newPage() {
          doc.addPage({ size: 'A4', margin: 0 });
          this.y = drawContinuation(doc, statement);
        },
        ensureSpace(needed) {
          if (this.y + needed > BOTTOM_LIMIT) this.newPage();
        },
      };

      ctx.y = drawCustomer(doc, ctx.y, statement);
      ctx.y = drawSummary(doc, ctx.y, statement);

      // Ledger
      ctx.ensureSpace(70);
      ctx.y = sectionTitle(doc, ctx.y, 'ACCOUNT LEDGER', C.navy, 'Deliveries and added dues are charged; payments and reductions are credited');
      drawTable(ctx, [
        { title: 'DATE', w: 62, render: (e) => shortDate(e.date), muted: true },
        { title: 'PARTICULARS', w: 205, render: (e) => ({ text: e.description, bold: e.kind === 'opening', color: e.kind === 'reversal' ? C.muted : undefined }) },
        { title: 'CHARGES', w: 70, align: 'right', render: (e) => (e.debit ? rs(e.debit) : '') },
        { title: 'PAID / CREDIT', w: 70, align: 'right', render: (e) => (e.credit ? { text: rs(e.credit), color: C.green } : '') },
        { title: 'BALANCE', w: CONTENT_W - 407, align: 'right', bold: true, render: (e) => balanceLabel(e.balance) },
      ], statement.ledger, {
        totals: ['', 'Closing balance', rs(s.total_charges), rs(s.total_credits), balanceLabel(s.closing_balance)],
      });

      // Deliveries
      ctx.ensureSpace(70);
      ctx.y = sectionTitle(doc, ctx.y, 'DELIVERY DETAILS', C.green,
        `${s.orders_total} scheduled order${s.orders_total === 1 ? '' : 's'} in this period`);
      drawTable(ctx, [
        { title: 'DATE', w: 68, render: (o) => shortDate(o.date), muted: true },
        { title: 'SLOT', w: 58, render: (o) => o.slot_label, muted: true },
        { title: 'ITEMS', w: 213, render: (o) => (o.reason_label && o.status !== 'delivered' ? `${o.description}\n${o.reason_label}` : o.description) },
        { title: 'STATUS', w: 98, render: (o) => ({ pill: o.status_label, tone: ORDER_TONE[o.status] || 'gray' }) },
        { title: 'AMOUNT', w: CONTENT_W - 437, align: 'right', render: (o) => (o.status === 'delivered' ? { text: rs(o.total_amount), bold: true } : { text: o.total_amount ? `${rs(o.total_amount)}\nnot billed` : '—', color: C.faint }) },
      ], statement.orders, {
        emptyText: 'No scheduled orders in this period.',
        totals: ['', '', `Delivered: ${s.orders_delivered} order${s.orders_delivered === 1 ? '' : 's'}, ${s.milk_litres_delivered} L milk`, '', rs(s.billed)],
      });

      // Payments
      ctx.ensureSpace(70);
      ctx.y = sectionTitle(doc, ctx.y, 'PAYMENTS RECEIVED', C.teal,
        s.payments_count ? methodBreakdown(s.payments_by_method) : null);
      drawTable(ctx, [
        { title: 'DATE', w: 80, render: (p) => shortDate(p.date), muted: true },
        { title: 'METHOD', w: 80, render: (p) => ({ pill: p.method_label, tone: p.method === 'cash' ? 'green' : p.method === 'upi' ? 'blue' : 'gray' }) },
        { title: 'NOTES', w: 260, render: (p) => p.notes || '—', muted: true },
        { title: 'AMOUNT', w: CONTENT_W - 420, align: 'right', bold: true, render: (p) => rs(p.amount) },
      ], statement.payments, {
        emptyText: 'No payments recorded in this period.',
        totals: ['', '', 'Total received', rs(s.paid)],
      });

      // Manual adjustments
      if (statement.adjustments.length) {
        ctx.ensureSpace(70);
        ctx.y = sectionTitle(doc, ctx.y, 'MANUAL ADJUSTMENTS', '#B45309', 'Dues added or reduced by an admin');
        drawTable(ctx, [
          { title: 'DATE', w: 62, render: (a) => shortDate(a.date), muted: true },
          { title: 'TYPE', w: 78, render: (a) => ({ pill: a.type_label, tone: a.type === 'charge' ? 'amber' : 'green' }) },
          {
            title: 'REASON',
            w: 228,
            render: (a) => [
              `${a.category_label}${a.note ? `: ${a.note}` : ''}`,
              a.voided ? `Reversed on ${shortDate(a.voided_on)}${a.void_reason ? ` — ${a.void_reason}` : ''}` : null,
            ].filter(Boolean).join('\n'),
          },
          { title: 'BY', w: 70, render: (a) => a.created_by || '—', muted: true },
          {
            title: 'AMOUNT',
            w: CONTENT_W - 438,
            align: 'right',
            bold: true,
            render: (a) => ({ text: `${a.type === 'credit' ? '-' : '+'}${rs(a.amount)}`, color: a.voided ? C.faint : undefined }),
          },
        ], statement.adjustments);
      }

      // Instant orders (COD)
      if (statement.instant_orders.length) {
        ctx.ensureSpace(70);
        ctx.y = sectionTitle(doc, ctx.y, 'INSTANT ORDERS  ·  CASH ON DELIVERY', C.navy,
          s.instant_added_to_due_count ? 'Paid at the door unless marked "added to due"' : 'Paid at the door — not part of the balance');
        drawTable(ctx, [
          { title: 'DATE', w: 62, render: (o) => shortDate(o.date), muted: true },
          { title: 'ITEMS', w: 180, render: (o) => (o.added_to_due ? `${o.description}\nAdded to due` : o.description) },
          { title: 'DELIVERY', w: 60, align: 'right', render: (o) => rs(o.delivery_charge), muted: true },
          { title: 'OTHER', w: 56, align: 'right', render: (o) => rs(o.extra_charges_total), muted: true },
          { title: 'STATUS', w: 90, render: (o) => ({ pill: o.status_label, tone: INSTANT_TONE[o.status] || 'gray' }) },
          { title: 'TOTAL', w: CONTENT_W - 448, align: 'right', bold: true, render: (o) => rs(o.total_amount) },
        ], statement.instant_orders, {
          totals: ['', 'Delivered, paid in cash', rs(s.instant_delivery_charges), rs(s.instant_extra_charges), '', rs(s.instant_cod_amount)],
        });
      }

      // Closing note
      const note = adjustmentNote(statement);
      const lines = [
        `Balance on account today: ${balanceLabel(s.account_balance_today)}.`,
        'Charges are added when an order is marked delivered, or when an admin adds a due by hand. '
          + 'A positive balance is the amount payable; an advance is credit carried forward.',
      ];
      if (note) lines.push(note);
      doc.font('Helvetica').fontSize(8);
      const text = lines.join('\n');
      const textH = doc.heightOfString(text, { width: CONTENT_W - 28, lineGap: 2 });
      ctx.ensureSpace(textH + 26);
      doc.roundedRect(PAGE.m, ctx.y, CONTENT_W, textH + 20, 10).fill(note ? TONES.amber.bg : C.soft);
      doc.font('Helvetica').fontSize(8).fillColor(note ? TONES.amber.fg : C.muted)
        .text(text, PAGE.m + 14, ctx.y + 10, { width: CONTENT_W - 28, lineGap: 2 });

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i += 1) {
        doc.switchToPage(i);
        drawFooter(doc, statement, i - range.start + 1, range.count);
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

const FORMATS = {
  csv: { mime: 'text/csv; charset=utf-8', ext: 'csv', render: async (s) => toCsv(s) },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', render: toXlsx },
  pdf: { mime: 'application/pdf', ext: 'pdf', render: toPdf },
};

module.exports = {
  FORMATS,
  toCsv,
  toXlsx,
  toPdf,
  reportFilename,
};
