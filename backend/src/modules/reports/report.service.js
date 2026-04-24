const { db } = require('../../config/firebase');
const dateUtil = require('../../utils/date');

/**
 * Get user's personal report/insights.
 */
async function getUserSummary(userId) {
  const ordersSnap = await db.collection('orders').where('user_id', '==', userId).get();

  let totalMilkDelivered = 0;
  let totalMilkPending = 0;
  let totalSpent = 0;
  let extraItemsCount = 0;
  const monthlySummary = {};

  for (const doc of ordersSnap.docs) {
    const order = doc.data();
    const month = order.date.substring(0, 7); // YYYY-MM

    if (!monthlySummary[month]) {
      monthlySummary[month] = { month, milk_litres: 0, extra_items: 0, amount: 0 };
    }

    if (order.status === 'delivered') {
      if (order.milk) totalMilkDelivered += order.milk.quantity_litres;
      totalSpent += order.total_amount;
      if (order.milk) monthlySummary[month].milk_litres += order.milk.quantity_litres;
      monthlySummary[month].amount += order.total_amount;
    } else if (order.status === 'pending') {
      if (order.milk) totalMilkPending += order.milk.quantity_litres;
    }

    extraItemsCount += (order.extra_items || []).length;
    monthlySummary[month].extra_items += (order.extra_items || []).length;
  }

  // Count skipped days from audit logs or overrides
  const skipsSnap = await db
    .collection('next_day_overrides')
    .where('user_id', '==', userId)
    .where('override_type', '==', 'skip')
    .get();

  // Also count historical skips from orders that were not created (harder — approximate with override count)
  const totalSkippedDays = skipsSnap.size;

  return {
    total_milk_delivered_litres: totalMilkDelivered,
    total_milk_pending_litres: totalMilkPending,
    total_spent: Math.round(totalSpent * 100) / 100,
    total_skipped_days: totalSkippedDays,
    extra_items_count: extraItemsCount,
    monthly_summary: Object.values(monthlySummary).sort((a, b) => (b.month > a.month ? 1 : -1)),
  };
}

/**
 * Get admin dashboard data for an area.
 */
async function getAdminDashboard(areaId) {
  const tomorrow = dateUtil.tomorrow();
  const thisMonth = dateUtil.now().format('YYYY-MM');
  const monthStart = `${thisMonth}-01`;

  // Active/paused subscriptions
  const activeSnap = await db
    .collection('subscriptions')
    .where('area_id', '==', areaId)
    .where('status', '==', 'active')
    .get();

  const pausedSnap = await db
    .collection('subscriptions')
    .where('area_id', '==', areaId)
    .where('status', '==', 'paused')
    .get();

  // Total users in area
  const usersSnap = await db.collection('users').where('area_id', '==', areaId).get();

  // Tomorrow's totals — compute from active subscriptions + overrides
  let tomorrowTotalLitres = 0;
  let tomorrowOrderCount = 0;
  const milkTypeBreakdown = { cow: 0, buffalo: 0, toned: 0 };

  for (const subDoc of activeSnap.docs) {
    const sub = subDoc.data();
    if (sub.start_date > tomorrow) continue;

    // Check override
    const overrideSnap = await db
      .collection('next_day_overrides')
      .where('user_id', '==', sub.user_id)
      .where('date', '==', tomorrow)
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
      tomorrowTotalLitres += qty;
      tomorrowOrderCount++;
      milkTypeBreakdown[sub.milk_type] = (milkTypeBreakdown[sub.milk_type] || 0) + qty;
    }
  }

  // Revenue this month
  const ordersSnap = await db
    .collection('orders')
    .where('area_id', '==', areaId)
    .where('date', '>=', monthStart)
    .get();

  let revenueThisMonth = 0;
  ordersSnap.docs.forEach((doc) => {
    const order = doc.data();
    if (order.status === 'delivered') {
      revenueThisMonth += order.total_amount;
    }
  });

  // Product demand (from recent carts)
  const cartsSnap = await db.collection('carts').where('area_id', '==', areaId).where('date', '==', tomorrow).get();

  const productDemand = {};
  cartsSnap.docs.forEach((doc) => {
    (doc.data().items || []).forEach((item) => {
      if (!productDemand[item.product_name]) {
        productDemand[item.product_name] = 0;
      }
      productDemand[item.product_name] += item.quantity;
    });
  });

  return {
    active_subscriptions: activeSnap.size,
    paused_subscriptions: pausedSnap.size,
    total_users: usersSnap.size,
    tomorrow_total_litres: tomorrowTotalLitres,
    tomorrow_order_count: tomorrowOrderCount,
    revenue_this_month: Math.round(revenueThisMonth * 100) / 100,
    milk_type_breakdown: milkTypeBreakdown,
    product_demand: Object.entries(productDemand)
      .map(([product, quantity]) => ({ product, quantity }))
      .sort((a, b) => b.quantity - a.quantity),
  };
}

