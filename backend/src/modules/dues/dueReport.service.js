/**
 * dueReport.service.js — per-customer account statement for a date range.
 *
 * A statement is rebuilt from the source records rather than read from
 * `due_amounts`, so it can show the balance on any day:
 *
 *   balance moves  = delivered scheduled orders (+)
 *                  + manual adjustments: charges (+) / credits (−), and their reversals
 *                  − payments
 *   opening        = sum of every move dated before `from`
 *   closing        = opening + moves dated `from`..`to`
 *
 * Delivered scheduled (subscription/cart) orders are the only automatic
 * charge — that is the one place `incrementDueInTransaction` is called.
 * Instant orders are cash-on-delivery: they are listed for reference and only
 * reach the balance when an admin adds one to the due as an adjustment.
 *
 * The builder is read-only: a past `pending` order is *shown* as not delivered
 * (what the nightly reconciliation would record) without writing to it.
 */

const moment = require('moment-timezone');
const { db } = require('../../config/firebase');
const config = require('../../config');
const dateUtil = require('../../utils/date');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 3 * 366;

const MILK_LABELS = { cow: 'Cow milk', buffalo: 'Buffalo milk', toned: 'Child pack' };
const SLOT_LABELS = { morning: 'Morning', evening: 'Evening', both: 'Morning + Evening' };
const METHOD_LABELS = { cash: 'Cash', upi: 'UPI', other: 'Other' };

const ORDER_STATUS_LABELS = {
  delivered: 'Delivered',
  pending: 'Pending',
  not_delivered: 'Not delivered',
  cancelled: 'Cancelled',
  skipped: 'Skipped',
};

const REASON_LABELS = {
  not_marked_delivered: 'Not marked delivered',
  skipped: 'Skipped by customer',
  subscription_paused: 'Subscription paused',
  subscription_cancelled: 'Subscription cancelled',
};

const ADJUSTMENT_CATEGORY_LABELS = {
  subscription: 'Milk subscription',
  instant_order: 'Instant order',
  products: 'Products',
  delivery_charge: 'Delivery charges',
  previous_balance: 'Previous balance',
  late_fee: 'Late fee',
  discount: 'Discount',
  correction: 'Balance correction',
  other: 'Other',
};

// Same-day ledger order: deliveries, then manual charges, payments, manual
// credits, and reversals last.
const ENTRY_RANK = { charge: 0, adjustment_charge: 1, payment: 2, adjustment_credit: 3, reversal: 4 };

const INSTANT_STATUS_LABELS = {
  pending: 'Awaiting acceptance',
  acknowledged: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
}

/** Validate a `from`/`to` pair; throws a 400 with a readable message. */
function validateRange(from, to) {
  if (!isValidDate(from)) throw httpError('from must be a date in YYYY-MM-DD format', 400);
  if (!isValidDate(to)) throw httpError('to must be a date in YYYY-MM-DD format', 400);
  if (from > to) throw httpError('from must be on or before to', 400);
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    throw httpError('Statement period cannot be longer than 3 years', 400);
  }
}

function formatAddress(address) {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [address.line1, address.line2, address.landmark, address.city, address.pincode]
    .filter(Boolean)
    .join(', ');
}

function timestampToDate(value) {
  const iso = timestampToIso(value);
  return iso ? moment(iso).tz(config.timezone).format('YYYY-MM-DD') : null;
}

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

/** Status as the customer would see it today, without writing anything. */
function effectiveOrderStatus(order, today) {
  if (order.status === 'pending' && order.date && order.date < today) {
    return { status: 'not_delivered', reason: 'not_marked_delivered' };
  }
  return { status: order.status || 'pending', reason: order.non_delivery_reason || null };
}

function describeMilk(milk) {
  if (!milk) return null;
  const label = MILK_LABELS[milk.milk_type] || milk.milk_type || 'Milk';
  return `${label} ${Number(milk.quantity_litres) || 0}L @ ${money(milk.price_per_litre)}/L`;
}

function describeExtra(item) {
  const unit = item.unit ? ` ${item.unit}` : '';
  return `${item.product_name || item.name || 'Item'} x${Number(item.quantity) || 0}${unit}`;
}

