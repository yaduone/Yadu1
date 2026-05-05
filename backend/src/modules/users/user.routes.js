const express = require('express');
const router = express.Router();
const { db } = require('../../config/firebase');
const { admin: firebaseAdmin } = require('../../config/firebase');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, forbidden, notFound } = require('../../utils/response');
const { logActivity } = require('../../utils/activityLog');

const MAX_BATCH_WRITES = 450;
const USER_OWNED_COLLECTIONS = [
  { collection: 'subscriptions', field: 'user_id' },
  { collection: 'carts', field: 'user_id' },
  { collection: 'next_day_overrides', field: 'user_id' },
  { collection: 'orders', field: 'user_id' },
  { collection: 'notifications', field: 'user_id' },
  { collection: 'payments', field: 'user_id' },
  { collection: 'due_tickets', field: 'user_id' },
  { collection: 'audit_logs', field: 'actor_id' },
  { collection: 'admin_logs', field: 'meta.user_id' },
];

async function deleteUserFirestoreData(userId, userRef) {
  const queuedPaths = new Set();
  const deletedByCollection = {};
  let batch = db.batch();
  let writes = 0;
  let totalDeleted = 0;

  async function commitBatch() {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  }

  async function queueDelete(ref, collection) {
    if (queuedPaths.has(ref.path)) return;

    queuedPaths.add(ref.path);
    batch.delete(ref);
    writes += 1;
    totalDeleted += 1;
    deletedByCollection[collection] = (deletedByCollection[collection] || 0) + 1;

    if (writes >= MAX_BATCH_WRITES) {
      await commitBatch();
    }
  }

  for (const { collection, field } of USER_OWNED_COLLECTIONS) {
    const snap = await db.collection(collection).where(field, '==', userId).get();
    for (const doc of snap.docs) {
      await queueDelete(doc.ref, collection);
    }
  }

  const dueRef = db.collection('due_amounts').doc(userId);
  const dueDoc = await dueRef.get();
  if (dueDoc.exists) {
    await queueDelete(dueRef, 'due_amounts');
  }

  await queueDelete(userRef, 'users');
  await commitBatch();

  return { total_deleted: totalDeleted, deleted_by_collection: deletedByCollection };
}

