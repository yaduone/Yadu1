const express = require('express');
const router = express.Router();
const cartService = require('./cart.service');
const tomorrowService = require('./tomorrow.service');
const { authenticateUser, requireCompleteProfile, authenticateAdmin } = require('../../middleware/auth');
const { success, badRequest, notFound } = require('../../utils/response');
const { db } = require('../../config/firebase');
const manifestSettings = require('../settings/manifestSettings.service');

const { cache, invalidateOn } = require('../../middleware/cache');

// GET /api/cart/tomorrow — Get complete cart for the active target date — cached 30s
router.get('/tomorrow', authenticateUser, requireCompleteProfile, cache.userPrivate, async (req, res, next) => {
  try {
    const status = await tomorrowService.getTomorrowStatus(req.user.userId, null, req.user.areaId);
    return success(res, status);
  } catch (err) {
    next(err);
  }
});

// POST /api/cart/tomorrow/add-item — Add extra product
router.post('/tomorrow/add-item', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || !quantity) {
      return badRequest(res, 'product_id and quantity are required');
    }
    await cartService.addItem(req.user.userId, req.user.areaId, { product_id, quantity });
    const status = await tomorrowService.getTomorrowStatus(req.user.userId, null, req.user.areaId);
    return success(res, status, 'Item added to cart');
  } catch (err) {
    next(err);
  }
});

// PUT /api/cart/tomorrow/update-item — Update extra product quantity
router.put('/tomorrow/update-item', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    const { product_id, quantity } = req.body;
    if (!product_id || quantity === undefined) {
      return badRequest(res, 'product_id and quantity are required');
    }
    await cartService.updateItem(req.user.userId, req.user.areaId, { product_id, quantity });
    const status = await tomorrowService.getTomorrowStatus(req.user.userId, null, req.user.areaId);
    return success(res, status, 'Cart updated');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart/tomorrow/remove-item/:productId — Remove extra product
router.delete('/tomorrow/remove-item/:productId', authenticateUser, requireCompleteProfile, async (req, res, next) => {
  try {
    await cartService.removeItem(req.user.userId, req.user.areaId, req.params.productId);
    const status = await tomorrowService.getTomorrowStatus(req.user.userId, null, req.user.areaId);
    return success(res, status, 'Item removed from cart');
  } catch (err) {
    next(err);
  }
});

// GET /api/cart/admin/summary — Admin: aggregate delivery snapshot for the cart target date
router.get('/admin/summary', authenticateAdmin, async (req, res, next) => {
  try {
    const areaId = req.admin.areaId;
    const settings = await manifestSettings.getAreaManifestSettings(areaId);
    const targetDate = manifestSettings.cartTargetDateFromSettings(settings);
    const isPastCutoff = manifestSettings.isAtOrPast(settings.cutoff_time);

    // Active subscriptions in area
    const activeSnap = await db
      .collection('subscriptions')
      .where('area_id', '==', areaId)
      .where('status', '==', 'active')
      .get();

    let totalMilkLitres = 0;
    let totalDeliveries = 0;
    const milkTypeBreakdown = { cow: 0, buffalo: 0, toned: 0 };

    for (const subDoc of activeSnap.docs) {
      const sub = subDoc.data();
      if (sub.start_date > targetDate) continue;

      const overrideSnap = await db
        .collection('next_day_overrides')
        .where('user_id', '==', sub.user_id)
        .where('date', '==', targetDate)
        .limit(1)
        .get();

      let qty = sub.quantity_litres;
      let skipped = false;

      if (!overrideSnap.empty) {
        const override = overrideSnap.docs[0].data();
        if (override.override_type === 'skip') {
          skipped = true;
        } else if (override.override_type === 'modify') {
          qty = override.modified_quantity;
        }
      }

      if (!skipped) {
        totalMilkLitres += qty;
        totalDeliveries++;
        milkTypeBreakdown[sub.milk_type] = (milkTypeBreakdown[sub.milk_type] || 0) + qty;
      }
    }

    // Extra items from carts for target date
    const cartsSnap = await db
      .collection('carts')
      .where('area_id', '==', areaId)
      .where('date', '==', targetDate)
      .get();

    const extraItems = {};
    let totalExtraQuantity = 0;
    cartsSnap.docs.forEach((doc) => {
      (doc.data().items || []).forEach((item) => {
        if (!extraItems[item.product_name]) {
          extraItems[item.product_name] = { product_name: item.product_name, quantity: 0, unit: item.unit };
        }
        extraItems[item.product_name].quantity += item.quantity;
        totalExtraQuantity += item.quantity;
      });
    });

    return success(res, {
      target_date: targetDate,
      is_past_cutoff: isPastCutoff,
      cutoff_time: settings.cutoff_time,
      generation_time: settings.generation_time,
      total_milk_litres: Math.round(totalMilkLitres * 100) / 100,
      total_deliveries: totalDeliveries,
      milk_type_breakdown: milkTypeBreakdown,
      extra_items: Object.values(extraItems).sort((a, b) => b.quantity - a.quantity),
      total_extra_quantity: totalExtraQuantity,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/cart/admin/user/:userId — Admin: get cart status for a specific user
router.get('/admin/user/:userId', authenticateAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verify user belongs to admin's area
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return notFound(res, 'User not found');
    if (userDoc.data().area_id !== req.admin.areaId) {
      return notFound(res, 'User not found');
    }

    const status = await tomorrowService.getTomorrowStatus(userId, null, req.admin.areaId);
    return success(res, { user_id: userId, ...status });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