function normalizeOrder(id, order, today) {
  const { status, reason } = effectiveOrderStatus(order, today);
  const milk = order.milk || null;
  const extras = Array.isArray(order.extra_items) ? order.extra_items : [];
  const milkAmount = money(milk?.total);
  const extrasAmount = money(extras.reduce((sum, item) => sum + (Number(item.total) || 0), 0));
  const total = money(order.total_amount);
  const billed = status === 'delivered';

  const parts = [];
  if (milk) parts.push(describeMilk(milk));
  extras.forEach((item) => parts.push(describeExtra(item)));

  return {
    id,
    date: order.date,
    slot: order.delivery_slot || 'morning',
    slot_label: SLOT_LABELS[order.delivery_slot] || SLOT_LABELS.morning,
    status,
    status_label: ORDER_STATUS_LABELS[status] || status,
    reason,
    reason_label: reason ? (REASON_LABELS[reason] || reason.replace(/_/g, ' ')) : null,
    milk: milk ? {
      milk_type: milk.milk_type || null,
      label: MILK_LABELS[milk.milk_type] || milk.milk_type || 'Milk',
      quantity_litres: Number(milk.quantity_litres) || 0,
      price_per_litre: money(milk.price_per_litre),
      total: milkAmount,
    } : null,
    extra_items: extras.map((item) => ({
      product_name: item.product_name || item.name || 'Item',
      quantity: Number(item.quantity) || 0,
      unit: item.unit || '',
      price: money(item.price),
      total: money(item.total),
    })),
    description: parts.join(' + ') || 'No items',
    milk_amount: milkAmount,
    extras_amount: extrasAmount,
    total_amount: total,
    billed_amount: billed ? total : 0,
  };
}

function normalizeInstantOrder(id, order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const extraCharges = Array.isArray(order.extra_charges) ? order.extra_charges : [];
  const addedToDue = !!order.due_adjustment_id;
  return {
    id,
    date: order.date,
    placed_at: timestampToIso(order.placed_at || order.created_at),
    status: order.status || 'pending',
    status_label: INSTANT_STATUS_LABELS[order.status] || order.status || 'Pending',
    payment_mode: order.payment_mode || 'cod',
    added_to_due: addedToDue,
    due_adjustment_id: order.due_adjustment_id || null,
    items: items.map((item) => ({
      product_name: item.product_name || item.name || 'Item',
      quantity: Number(item.quantity) || 0,
      unit: item.unit || '',
      price: money(item.price),
      total: money(item.total),
    })),
    description: items.map(describeExtra).join(', ') || 'No items',
    items_total: money(order.items_total ?? items.reduce((s, i) => s + (Number(i.total) || 0), 0)),
    delivery_charge: money(order.delivery_charge),
    extra_charges: extraCharges.map((c) => ({ name: c.name || 'Charge', amount: money(c.amount) })),
    extra_charges_total: money(order.extra_charges_total ?? extraCharges.reduce((s, c) => s + (Number(c.amount) || 0), 0)),
    total_amount: money(order.total_amount),
    rejection_reason: order.rejection_reason || null,
  };
}

function normalizeAdjustment(id, adj) {
  const category = adj.category || 'other';
  const voidedOn = adj.voided ? (timestampToDate(adj.voided_at) || adj.date) : null;
  return {
    id,
    date: adj.date || timestampToDate(adj.created_at),
    type: adj.type === 'credit' ? 'credit' : 'charge',
    type_label: adj.type === 'credit' ? 'Due reduced' : 'Due added',
    amount: money(adj.amount),
    category,
    category_label: ADJUSTMENT_CATEGORY_LABELS[category] || category.replace(/_/g, ' '),
    note: adj.note || null,
    reference_type: adj.reference_type || null,
    reference_id: adj.reference_id || null,
    created_by: adj.created_by?.username || null,
    created_at: timestampToIso(adj.created_at),
    voided: !!adj.voided,
    // A reversal can't land before the entry it reverses.
    voided_on: voidedOn && adj.date && voidedOn < adj.date ? adj.date : voidedOn,
    void_reason: adj.void_reason || null,
  };
}

function adjustmentDescription(a) {
  return `${a.type_label} — ${a.category_label}${a.note ? `: ${a.note}` : ''}`;
}

/** Ledger moves for one adjustment: the entry itself, plus its reversal if voided. */
function adjustmentEntries(a) {
  const debit = a.type === 'charge' ? a.amount : 0;
  const credit = a.type === 'credit' ? a.amount : 0;
  const entries = [{
    date: a.date,
    kind: a.type === 'charge' ? 'adjustment_charge' : 'adjustment_credit',
    ref: a.id,
    description: `${adjustmentDescription(a)}${a.voided ? ' (reversed)' : ''}`,
    debit,
    credit,
    sort: a.created_at || '',
  }];
  if (a.voided && a.voided_on) {
    entries.push({
      date: a.voided_on,
      kind: 'reversal',
      ref: a.id,
      description: `Reversed: ${adjustmentDescription(a)}${a.void_reason ? ` (${a.void_reason})` : ''}`,
      debit: credit,
      credit: debit,
      sort: a.created_at || '',
    });
  }
  return entries;
}