// GET /api/users/profile
router.get('/profile', authenticateUser, async (req, res, next) => {
  try {
    if (!req.user.userId) {
      return success(res, { user: null, is_profile_complete: false });
    }
    const userDoc = await db.collection('users').doc(req.user.userId).get();
    if (!userDoc.exists) return notFound(res, 'User not found');

    const userData = userDoc.data();
    // Fetch area name
    let areaName = null;
    if (userData.area_id) {
      const areaDoc = await db.collection('areas').doc(userData.area_id).get();
      if (areaDoc.exists) areaName = areaDoc.data().name;
    }

    return success(res, {
      user: {
        id: userDoc.id,
        ...userData,
        area_name: areaName,
        is_profile_complete: !!(userData.name && userData.area_id && userData.address),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/admin/list — Admin: list all users in the admin's area with subscription info
router.get('/admin/list', authenticateAdmin, async (req, res, next) => {
  try {
    // Fetch all users in this area
    const usersSnap = await db.collection('users')
      .where('area_id', '==', req.admin.areaId)
      .get();

    if (usersSnap.empty) {
      return success(res, { users: [] });
    }

    const userIds = usersSnap.docs.map((d) => d.id);

    // Fetch all subscriptions for these users in batches of 30 (Firestore 'in' limit)
    const subsMap = {};
    for (let i = 0; i < userIds.length; i += 30) {
      const batch = userIds.slice(i, i + 30);
      const subsSnap = await db.collection('subscriptions')
        .where('user_id', 'in', batch)
        .get();
      subsSnap.docs.forEach((d) => {
        const data = d.data();
        // Keep only the most relevant subscription per user (active > paused > latest cancelled)
        const existing = subsMap[data.user_id];
        const priority = { active: 3, paused: 2, cancelled: 1 };
        if (!existing || (priority[data.status] || 0) > (priority[existing.status] || 0)) {
          subsMap[data.user_id] = { id: d.id, ...data };
        }
      });
    }

    const users = usersSnap.docs.map((d) => {
      const u = d.data();
      const sub = subsMap[d.id] || null;
      return {
        id: d.id,
        name: u.name,
        phone: u.phone,
        address: u.address,
        area_id: u.area_id,
        is_profile_complete: !!(u.name && u.area_id && u.address),
        created_at: u.created_at,
        deletion_requested: u.deletion_requested || false,
        deletion_requested_at: u.deletion_requested_at || null,
        subscription: sub ? {
          id: sub.id,
          milk_type: sub.milk_type,
          quantity_litres: sub.quantity_litres,
          price_per_litre: sub.price_per_litre,
          daily_value: +(sub.quantity_litres * sub.price_per_litre).toFixed(2),
          status: sub.status,
          start_date: sub.start_date,
          paused_at: sub.paused_at,
          cancelled_at: sub.cancelled_at,
        } : null,
      };
    });

    // Sort: active first, then paused, then no-sub, then cancelled
    const order = { active: 0, paused: 1, null: 2, cancelled: 3 };
    users.sort((a, b) => {
      const sa = a.subscription?.status ?? 'null';
      const sb = b.subscription?.status ?? 'null';
      return (order[sa] ?? 2) - (order[sb] ?? 2);
    });

    return success(res, { users, total: users.length });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/admin/:userId — Admin: permanently delete a user and user-owned records
router.delete('/admin/:userId', authenticateAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return notFound(res, 'User not found');

    const userData = userDoc.data();
    const canDelete = req.admin.role === 'super_admin' || userData.area_id === req.admin.areaId;
    if (!canDelete) return forbidden(res, 'Cannot delete a user outside your area');

    const deletion = await deleteUserFirestoreData(userId, userRef);

    let firebaseAuthDeleted = false;
    if (userData.firebase_uid) {
      try {
        await firebaseAdmin.auth().deleteUser(userData.firebase_uid);
        firebaseAuthDeleted = true;
      } catch (authErr) {
        if (authErr.code !== 'auth/user-not-found') {
          console.error('[deleteUser] Firebase auth delete failed:', authErr.message);
        }
      }
    }

    await logActivity({
      type: 'user_deleted',
      title: 'User Deleted',
      message: `A user account was permanently deleted by ${req.admin.username}.`,
      areaId: userData.area_id || req.admin.areaId,
      meta: {
        deleted_by_admin_id: req.admin.adminId,
        firebase_auth_deleted: firebaseAuthDeleted,
        deleted_record_count: deletion.total_deleted,
        deleted_collections: deletion.deleted_by_collection,
      },
    });

    return success(res, {
      user_id: userId,
      firebase_auth_deleted: firebaseAuthDeleted,
      ...deletion,
    }, 'User deleted permanently');
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/profile
router.put('/profile', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { name, address } = req.body;
    const updateData = { updated_at: firebaseAdmin.firestore.FieldValue.serverTimestamp() };
    if (name) updateData.name = name;
    if (address) updateData.address = address;

    await db.collection('users').doc(req.user.userId).update(updateData);
    const updatedDoc = await db.collection('users').doc(req.user.userId).get();
    return success(res, { user: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/request-deletion — User: request own account deletion
router.post('/request-deletion', authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    if (!userId) return notFound(res, 'User not found');

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return notFound(res, 'User not found');

    const userData = userDoc.data();
    if (userData.deletion_requested) {
      return success(res, {}, 'Deletion request already submitted. We will process it within 30 days.');
    }

    await userRef.update({
      deletion_requested: true,
      deletion_requested_at: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    });

    await logActivity({
      type: 'deletion_requested',
      title: 'Account Deletion Requested',
      message: `User ${userData.name || userId} requested account deletion.`,
      areaId: userData.area_id || null,
      meta: { user_id: userId },
    });

    return success(res, {}, 'Deletion request received. Your account and personal data will be removed within 30 days.');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
