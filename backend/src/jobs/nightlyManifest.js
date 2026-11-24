const cron = require('node-cron');
const { db, admin } = require('../config/firebase');
const config = require('../config');
const dateUtil = require('../utils/date');
const orderService = require('../modules/orders/order.service');
const manifestService = require('../modules/manifests/manifest.service');
const subscriptionLifecycle = require('../modules/subscriptions/subscription.lifecycle');
const manifestSettings = require('../modules/settings/manifestSettings.service');
let lastPastDeliverySweepDate = null;

/**
 * Nightly job: process all areas, create orders, generate manifests.
 * Runs at configured hour (default 11 PM IST).
 */
async function runNightlyJob(areaId = null) {
  const deliveryDate = dateUtil.tomorrow();
  console.log(`[CRON] Starting nightly manifest job for delivery date: ${deliveryDate}`);

  try {
    if (areaId) {
      await processArea(areaId, deliveryDate);
      console.log(`[CRON] Nightly job completed for area ${areaId} on ${deliveryDate}`);
      return;
    }

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

// Catch-up bookkeeping for runScheduledManifestCheck (per process).
// areaId -> delivery date whose final manifest is known to exist.
const finalizedManifestDates = new Map();
// Areas whose generation is running right now (a run can outlast a minute).
const generationInFlight = new Set();
// areaId -> ms timestamp of the last catch-up attempt that failed.
const lastFailedCatchUpAt = new Map();
const CATCH_UP_RETRY_MS = 10 * 60 * 1000;

async function hasFinalManifest(areaId, deliveryDate) {
  const snap = await db
    .collection('manifests')
    .where('area_id', '==', areaId)
    .where('date', '==', deliveryDate)
    .limit(1)
    .get();
  if (snap.empty) return false;
  const manifest = snap.docs[0].data();
  return manifest.status !== 'preview' && manifest.is_final !== false;
}

/**
 * Every-minute scheduler: generate each area's manifest at its configured time.
 *
 * The exact-minute match alone is fragile: a restart, deploy or slow tick that
 * spans the generation minute used to skip the day entirely — no orders, no
 * manifest, nothing delivered. So for the rest of the evening after the
 * generation time, an area whose final manifest for tomorrow does not exist yet
 * is generated on the next tick (processArea is idempotent).
 */
async function runScheduledManifestCheck() {
  const current = dateUtil.now();
  const currentTime = current.format('HH:mm');
  const deliveryDate = dateUtil.tomorrow();

  try {
    const today = dateUtil.today();
    if (lastPastDeliverySweepDate !== today) {
      const markedNotDelivered = await orderService.markPastPendingOrdersNotDelivered();
      lastPastDeliverySweepDate = today;
      console.log(`[CRON] Marked ${markedNotDelivered} unconfirmed past orders as not delivered`);
    }

    const areasSnap = await db.collection('areas').where('is_active', '==', true).get();

    for (const areaDoc of areasSnap.docs) {
      const area = areaDoc.data();
      const areaId = areaDoc.id;
      const label = area.name || areaId;
      const settings = manifestSettings.settingsFromAreaDoc(areaId, area);
      const isScheduledMinute = manifestSettings.isExactMinute(settings.generation_time, current);
      if (!isScheduledMinute && !manifestSettings.isAtOrPast(settings.generation_time, current)) continue;
      if (generationInFlight.has(areaId)) continue;

      if (isScheduledMinute) {
        console.log(`[CRON] ${label} reached manifest time ${currentTime}; delivery date ${deliveryDate}`);
      } else {
        if (finalizedManifestDates.get(areaId) === deliveryDate) continue;
        const lastFailure = lastFailedCatchUpAt.get(areaId);
        if (lastFailure && Date.now() - lastFailure < CATCH_UP_RETRY_MS) continue;
        try {
          if (await hasFinalManifest(areaId, deliveryDate)) {
            finalizedManifestDates.set(areaId, deliveryDate);
            continue;
          }
        } catch (err) {
          console.error(`[CRON] Could not check manifest state for ${label}:`, err.message);
          continue;
        }
        console.warn(
          `[CRON] ${label} missed its ${settings.generation_time} manifest time; generating for ${deliveryDate} now`
        );
      }

      generationInFlight.add(areaId);
      try {
        await processArea(areaId, deliveryDate);
        finalizedManifestDates.set(areaId, deliveryDate);
        lastFailedCatchUpAt.delete(areaId);
        console.log(`[CRON] Completed scheduled manifest for ${label}`);
      } catch (err) {
        lastFailedCatchUpAt.set(areaId, Date.now());
        console.error(`[CRON] Error processing scheduled manifest for ${label}:`, err.message);
      } finally {
        generationInFlight.delete(areaId);
      }
    }
  } catch (err) {
    console.error('[CRON] Fatal error in scheduled manifest check:', err);
  }
}

/**
 * Process a single area: create orders from subscriptions + carts, then generate manifest.
 */
async function processArea(areaId, deliveryDate) {
  // 1. Get this area's subscriptions. Not only `active` ones: a pause or cancel
  // made after the cutoff takes effect the day after tomorrow, so that row is
  // still owed tomorrow's delivery. isDeliverableOn below decides per row.
  const subSnap = await db
    .collection('subscriptions')
    .where('area_id', '==', areaId)
    .get();

  let ordersCreated = 0;
  let ordersUpdated = 0;

  for (const subDoc of subSnap.docs) {
    const sub = subDoc.data();

    // Skip unless this subscription is actually deliverable on the date:
    // active, already started, and not inside a pause that takes effect first.
    if (!subscriptionLifecycle.isDeliverableOn(sub, deliveryDate)) continue;

    const userId = sub.user_id;

    // Check if order already exists for this user + date (idempotency)
    const existingOrder = await db
      .collection('orders')
      .where('user_id', '==', userId)
      .where('date', '==', deliveryDate)
      .limit(1)
      .get();

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

    // Attach slot from subscription (morning / evening / both)
    const deliverySlot = sub.delivery_slot || 'morning';

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

    // An earlier generation attempt may already have produced a milk-only order.
    // When the source cart still exists, reconcile only extras on pending orders.
    if (!existingOrder.empty) {
      if (!cartSnap.empty) {
        const sync = await orderService.syncPendingOrderExtras(existingOrder.docs[0], extraItems);
        if (sync.updated) ordersUpdated++;
      }
      continue;
    }

    // 4. Keep a historical non-delivery record for a fully skipped date.
    // The manifest builder excludes these records because no delivery is routed.
    if (isSkipped && extraItems.length === 0) {
      const skippedOrder = await orderService.createOrder({
        userId,
        areaId,
        date: deliveryDate,
        milk: null,
        deliverySlot,
        extraItems: [],
        totalAmount: 0,
        status: 'not_delivered',
        nonDeliveryReason: 'skipped',
      });

      if (skippedOrder.created) ordersCreated++;
      continue;
    }

    // If skipped but has extras, milk is null but we still create the order for extras
    const milkTotal = milk ? milk.total : 0;
    const extrasTotal = orderService.extrasTotal(extraItems);
    const totalAmount = milkTotal + extrasTotal;

    // 5. Create order
    const generatedOrder = await orderService.createOrder({
      userId,
      areaId,
      date: deliveryDate,
      milk: isSkipped ? null : milk,
      deliverySlot,
      extraItems,
      totalAmount,
    });

    if (generatedOrder.created) ordersCreated++;
  }

  // Include extra-product-only carts that were not covered by an active subscription.
  const extraOnlyCartsSnap = await db
    .collection('carts')
    .where('area_id', '==', areaId)
    .where('date', '==', deliveryDate)
    .get();

  for (const cartDoc of extraOnlyCartsSnap.docs) {
    const cart = cartDoc.data();
    const userId = cart.user_id;
    const extraItems = cart.items || [];
    if (!userId || extraItems.length === 0) continue;

    const existingOrder = await db
      .collection('orders')
      .where('user_id', '==', userId)
      .where('date', '==', deliveryDate)
      .limit(1)
      .get();

    if (!existingOrder.empty) {
      const sync = await orderService.syncPendingOrderExtras(existingOrder.docs[0], extraItems);
      if (sync.updated) ordersUpdated++;
      continue;
    }

    const extrasTotal = orderService.extrasTotal(extraItems);
    const generatedOrder = await orderService.createOrder({
      userId,
      areaId,
      date: deliveryDate,
      milk: null,
      deliverySlot: 'morning',
      extraItems,
      totalAmount: extrasTotal,
    });

    if (generatedOrder.created) ordersCreated++;
  }

  console.log(`[CRON] Created ${ordersCreated} and reconciled ${ordersUpdated} orders for area ${areaId}`);

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
    details: { date: deliveryDate, orders_created: ordersCreated, orders_updated: ordersUpdated },
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Initialize the cron job schedule.
 */
function initCronJobs() {
  const cronExpression = '* * * * *';

  cron.schedule(cronExpression, () => {
    console.log(`[CRON] Triggered at ${new Date().toISOString()}`);
    runScheduledManifestCheck();
  }, {
    timezone: config.timezone,
  });

  console.log(`[CRON] Manifest scheduler checks every minute in ${config.timezone}`);
}

module.exports = { initCronJobs, runNightlyJob, runScheduledManifestCheck, processArea };
