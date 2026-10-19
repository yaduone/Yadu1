/**
 * Integration tests across the whole subscription -> order -> manifest chain.
 *
 * The lifecycle status only matters if the nightly job and the manifest actually
 * honour it. These tests drive the real `processArea` and the real manifest
 * preview builder, so a future change that re-introduces one of the old
 * inconsistencies (delivering for a paused customer, billing a subscription
 * before its start date, NaN totals from a malformed cart item) fails here.
 */

const { createFirebaseMock } = require('./helpers/fakeFirestore');

const DELIVERY_DATE = '2026-05-26';
const DAY_AFTER = '2026-05-27';

const mockFirebase = createFirebaseMock();

jest.mock('../src/config/firebase', () => ({
  get db() {
    return mockFirebase.db;
  },
  get admin() {
    return mockFirebase.admin;
  },
  bucket: null,
}));

jest.mock('../src/modules/settings/manifestSettings.service', () => ({
  getCartTargetDate: jest.fn().mockResolvedValue('2026-05-26'),
  isPastCutoff: jest.fn().mockResolvedValue(false),
  findAreaDocByIdOrSlug: jest.fn(),
  settingsFromAreaDoc: jest.fn(),
  getAreaManifestSettings: jest.fn(),
  isExactMinute: jest.fn(),
  isAtOrPast: jest.fn(),
  cartTargetDateFromSettings: jest.fn(),
}));

jest.mock('../src/modules/notifications/notification.service', () => ({
  sendSubscriptionUpdatedNotification: jest.fn().mockResolvedValue(undefined),
  sendDeliveryNotification: jest.fn().mockResolvedValue(undefined),
  sendOrderCancelledNotification: jest.fn().mockResolvedValue(undefined),
}));

// The manifest PDF/upload step is out of scope here: these tests assert the
// order rows that feed it, not the rendered document.
const mockGenerateManifest = jest.fn().mockResolvedValue({ id: 'manifest-1' });
jest.mock('../src/modules/manifests/manifest.service', () => {
  const actual = jest.requireActual('../src/modules/manifests/manifest.service');
  return { ...actual, generateManifest: (...args) => mockGenerateManifest(...args) };
});

const { processArea } = require('../src/jobs/nightlyManifest');
const subscriptionService = require('../src/modules/subscriptions/subscription.service');

function subscription(overrides = {}) {
  return {
    user_id: 'user-1',
    area_id: 'area-1',
    milk_type: 'cow',
    quantity_litres: 2,
    delivery_slot: 'morning',
    price_per_litre: 60,
    status: 'active',
    start_date: '2026-05-01',
    effective_from: '2026-05-01',
    created_at: { seconds: 100 },
    ...overrides,
  };
}

function seed(extra = {}) {
  return {
    areas: { 'area-1': { name: 'Mill Road', is_active: true } },
    users: { 'user-1': { name: 'Asha', phone: '9000000001', area_id: 'area-1', address: '12 Mill Road' } },
    price_config: { 'price-cow': { milk_type: 'cow', is_active: true, price_per_litre: 60 } },
    ...extra,
  };
}

function ordersFor(db, date) {
  return Object.values(db.dump('orders')).filter((o) => o.date === date);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGenerateManifest.mockResolvedValue({ id: 'manifest-1' });
});

