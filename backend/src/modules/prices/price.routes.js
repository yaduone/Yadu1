const express = require('express');
const router = express.Router();
const { db, admin } = require('../../config/firebase');
const { authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound } = require('../../utils/response');
const { isValidMilkType } = require('../../utils/validators');

// GET /api/prices — Public: get current milk prices
router.get('/', async (req, res, next) => {
  try {
    const snap = await db.collection('price_config').get();
    const prices = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return success(res, { prices });
  } catch (err) {
    next(err);
  }
});

// PUT /api/prices/:milk_type — Admin: update milk price
router.put('/:milk_type', authenticateAdmin, async (req, res, next) => {
  try {
    const { milk_type } = req.params;
    if (!isValidMilkType(milk_type)) return badRequest(res, 'Invalid milk type');

    const { price_per_litre } = req.body;
    if (!price_per_litre || typeof price_per_litre !== 'number' || price_per_litre <= 0) {
      return badRequest(res, 'price_per_litre must be a positive number');
    }

    const snap = await db.collection('price_config').where('milk_type', '==', milk_type).limit(1).get();
    if (snap.empty) return notFound(res, 'Price config not found for this milk type');

    await snap.docs[0].ref.update({
      price_per_litre,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return success(res, { milk_type, price_per_litre }, 'Price updated');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
