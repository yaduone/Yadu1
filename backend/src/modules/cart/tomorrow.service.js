const { db, admin } = require('../../config/firebase');
const dateUtil = require('../../utils/date');
const { isValidQuantity } = require('../../utils/validators');

/**
 * Get the complete cart status for a user for the given target date.
 * This is the CORE computed view: subscription + overrides + extra items.
 */
async function getTomorrowStatus(userId, targetDate) {
  const date = targetDate || dateUtil.cartTargetDate();
  const isLocked = dateUtil.isPastCutoff() && date === dateUtil.tomorrow();

  // 1. Get active subscription
  const subSnap = await db
    .collection('subscriptions')
    .where('user_id', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  let subscription = null;
  let baseMilk = null;

  if (!subSnap.empty) {
    const subDoc = subSnap.docs[0];
    const subData = subDoc.data();

    // Only include milk if subscription has started
    if (subData.start_date <= date) {
      subscription = { id: subDoc.id, ...subData };
      baseMilk = {
        milk_type: subData.milk_type,
        quantity_litres: subData.quantity_litres,
        price_per_litre: subData.price_per_litre,
        total: subData.quantity_litres * subData.price_per_litre,
      };
    }
  }

  // 2. Check for override
  let override = null;
  let effectiveMilk = baseMilk;
  let isSkipped = false;

  if (subscription) {
    const overrideSnap = await db
      .collection('next_day_overrides')
      .where('user_id', '==', userId)
      .where('date', '==', date)
      .limit(1)
      .get();

    if (!overrideSnap.empty) {
      const overrideDoc = overrideSnap.docs[0];
      const overrideData = overrideDoc.data();
      override = { id: overrideDoc.id, ...overrideData };

      if (overrideData.override_type === 'skip') {
        effectiveMilk = null;
        isSkipped = true;
      } else if (overrideData.override_type === 'modify') {
        effectiveMilk = {
          ...baseMilk,
          quantity_litres: overrideData.modified_quantity,
          total: overrideData.modified_quantity * baseMilk.price_per_litre,
        };
      }
    }
  }

  // 3. Get extra products cart
  const cartSnap = await db
    .collection('carts')
    .where('user_id', '==', userId)
    .where('date', '==', date)
    .limit(1)
    .get();

  let extraItems = [];
  let cartId = null;
  if (!cartSnap.empty) {
    const cartDoc = cartSnap.docs[0];
    cartId = cartDoc.id;
    extraItems = cartDoc.data().items || [];
  }

  // 4. Calculate total
  const milkTotal = effectiveMilk ? effectiveMilk.total : 0;
  const extrasTotal = extraItems.reduce((sum, item) => sum + item.total, 0);

  return {
    date,
    is_locked: isLocked,
    subscription: subscription
      ? { id: subscription.id, milk_type: subscription.milk_type, base_quantity: subscription.quantity_litres }
      : null,
    override,
    effective_milk: effectiveMilk,
    is_skipped: isSkipped,
    extra_items: extraItems,
    cart_id: cartId,
    total_amount: milkTotal + extrasTotal,
  };
}

/**
 * Modify a delivery's milk quantity (targets cartTargetDate — day-after-tomorrow if past cutoff).
 */
async function modifyTomorrow(userId, subscriptionId, areaId, modifiedQuantity) {
  if (!isValidQuantity(modifiedQuantity)) {
    throw Object.assign(new Error('Quantity must be 0.5-10 litres in 0.5L increments'), { statusCode: 400 });
  }

  const targetDate = dateUtil.cartTargetDate();

  // Upsert override
  const existingSnap = await db
    .collection('next_day_overrides')
    .where('user_id', '==', userId)
    .where('date', '==', targetDate)
    .limit(1)
    .get();

  if (existingSnap.empty) {
    await db.collection('next_day_overrides').add({
      user_id: userId,
      subscription_id: subscriptionId,
      area_id: areaId,
      date: targetDate,
      override_type: 'modify',
      modified_quantity: modifiedQuantity,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await existingSnap.docs[0].ref.update({
      override_type: 'modify',
      modified_quantity: modifiedQuantity,
    });
  }

  return getTomorrowStatus(userId, targetDate);
}

/**
 * Skip a delivery (targets cartTargetDate — day-after-tomorrow if past cutoff).
 */
async function skipTomorrow(userId, subscriptionId, areaId) {
  const targetDate = dateUtil.cartTargetDate();

  const existingSnap = await db
    .collection('next_day_overrides')
    .where('user_id', '==', userId)
    .where('date', '==', targetDate)
    .limit(1)
    .get();

  if (existingSnap.empty) {
    await db.collection('next_day_overrides').add({
      user_id: userId,
      subscription_id: subscriptionId,
      area_id: areaId,
      date: targetDate,
      override_type: 'skip',
      modified_quantity: null,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await existingSnap.docs[0].ref.update({
      override_type: 'skip',
      modified_quantity: null,
    });
  }

  return getTomorrowStatus(userId, targetDate);
}

/**
 * Revert an override back to default subscription (targets cartTargetDate).
 */
async function revertOverride(userId) {
  const targetDate = dateUtil.cartTargetDate();

  const overrideSnap = await db
    .collection('next_day_overrides')
    .where('user_id', '==', userId)
    .where('date', '==', targetDate)
    .limit(1)
    .get();

  if (!overrideSnap.empty) {
    await overrideSnap.docs[0].ref.delete();
  }

  return getTomorrowStatus(userId, targetDate);
}

module.exports = { getTomorrowStatus, modifyTomorrow, skipTomorrow, revertOverride };
