const { db, admin } = require('../../config/firebase');

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
 * Called from order.service after status update.
 */
async function incrementDue(userId, areaId, amount) {
  const ref = db.collection('due_amounts').doc(userId);
  await db.runTransaction(async (tx) => {
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
  });
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
    const newDue = Math.max(0, (current.due_amount || 0) - amount); // never go below 0

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
  const snap = await db.collection('due_amounts').where('area_id', '==', areaId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  incrementDue,
  recordPayment,
  listAreaDues,
  getUserPayments,
  getUserDue,
  raiseTicket,
  getUserTickets,
  getAreaTickets,
  resolveTicket,
};
