const cron = require('node-cron');
const { db, admin } = require('../config/firebase');
const config = require('../config');
const dateUtil = require('../utils/date');
const orderService = require('../modules/orders/order.service');
const manifestService = require('../modules/manifests/manifest.service');

/**
 * Nightly job: process all areas, create orders, generate manifests.
 * Runs at configured hour (default 11 PM IST).
 */
async function runNightlyJob() {
  const deliveryDate = dateUtil.tomorrow();
  console.log(`[CRON] Starting nightly manifest job for delivery date: ${deliveryDate}`);

  try {
    // Get all active areas
    const areasSnap = await db.collection('areas').where('is_active', '==', true).get();

    for (const areaDoc of areasSnap.docs) {
      const areaId = areaDoc.id;
      const areaName = areaDoc.data().name;
      console.log(`[CRON] Processing area: ${areaName} (${areaId})`);

      try {
        await processArea(areaId, deliveryDate);
        console.log(`[CRON] Completed area: ${areaName}`);
      } catch (err) {
        console.error(`[CRON] Error processing area ${areaName}:`, err.message);
      }
    }

    console.log(`[CRON] Nightly job completed for ${deliveryDate}`);
  } catch (err) {
    console.error('[CRON] Fatal error in nightly job:', err);
  }
}

/**
 * Process a single area: create orders from subscriptions + carts, then generate manifest.
 */
async function processArea(areaId, deliveryDate) {
  // 1. Get all active subscriptions in this area
  const subSnap = await db
    .collection('subscriptions')
    .where('area_id', '==', areaId)
    .where('status', '==', 'active')
    .get();

  let ordersCreated = 0;

  for (const subDoc of subSnap.docs) {
    const sub = subDoc.data();

    // Skip if subscription hasn't started yet
    if (sub.start_date > deliveryDate) continue;

    const userId = sub.user_id;

    // Check if order already exists for this user + date (idempotency)
    const existingOrder = await db
      .collection('orders')
      .where('user_id', '==', userId)
      .where('date', '==', deliveryDate)
      .limit(1)
      .get();

    if (!existingOrder.empty) continue;

    // 2. Check for overrides
    const overrideSnap = await db
      .collection('next_day_overrides')
      .where('user_id', '==', userId)
      .where('date', '==', deliveryDate)
      .limit(1)
      .get();

    let milk = null;
    let isSkipped = false;

    if (!overrideSnap.empty) {
      const override = overrideSnap.docs[0].data();
      if (override.override_type === 'skip') {
        isSkipped = true;
      } else if (override.override_type === 'modify') {
        milk = {
          milk_type: sub.milk_type,
          quantity_litres: override.modified_quantity,
          price_per_litre: sub.price_per_litre,
          total: override.modified_quantity * sub.price_per_litre,
        };
      }
    }

    // Default milk if no override
    if (!isSkipped && !milk) {
      milk = {
        milk_type: sub.milk_type,
        quantity_litres: sub.quantity_litres,
        price_per_litre: sub.price_per_litre,
        total: sub.quantity_litres * sub.price_per_litre,
      };
    }

    // 3. Get extra items from cart
    const cartSnap = await db
      .collection('carts')
      .where('user_id', '==', userId)
      .where('date', '==', deliveryDate)
      .limit(1)
      .get();

    let extraItems = [];
    if (!cartSnap.empty) {
      extraItems = cartSnap.docs[0].data().items || [];
    }

    // 4. Skip if nothing to deliver
    if (isSkipped && extraItems.length === 0) continue;

    // If skipped but has extras, milk is null but we still create the order for extras
    const milkTotal = milk ? milk.total : 0;
    const extrasTotal = extraItems.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = milkTotal + extrasTotal;

    // 5. Create order
    await orderService.createOrder({
      userId,
      areaId,
      date: deliveryDate,
      milk: isSkipped ? null : milk,
      extraItems,
      totalAmount,
    });

    ordersCreated++;
  }

  console.log(`[CRON] Created ${ordersCreated} orders for area ${areaId}`);

  // 6. Generate manifest PDF
  await manifestService.generateManifest(areaId, deliveryDate, 'system');

  // 7. Clean up processed overrides
  const overridesSnap = await db
    .collection('next_day_overrides')
    .where('area_id', '==', areaId)
    .where('date', '==', deliveryDate)
    .get();

  const batch = db.batch();
  overridesSnap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  // 8. Clean up processed carts
  const cartsSnap = await db
    .collection('carts')
    .where('area_id', '==', areaId)
    .where('date', '==', deliveryDate)
    .get();

  const cartBatch = db.batch();
  cartsSnap.docs.forEach((doc) => cartBatch.delete(doc.ref));
  await cartBatch.commit();

  // 9. Audit log
  await db.collection('audit_logs').add({
    actor_type: 'system',
    actor_id: 'nightly_cron',
    action: 'manifest.generated',
    entity_type: 'manifests',
    entity_id: areaId,
    details: { date: deliveryDate, orders_created: ordersCreated },
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Initialize the cron job schedule.
 */
function initCronJobs() {
  const cronHour = config.manifestCronHour;
  // Run at XX:00 every day
  const cronExpression = `0 ${cronHour} * * *`;

  cron.schedule(cronExpression, () => {
    console.log(`[CRON] Triggered at ${new Date().toISOString()}`);
    runNightlyJob();
  });

  console.log(`[CRON] Nightly manifest job scheduled at ${cronHour}:00 daily`);
}

module.exports = { initCronJobs, runNightlyJob, processArea };