/**
 * Admin: daily stats for date range.
 */
async function getDailyStats(areaId, from, to) {
  const ordersSnap = await db
    .collection('orders')
    .where('area_id', '==', areaId)
    .where('date', '>=', from)
    .where('date', '<=', to)
    .get();

  const dailyMap = {};
  ordersSnap.docs.forEach((doc) => {
    const order = doc.data();
    if (!dailyMap[order.date]) {
      dailyMap[order.date] = { date: order.date, orders: 0, milk_litres: 0, amount: 0, delivered: 0 };
    }
    dailyMap[order.date].orders++;
    if (order.milk) dailyMap[order.date].milk_litres += order.milk.quantity_litres;
    dailyMap[order.date].amount += order.total_amount;
    if (order.status === 'delivered') dailyMap[order.date].delivered++;
  });

  return Object.values(dailyMap).sort((a, b) => (a.date > b.date ? 1 : -1));
}

/**
 * Get user's delivery calendar for a given month.
 * Returns a map of date -> { status, milk, extra_items, total_amount }
 * status: 'delivered' | 'pending' | 'cancelled' | 'skipped'
 */
async function getUserCalendar(userId, month) {
  // month format: YYYY-MM
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const nextMon = mon === 12 ? 1 : mon + 1;
  const nextYear = mon === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMon).padStart(2, '0')}-01`;

  // Fetch orders for the month
  const ordersSnap = await db
    .collection('orders')
    .where('user_id', '==', userId)
    .where('date', '>=', startDate)
    .where('date', '<', endDate)
    .get();

  const calendar = {};

  for (const doc of ordersSnap.docs) {
    const o = doc.data();
    calendar[o.date] = {
      order_id: doc.id,
      status: o.status,
      milk: o.milk || null,
      extra_items: o.extra_items || [],
      total_amount: o.total_amount,
    };
  }

  // Fetch skipped overrides — filter by user only, then filter date range in JS
  // (avoids needing a composite index on user_id + override_type + date)
  const skipsSnap = await db
    .collection('next_day_overrides')
    .where('user_id', '==', userId)
    .where('override_type', '==', 'skip')
    .get();

  for (const doc of skipsSnap.docs) {
    const d = doc.data().date;
    if (d >= startDate && d < endDate && !calendar[d]) {
      calendar[d] = { order_id: null, status: 'skipped', milk: null, extra_items: [], total_amount: 0 };
    }
  }

  // Summary counts
  let delivered = 0, pending = 0, skipped = 0, cancelled = 0;
  for (const entry of Object.values(calendar)) {
    if (entry.status === 'delivered') delivered++;
    else if (entry.status === 'pending') pending++;
    else if (entry.status === 'skipped') skipped++;
    else if (entry.status === 'cancelled') cancelled++;
  }

  return {
    month,
    calendar,
    summary: { delivered, pending, skipped, cancelled },
  };
}

module.exports = { getUserSummary, getAdminDashboard, getDailyStats, getUserCalendar };