function normalizePayment(id, payment) {
  return {
    id,
    date: payment.payment_date || (timestampToIso(payment.created_at) || '').slice(0, 10) || null,
    amount: money(payment.amount),
    method: payment.method || 'other',
    method_label: METHOD_LABELS[payment.method] || payment.method || 'Other',
    notes: payment.notes || null,
    recorded_at: timestampToIso(payment.created_at),
  };
}

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/**
 * Pure statement builder — everything the PDF/CSV/Excel renderers need.
 * Inputs are raw Firestore-shaped records: [{ id, data }].
 */
function buildStatement({
  userId,
  user = {},
  areaName = '',
  orders = [],
  instantOrders = [],
  payments = [],
  adjustments = [],
  dueDoc = null,
  from,
  to,
  today = dateUtil.today(),
  generatedAt = new Date(),
}) {
  validateRange(from, to);

  const allOrders = orders
    .map(({ id, data }) => normalizeOrder(id, data, today))
    .filter((o) => o.date)
    .sort(byDate);
  const allPayments = payments
    .map(({ id, data }) => normalizePayment(id, data))
    .filter((p) => p.date)
    .sort(byDate);
  const allAdjustments = adjustments
    .map(({ id, data }) => normalizeAdjustment(id, data))
    .filter((a) => a.date && a.amount > 0)
    .sort((a, b) => byDate(a, b) || String(a.created_at).localeCompare(String(b.created_at)));

  // Every move of the balance, across all time. The opening balance is the
  // sum of the moves before `from`; the ledger lists the moves inside the range.
  const moves = [
    ...allOrders.filter((o) => o.billed_amount > 0).map((o) => ({
      date: o.date,
      kind: 'charge',
      ref: o.id,
      description: `Delivery (${o.slot_label}) — ${o.description}`,
      debit: o.billed_amount,
      credit: 0,
      sort: '',
    })),
    ...allPayments.map((p) => ({
      date: p.date,
      kind: 'payment',
      ref: p.id,
      description: `Payment received — ${p.method_label}${p.notes ? ` (${p.notes})` : ''}`,
      debit: 0,
      credit: p.amount,
      sort: p.recorded_at || '',
    })),
    ...allAdjustments.flatMap(adjustmentEntries),
  ].sort((a, b) => byDate(a, b)
    || (ENTRY_RANK[a.kind] - ENTRY_RANK[b.kind])
    || String(a.sort).localeCompare(String(b.sort)));

  const before = (r) => r.date < from;
  const within = (r) => r.date >= from && r.date <= to;
  const net = (list) => money(list.reduce((s, m) => s + m.debit - m.credit, 0));

  const openingBalance = net(moves.filter(before));
  const periodMoves = moves.filter(within);

  let running = openingBalance;
  const ledger = [
    { date: from, kind: 'opening', ref: null, description: 'Opening balance', debit: 0, credit: 0, balance: openingBalance },
    ...periodMoves.map(({ sort, ...e }) => {
      running = money(running + e.debit - e.credit);
      return { ...e, balance: running };
    }),
  ];

  const periodOrders = allOrders.filter(within);
  const periodPayments = allPayments.filter(within);
  // An adjustment belongs to the period if it, or its reversal, falls inside it.
  const periodAdjustments = allAdjustments.filter((a) => within(a) || (a.voided_on && within({ date: a.voided_on })));
  const periodInstant = instantOrders
    .map(({ id, data }) => normalizeInstantOrder(id, data))
    .filter((o) => o.date && o.date >= from && o.date <= to)
    .sort((a, b) => byDate(a, b) || String(a.placed_at).localeCompare(String(b.placed_at)));

  const sumBy = (kinds, field) => money(periodMoves
    .filter((m) => kinds.includes(m.kind))
    .reduce((s, m) => s + m[field], 0));

  const delivered = periodOrders.filter((o) => o.status === 'delivered');
  const billed = money(delivered.reduce((s, o) => s + o.billed_amount, 0));
  const paid = money(periodPayments.reduce((s, p) => s + p.amount, 0));
  const adjustmentCharges = sumBy(['adjustment_charge', 'reversal'], 'debit');
  const adjustmentCredits = sumBy(['adjustment_credit', 'reversal'], 'credit');
  const totalCharges = money(billed + adjustmentCharges);
  const totalCredits = money(paid + adjustmentCredits);
  const closingBalance = money(openingBalance + totalCharges - totalCredits);

  const paymentsByMethod = {};
  periodPayments.forEach((p) => {
    paymentsByMethod[p.method] = money((paymentsByMethod[p.method] || 0) + p.amount);
  });

  const instantDelivered = periodInstant.filter((o) => o.status === 'delivered');
  const instantCash = instantDelivered.filter((o) => !o.added_to_due);

  // `due_amounts` is the running balance the app shows. If it disagrees with
  // the balance rebuilt from the records, something changed it without leaving
  // a record (an old script, a manual database edit) — surface that.
  const ledgerBalanceNow = net(moves);
  const accountBalance = dueDoc ? money(dueDoc.due_amount) : ledgerBalanceNow;
  const unreconciled = money(accountBalance - ledgerBalanceNow);

  return {
    generated_at: generatedAt.toISOString(),
    period: { from, to, days: daysBetween(from, to) },
    customer: {
      id: userId,
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      address: formatAddress(user.address),
      area_id: user.area_id || null,
      area_name: areaName || '',
    },
    summary: {
      opening_balance: openingBalance,
      billed,
      adjustment_charges: adjustmentCharges,
      total_charges: totalCharges,
      paid,
      adjustment_credits: adjustmentCredits,
      total_credits: totalCredits,
      closing_balance: closingBalance,
      orders_total: periodOrders.length,
      orders_delivered: delivered.length,
      orders_not_delivered: periodOrders.filter((o) => ['not_delivered', 'cancelled', 'skipped'].includes(o.status)).length,
      orders_pending: periodOrders.filter((o) => o.status === 'pending').length,
      milk_litres_delivered: Math.round(delivered.reduce((s, o) => s + (o.milk?.quantity_litres || 0), 0) * 1000) / 1000,
      milk_amount: money(delivered.reduce((s, o) => s + o.milk_amount, 0)),
      extras_amount: money(delivered.reduce((s, o) => s + o.extras_amount, 0)),
      payments_count: periodPayments.length,
      payments_by_method: paymentsByMethod,
      adjustments_count: periodAdjustments.length,
      instant_orders_total: periodInstant.length,
      instant_orders_delivered: instantDelivered.length,
      instant_cod_amount: money(instantCash.reduce((s, o) => s + o.total_amount, 0)),
      instant_added_to_due_count: instantDelivered.length - instantCash.length,
      instant_added_to_due_amount: money(instantDelivered.filter((o) => o.added_to_due).reduce((s, o) => s + o.total_amount, 0)),
      instant_delivery_charges: money(instantDelivered.reduce((s, o) => s + o.delivery_charge, 0)),
      instant_extra_charges: money(instantDelivered.reduce((s, o) => s + o.extra_charges_total, 0)),
      account_balance_today: accountBalance,
      unreconciled_adjustment: Math.abs(unreconciled) >= 0.01 ? unreconciled : 0,
    },
    ledger,
    orders: periodOrders,
    payments: periodPayments,
    adjustments: periodAdjustments,
    instant_orders: periodInstant,
  };
}