describe('nightly generation honours subscription state', () => {
  test('creates a milk order for an active, started subscription', async () => {
    const db = mockFirebase.db.reset(seed({ subscriptions: { 'sub-1': subscription() } }));

    await processArea('area-1', DELIVERY_DATE);

    const orders = ordersFor(db, DELIVERY_DATE);
    expect(orders).toHaveLength(1);
    expect(orders[0].milk).toMatchObject({ milk_type: 'cow', quantity_litres: 2, total: 120 });
    expect(orders[0].total_amount).toBe(120);
    expect(orders[0].status).toBe('pending');
  });

  test('creates nothing for a paused subscription', async () => {
    const db = mockFirebase.db.reset(
      seed({ subscriptions: { 'sub-1': subscription({ status: 'paused' }) } })
    );

    await processArea('area-1', DELIVERY_DATE);

    expect(ordersFor(db, DELIVERY_DATE)).toHaveLength(0);
  });

  test('creates nothing for a cancelled subscription', async () => {
    const db = mockFirebase.db.reset(
      seed({ subscriptions: { 'sub-1': subscription({ status: 'cancelled' }) } })
    );

    await processArea('area-1', DELIVERY_DATE);

    expect(ordersFor(db, DELIVERY_DATE)).toHaveLength(0);
  });

  test('does not deliver before the subscription start date', async () => {
    const db = mockFirebase.db.reset(
      seed({ subscriptions: { 'sub-1': subscription({ start_date: DAY_AFTER, effective_from: DAY_AFTER }) } })
    );

    await processArea('area-1', DELIVERY_DATE);

    expect(ordersFor(db, DELIVERY_DATE)).toHaveLength(0);
  });

  test('does not deliver before the effective date of a resume', async () => {
    // Resumed after the cutoff: active again, but only from the day after.
    const db = mockFirebase.db.reset(
      seed({ subscriptions: { 'sub-1': subscription({ effective_from: DAY_AFTER }) } })
    );

    await processArea('area-1', DELIVERY_DATE);

    expect(ordersFor(db, DELIVERY_DATE)).toHaveLength(0);
  });

  test('a cart item with a malformed total never produces a NaN charge', async () => {
    const db = mockFirebase.db.reset(
      seed({
        subscriptions: { 'sub-1': subscription() },
        carts: {
          'cart-1': {
            user_id: 'user-1',
            area_id: 'area-1',
            date: DELIVERY_DATE,
            items: [{ product_name: 'Ghee', quantity: 1 }], // total missing
          },
        },
      })
    );

    await processArea('area-1', DELIVERY_DATE);

    const order = ordersFor(db, DELIVERY_DATE)[0];
    expect(Number.isNaN(order.total_amount)).toBe(false);
    expect(order.total_amount).toBe(120);
  });

  test('records a skipped day as a non-delivery rather than a charge', async () => {
    const db = mockFirebase.db.reset(
      seed({
        subscriptions: { 'sub-1': subscription() },
        next_day_overrides: {
          'ovr-1': { user_id: 'user-1', area_id: 'area-1', date: DELIVERY_DATE, override_type: 'skip' },
        },
      })
    );

    await processArea('area-1', DELIVERY_DATE);

    const order = ordersFor(db, DELIVERY_DATE)[0];
    expect(order.status).toBe('not_delivered');
    expect(order.non_delivery_reason).toBe('skipped');
    expect(order.total_amount).toBe(0);
  });

  test('applies a modify override to the generated quantity', async () => {
    const db = mockFirebase.db.reset(
      seed({
        subscriptions: { 'sub-1': subscription() },
        next_day_overrides: {
          'ovr-1': {
            user_id: 'user-1',
            area_id: 'area-1',
            date: DELIVERY_DATE,
            override_type: 'modify',
            modified_quantity: 0.5,
          },
        },
      })
    );

    await processArea('area-1', DELIVERY_DATE);

    const order = ordersFor(db, DELIVERY_DATE)[0];
    expect(order.milk.quantity_litres).toBe(0.5);
    expect(order.total_amount).toBe(30);
  });
});

describe('pausing after generation', () => {
  test('a pause taking effect tomorrow withdraws the order the job just made', async () => {
    const db = mockFirebase.db.reset(seed({ subscriptions: { 'sub-1': subscription() } }));

    // The nightly job runs and bills 2L...
    await processArea('area-1', DELIVERY_DATE);
    expect(ordersFor(db, DELIVERY_DATE)[0].total_amount).toBe(120);

    // ...then the customer pauses, effective on that same date.
    await subscriptionService.pauseSubscription('sub-1', 'user-1');

    const order = ordersFor(db, DELIVERY_DATE)[0];
    expect(order.milk).toBeNull();
    expect(order.total_amount).toBe(0);
    expect(order.status).toBe('not_delivered');
    expect(order.non_delivery_reason).toBe('subscription_paused');
  });

  test('re-running generation after a pause does not resurrect the milk order', async () => {
    const db = mockFirebase.db.reset(seed({ subscriptions: { 'sub-1': subscription() } }));

    await processArea('area-1', DELIVERY_DATE);
    await subscriptionService.pauseSubscription('sub-1', 'user-1');
    await processArea('area-1', DELIVERY_DATE);

    const orders = ordersFor(db, DELIVERY_DATE);
    expect(orders).toHaveLength(1);
    expect(orders[0].milk).toBeNull();
    expect(orders[0].total_amount).toBe(0);
  });
});

describe('the full customer journey', () => {
  test('start, deliver, pause, resume and cancel produce the right orders per day', async () => {
    const db = mockFirebase.db.reset(seed());

    // Day 1 — the customer starts a subscription for the next delivery date.
    await subscriptionService.createSubscription('user-1', 'area-1', {
      milk_type: 'cow',
      quantity_litres: 1,
      start_date: DELIVERY_DATE,
      delivery_slot: 'morning',
    });
    const subId = Object.keys(db.dump('subscriptions'))[0];

    await processArea('area-1', DELIVERY_DATE);
    expect(ordersFor(db, DELIVERY_DATE)[0].total_amount).toBe(60);

    // The customer pauses, effective on the next open date.
    await subscriptionService.pauseSubscription(subId, 'user-1');
    await processArea('area-1', '2026-05-28');
    expect(ordersFor(db, '2026-05-28')).toHaveLength(0);

    // Resuming makes later dates live again.
    await subscriptionService.resumeSubscription(subId, 'user-1');
    await processArea('area-1', '2026-05-29');
    expect(ordersFor(db, '2026-05-29')[0].total_amount).toBe(60);

    // Cancelling stops everything after it.
    await subscriptionService.cancelSubscription(subId, 'user-1');
    await processArea('area-1', '2026-05-30');
    expect(ordersFor(db, '2026-05-30')).toHaveLength(0);

    // The admin view reflects the final state.
    const listing = await subscriptionService.listByArea('area-1', {});
    expect(listing.summary).toMatchObject({ active: 0, paused: 0, cancelled: 1 });
    expect(listing.subscriptions[0]).toMatchObject({ status: 'cancelled', user: { name: 'Asha' } });
  });
});
