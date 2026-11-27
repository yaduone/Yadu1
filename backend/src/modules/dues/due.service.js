const { db, admin } = require('../../config/firebase');
const { logActivity } = require('../../utils/activityLog');
const dateUtil = require('../../utils/date');
const notificationService = require('../notifications/notification.service');

function httpError(message, statusCode, extra = {}) {
  return Object.assign(new Error(message), { statusCode, ...extra });
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function serializeTimestamp(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate().toISOString();
  return value;
}

// ─── Manual adjustments ──────────────────────────────────────────────────────
//
// An adjustment is an admin changing what a customer owes without a delivery
// or a payment behind it: an unpaid instant (cash) order, an old balance
// carried over from before the app, a late fee, a discount, a correction.
//
// A charge adds to total_billed and a credit subtracts from it, so the
// invariant the rest of the system (and fixDues.js) relies on still holds:
//   due_amount = total_billed - total_paid
// Adjustments are never deleted; a mistake is voided, which applies the exact
// inverse and keeps both entries in the ledger.

const ADJUSTMENT_TYPES = ['charge', 'credit'];

// Customer-facing wording for each category, used in the notification.
const ADJUSTMENT_CATEGORIES = {
  subscription: 'milk subscription',
  instant_order: 'an instant delivery order',
  products: 'products',
  delivery_charge: 'delivery charges',
  previous_balance: 'a previous balance',
  late_fee: 'a late fee',
  discount: 'a discount',
  correction: 'a balance correction',
  other: null,
};

const MAX_ADJUSTMENT_AMOUNT = 100000;
const MAX_ADJUSTMENT_NOTE = 200;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Get or initialise a user's due_amounts document.
 */
async function getDueDoc(userId) {
  const ref = db.collection('due_amounts').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return { ref, data: { user_id: userId, total_billed: 0, total_paid: 0, due_amount: 0 } };
  return { ref, data: snap.data() };
}

/**
 * Increment due when an order is marked delivered.
 * Transaction form is used with the order status update to prevent double billing.
 */
async function incrementDueInTransaction(tx, userId, areaId, amount) {
  const ref = db.collection('due_amounts').doc(userId);
  const snap = await tx.get(ref);
  if (!snap.exists) {
    tx.set(ref, {
      user_id: userId,
      area_id: areaId,
      total_billed: amount,
      total_paid: 0,
      due_amount: amount,
      last_updated: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    const d = snap.data();
    tx.update(ref, {
      total_billed: (d.total_billed || 0) + amount,
      due_amount: (d.due_amount || 0) + amount,
      last_updated: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

async function incrementDue(userId, areaId, amount) {
  await db.runTransaction((tx) => incrementDueInTransaction(tx, userId, areaId, amount));
}

/**
 * Admin records a payment — reduces due amount.
 */
async function recordPayment(adminId, userId, areaId, { amount, method, notes, payment_date }) {
  if (!amount || amount <= 0) throw Object.assign(new Error('Amount must be greater than 0'), { statusCode: 400 });

  const validMethods = ['cash', 'upi', 'other'];
  if (!validMethods.includes(method)) throw Object.assign(new Error('method must be cash, upi, or other'), { statusCode: 400 });

  // Write payment record + update due in a transaction
  const dueRef = db.collection('due_amounts').doc(userId);
  const paymentRef = db.collection('payments').doc();

  await db.runTransaction(async (tx) => {
    const dueSnap = await tx.get(dueRef);
    const current = dueSnap.exists ? dueSnap.data() : { total_billed: 0, total_paid: 0, due_amount: 0 };

    const newPaid = (current.total_paid || 0) + amount;
    const newDue = (current.due_amount || 0) - amount; // allow negative (prepaid balance)

    tx.set(paymentRef, {
      user_id: userId,
      area_id: areaId,
      amount,
      method,
      notes: notes || null,
      collected_by_admin_id: adminId,
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (!dueSnap.exists) {
      tx.set(dueRef, {
        user_id: userId,
        area_id: areaId,
        total_billed: 0,
        total_paid: newPaid,
        due_amount: newDue,
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      tx.update(dueRef, {
        total_paid: newPaid,
        due_amount: newDue,
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return { payment_id: paymentRef.id, amount, method };
}

/**
 * Admin: list all users' due amounts for their area.
 */
async function listAreaDues(areaId) {
  const [duesSnap, usersSnap] = await Promise.all([
    db.collection('due_amounts').where('area_id', '==', areaId).get(),
    db.collection('users').where('area_id', '==', areaId).get(),
  ]);

  const dues = duesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const usersWithDues = new Set(dues.map((due) => due.user_id || due.id));

  usersSnap.docs.forEach((userDoc) => {
    if (usersWithDues.has(userDoc.id)) return;

    dues.push({
      id: userDoc.id,
      user_id: userDoc.id,
      area_id: areaId,
      total_billed: 0,
      total_paid: 0,
      due_amount: 0,
    });
  });

  return dues;
}

/**
 * Admin: get payment history for a user.
 */
async function getUserPayments(userId) {
  const snap = await db.collection('payments').where('user_id', '==', userId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.payment_date > a.payment_date ? 1 : -1));
}

/**
 * User: get own due balance.
 */
async function getUserDue(userId) {
  const { data } = await getDueDoc(userId);
  return {
    total_billed: data.total_billed || 0,
    total_paid: data.total_paid || 0,
    due_amount: data.due_amount || 0,
  };
}

function adjustmentView(id, data) {
  return {
    id,
    user_id: data.user_id,
    type: data.type,
    amount: data.amount,
    category: data.category,
    note: data.note || null,
    date: data.date,
    reference_type: data.reference_type || null,
    reference_id: data.reference_id || null,
    created_by: data.created_by || null,
    created_at: serializeTimestamp(data.created_at),
    voided: !!data.voided,
    voided_at: serializeTimestamp(data.voided_at),
    voided_by: data.voided_by || null,
    void_reason: data.void_reason || null,
  };
}

function validateAdjustment({ type, amount, category, note, date, reference_type, reference_id }) {
  if (!ADJUSTMENT_TYPES.includes(type)) {
    throw httpError('type must be charge (add to due) or credit (reduce due)', 400);
  }

  const parsed = typeof amount === 'string' ? Number(amount) : amount;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed <= 0) {
    throw httpError('amount must be a number greater than 0', 400);
  }
  if (parsed > MAX_ADJUSTMENT_AMOUNT) {
    throw httpError(`amount cannot exceed Rs. ${MAX_ADJUSTMENT_AMOUNT}`, 400);
  }

  const cleanCategory = category || 'other';
  if (!Object.prototype.hasOwnProperty.call(ADJUSTMENT_CATEGORIES, cleanCategory)) {
    throw httpError(`category must be one of ${Object.keys(ADJUSTMENT_CATEGORIES).join(', ')}`, 400);
  }

  let cleanNote = null;
  if (note !== undefined && note !== null && note !== '') {
    if (typeof note !== 'string') throw httpError('note must be text', 400);
    cleanNote = note.trim();
    if (cleanNote.length > MAX_ADJUSTMENT_NOTE) {
      throw httpError(`note must be ${MAX_ADJUSTMENT_NOTE} characters or fewer`, 400);
    }
    cleanNote = cleanNote || null;
  }

  const cleanDate = date || dateUtil.today();
  if (typeof cleanDate !== 'string' || !ISO_DATE_RE.test(cleanDate)) {
    throw httpError('date must be in YYYY-MM-DD format', 400);
  }

  let reference = null;
  if (reference_type || reference_id) {
    if (reference_type !== 'instant_order' || typeof reference_id !== 'string' || !reference_id) {
      throw httpError('Only a delivered instant order can be linked to an adjustment (reference_type: instant_order)', 400);
    }
    if (type !== 'charge') {
      throw httpError('An instant order can only be added to the due as a charge', 400);
    }
    reference = { type: reference_type, id: reference_id };
  }

  return { type, amount: roundMoney(parsed), category: cleanCategory, note: cleanNote, date: cleanDate, reference };
}

/**
 * What the customer is told the adjustment was for: the admin's note when there
 * is one, otherwise the category's wording.
 */
function adjustmentReasonText(category, note) {
  return note || ADJUSTMENT_CATEGORIES[category] || null;
}

function dueSummary(data) {
  return {
    total_billed: roundMoney(data.total_billed || 0),
    total_paid: roundMoney(data.total_paid || 0),
    due_amount: roundMoney(data.due_amount || 0),
  };
}

/**
 * Admin adds to or reduces a customer's due by hand.
 *
 * `request_id` makes a retried submit (double click, flaky network) a no-op
 * instead of charging the customer twice. Linking a delivered instant order
 * moves that cash order onto the customer's account exactly once.
 */
async function recordAdjustment(adminCtx, user, body, { notify = true } = {}) {
  const input = validateAdjustment(body || {});
  const requestId = body?.request_id;
  if (requestId !== undefined && requestId !== null && (typeof requestId !== 'string' || !REQUEST_ID_RE.test(requestId))) {
    throw httpError('request_id must be 8-64 letters, digits, "-" or "_"', 400);
  }

  const adjustments = db.collection('due_adjustments');
  const adjRef = requestId
    ? adjustments.doc(`req_${encodeURIComponent(adminCtx.adminId)}_${requestId}`)
    : adjustments.doc();
  const dueRef = db.collection('due_amounts').doc(user.id);
  const orderRef = input.reference ? db.collection('instant_orders').doc(input.reference.id) : null;

  let duplicate = false;
  let newDue = null;
  let saved = null;

  await db.runTransaction(async (tx) => {
    duplicate = false;
    // Firestore transactions need every read before the first write.
    const [existingAdj, dueSnap, orderSnap] = await Promise.all([
      tx.get(adjRef),
      tx.get(dueRef),
      orderRef ? tx.get(orderRef) : Promise.resolve(null),
    ]);

    if (existingAdj.exists) {
      duplicate = true;
      saved = existingAdj.data();
      newDue = dueSnap.exists ? dueSummary(dueSnap.data()) : dueSummary({});
      return;
    }

    if (orderRef) {
      if (!orderSnap.exists || orderSnap.data().user_id !== user.id) {
        throw httpError('Instant order not found for this customer', 404);
      }
      const order = orderSnap.data();
      if (order.status !== 'delivered') {
        throw httpError('Only a delivered instant order can be added to the due', 400);
      }
      if (order.due_adjustment_id) {
        throw httpError('This instant order has already been added to the due', 409);
      }
    }

    const current = dueSnap.exists ? dueSnap.data() : { total_billed: 0, total_paid: 0, due_amount: 0 };
    const delta = input.type === 'charge' ? input.amount : -input.amount;
    const totals = {
      total_billed: roundMoney((current.total_billed || 0) + delta),
      total_paid: roundMoney(current.total_paid || 0),
      due_amount: roundMoney((current.due_amount || 0) + delta),
    };

    saved = {
      user_id: user.id,
      area_id: user.area_id,
      type: input.type,
      amount: input.amount,
      category: input.category,
      note: input.note,
      date: input.date,
      reference_type: input.reference?.type || null,
      reference_id: input.reference?.id || null,
      created_by: { admin_id: adminCtx.adminId, username: adminCtx.username || null },
      due_before: roundMoney(current.due_amount || 0),
      due_after: totals.due_amount,
      voided: false,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };
    tx.create(adjRef, saved);

    if (dueSnap.exists) {
      tx.update(dueRef, { ...totals, last_updated: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      tx.set(dueRef, {
        user_id: user.id,
        area_id: user.area_id,
        ...totals,
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    if (orderRef) {
      tx.update(orderRef, {
        due_adjustment_id: adjRef.id,
        added_to_due_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    newDue = totals;
  });

  if (!duplicate) {
    const reason = adjustmentReasonText(input.category, input.note);
    if (notify) {
      try {
        await notificationService.sendDueAdjustedNotification(user.id, user.area_id, {
          type: input.type,
          amount: input.amount,
          reason,
          newDue: newDue.due_amount,
        });
      } catch (err) {
        console.warn('[dues] adjustment notification failed:', err.message);
      }
    }

    await logActivity({
      type: 'due_adjusted',
      title: input.type === 'charge' ? 'Due Added Manually' : 'Due Reduced Manually',
      message: `${adminCtx.username || 'An admin'} ${input.type === 'charge' ? 'added' : 'reduced'} Rs. ${input.amount.toFixed(2)} ${input.type === 'charge' ? 'to' : 'from'} the due of ${user.name || user.phone || 'a customer'}${reason ? ` (${reason})` : ''}.`,
      areaId: user.area_id,
      meta: {
        user_id: user.id,
        adjustment_id: adjRef.id,
        type: input.type,
        amount: input.amount,
        category: input.category,
        admin_id: adminCtx.adminId,
        due_after: newDue.due_amount,
      },
    });
  }

  return {
    duplicate,
    adjustment: adjustmentView(adjRef.id, { ...saved, created_at: saved.created_at?.toDate ? saved.created_at : null }),
    due: newDue,
  };
}

/**
 * Reverse a manual adjustment. The entry stays in the ledger marked voided and
 * the exact inverse is applied to the balance.
 */
async function voidAdjustment(adminCtx, adjustmentId, { reason } = {}, { notify = true } = {}) {
  if (typeof adjustmentId !== 'string' || !adjustmentId) throw httpError('Adjustment not found', 404);
  let cleanReason = null;
  if (reason !== undefined && reason !== null && reason !== '') {
    if (typeof reason !== 'string') throw httpError('reason must be text', 400);
    cleanReason = reason.trim();
    if (cleanReason.length > MAX_ADJUSTMENT_NOTE) {
      throw httpError(`reason must be ${MAX_ADJUSTMENT_NOTE} characters or fewer`, 400);
    }
    cleanReason = cleanReason || null;
  }

  const adjRef = db.collection('due_adjustments').doc(adjustmentId);
  let adjustment = null;
  let user = null;
  let newDue = null;

  await db.runTransaction(async (tx) => {
    const adjSnap = await tx.get(adjRef);
    if (!adjSnap.exists) throw httpError('Adjustment not found', 404);
    adjustment = adjSnap.data();

    const userRef = db.collection('users').doc(adjustment.user_id);
    const dueRef = db.collection('due_amounts').doc(adjustment.user_id);
    const orderRef = adjustment.reference_type === 'instant_order' && adjustment.reference_id
      ? db.collection('instant_orders').doc(adjustment.reference_id)
      : null;

    const [userSnap, dueSnap, orderSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(dueRef),
      orderRef ? tx.get(orderRef) : Promise.resolve(null),
    ]);

    const userData = userSnap.exists ? userSnap.data() : null;
    const inScope = userData && (adminCtx.role === 'super_admin' || userData.area_id === adminCtx.areaId);
    if (!inScope) throw httpError('Adjustment not found', 404);
    user = { id: userSnap.id, ...userData };

    if (adjustment.voided) throw httpError('This adjustment has already been reversed', 400);

    const current = dueSnap.exists ? dueSnap.data() : { total_billed: 0, total_paid: 0, due_amount: 0 };
    const delta = adjustment.type === 'charge' ? -adjustment.amount : adjustment.amount;
    newDue = {
      total_billed: roundMoney((current.total_billed || 0) + delta),
      total_paid: roundMoney(current.total_paid || 0),
      due_amount: roundMoney((current.due_amount || 0) + delta),
    };

    if (dueSnap.exists) {
      tx.update(dueRef, { ...newDue, last_updated: admin.firestore.FieldValue.serverTimestamp() });
    } else {
      tx.set(dueRef, {
        user_id: user.id,
        area_id: user.area_id,
        ...newDue,
        last_updated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    tx.update(adjRef, {
      voided: true,
      voided_at: admin.firestore.FieldValue.serverTimestamp(),
      voided_by: { admin_id: adminCtx.adminId, username: adminCtx.username || null },
      void_reason: cleanReason,
    });

    // Free the instant order so it can be added again if this was a mistake
    // about the amount rather than the order.
    if (orderSnap?.exists && orderSnap.data().due_adjustment_id === adjustmentId) {
      tx.update(orderRef, {
        due_adjustment_id: null,
        added_to_due_at: null,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  const reasonText = adjustmentReasonText(adjustment.category, adjustment.note);
  if (notify) {
    try {
      await notificationService.sendDueAdjustedNotification(user.id, user.area_id, {
        type: adjustment.type,
        amount: adjustment.amount,
        reason: reasonText,
        newDue: newDue.due_amount,
        voided: true,
      });
    } catch (err) {
      console.warn('[dues] void notification failed:', err.message);
    }
  }

  await logActivity({
    type: 'due_adjustment_voided',
    title: 'Due Adjustment Reversed',
    message: `${adminCtx.username || 'An admin'} reversed a ${adjustment.type} of Rs. ${Number(adjustment.amount).toFixed(2)} for ${user.name || user.phone || 'a customer'}${cleanReason ? `: ${cleanReason}` : ''}.`,
    areaId: user.area_id,
    meta: {
      user_id: user.id,
      adjustment_id: adjustmentId,
      admin_id: adminCtx.adminId,
      due_after: newDue.due_amount,
    },
  });

  return { id: adjustmentId, voided: true, due: newDue };
}

/**
 * Admin: manual adjustment history for one customer, newest first.
 */
async function getUserAdjustments(userId) {
  const snap = await db.collection('due_adjustments').where('user_id', '==', userId).get();
  return snap.docs
    .map((doc) => ({ doc, millis: doc.data().created_at?.toMillis?.() ?? 0 }))
    .sort((a, b) => b.millis - a.millis)
    .map(({ doc }) => adjustmentView(doc.id, doc.data()));
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

/**
 * User raises a ticket about their due amount.
 */
async function raiseTicket(userId, areaId, { subject, description }) {
  if (!subject?.trim()) throw Object.assign(new Error('subject is required'), { statusCode: 400 });
  if (!description?.trim()) throw Object.assign(new Error('description is required'), { statusCode: 400 });

  const ref = await db.collection('due_tickets').add({
    user_id: userId,
    area_id: areaId,
    subject: subject.trim(),
    description: description.trim(),
    status: 'open',
    admin_notes: null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log ticket creation
  await logActivity({
    type: 'due_ticket_raised',
    title: 'Due Amount Ticket Raised',
    message: `A user raised a due amount ticket: "${subject.trim()}"`,
    areaId,
    meta: { ticket_id: ref.id, user_id: userId, subject: subject.trim() },
  });

  return { id: ref.id };
}

/**
 * User: get own tickets.
 */
async function getUserTickets(userId) {
  const snap = await db.collection('due_tickets').where('user_id', '==', userId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.created_at?.toDate?.() || 0;
      const tb = b.created_at?.toDate?.() || 0;
      return tb - ta;
    });
}

/**
 * Admin: get all tickets for their area.
 */
async function getAreaTickets(areaId, status) {
  let query = db.collection('due_tickets').where('area_id', '==', areaId);
  if (status) query = query.where('status', '==', status);
  const snap = await query.get();

  // Enrich with user name
  const tickets = await Promise.all(
    snap.docs.map(async (d) => {
      const ticket = { id: d.id, ...d.data() };
      const userDoc = await db.collection('users').doc(ticket.user_id).get();
      ticket.user_name = userDoc.exists ? userDoc.data().name : 'Unknown';
      ticket.user_phone = userDoc.exists ? userDoc.data().phone : null;
      return ticket;
    })
  );

  return tickets.sort((a, b) => {
    const ta = a.created_at?.toDate?.() || 0;
    const tb = b.created_at?.toDate?.() || 0;
    return tb - ta;
  });
}

/**
 * Admin: update ticket status and add notes.
 */
async function resolveTicket(ticketId, areaId, { status, admin_notes }) {
  const validStatuses = ['open', 'in_review', 'resolved'];
  if (!validStatuses.includes(status)) throw Object.assign(new Error('Invalid status'), { statusCode: 400 });

  const ref = db.collection('due_tickets').doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
  if (snap.data().area_id !== areaId) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });

  await ref.update({
    status,
    admin_notes: admin_notes || null,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { id: ticketId, status };
}

module.exports = {
  incrementDueInTransaction,
  incrementDue,
  recordPayment,
  listAreaDues,
  getUserPayments,
  getUserDue,
  recordAdjustment,
  voidAdjustment,
  getUserAdjustments,
  ADJUSTMENT_CATEGORIES,
  raiseTicket,
  getUserTickets,
  getAreaTickets,
  resolveTicket,
};