async function getAreaName(areaId) {
  if (!areaId) return '';
  const doc = await db.collection('areas').doc(areaId).get();
  return doc.exists ? doc.data().name || '' : '';
}

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, data: d.data() }));

/**
 * Load everything for one customer and build their statement.
 * Area scoping mirrors the other admin dues routes: a customer outside the
 * admin's area is reported as not found.
 */
async function getUserStatement(userId, areaId, { from, to }) {
  validateRange(from, to);

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists || userDoc.data().area_id !== areaId) {
    throw httpError('User not found', 404);
  }
  const user = userDoc.data();

  // Fetch by user_id only and filter dates in memory: the opening balance
  // needs every earlier record anyway, and this avoids composite indexes.
  const [ordersSnap, instantSnap, paymentsSnap, adjustmentsSnap, dueSnap, areaName] = await Promise.all([
    db.collection('orders').where('user_id', '==', userId).get(),
    db.collection('instant_orders').where('user_id', '==', userId).get(),
    db.collection('payments').where('user_id', '==', userId).get(),
    db.collection('due_adjustments').where('user_id', '==', userId).get(),
    db.collection('due_amounts').doc(userId).get(),
    getAreaName(user.area_id),
  ]);

  return buildStatement({
    userId,
    user,
    areaName,
    orders: docs(ordersSnap),
    instantOrders: docs(instantSnap),
    payments: docs(paymentsSnap),
    adjustments: docs(adjustmentsSnap),
    dueDoc: dueSnap.exists ? dueSnap.data() : null,
    from,
    to,
  });
}

module.exports = {
  buildStatement,
  getUserStatement,
  validateRange,
  isValidDate,
  MAX_RANGE_DAYS,
};
