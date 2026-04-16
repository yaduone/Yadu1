const express = require('express');
const router = express.Router();
const { db } = require('../../config/firebase');
const { admin: firebaseAdmin } = require('../../config/firebase');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound } = require('../../utils/response');

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

module.exports = router;
