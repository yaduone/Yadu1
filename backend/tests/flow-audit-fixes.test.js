/**
 * Regression tests for control-flow breaks found in the November 2026 audit:
 *
 *  - Redis cache keys ignored the router mount path, so GET /api/areas,
 *    /api/products, /api/categories and /api/prices shared one cache entry.
 *  - A pause/cancel made between the cutoff and manifest generation dropped
 *    tomorrow's delivery, although the change was announced as taking effect
 *    the day after tomorrow.
 *  - The manifest scheduler only fired on the exact configured minute, so a
 *    restart at that minute skipped a whole day's orders and manifest.
 *  - Instant-order confirmation read the cart, created the order and emptied
 *    the cart as separate steps, so a repeated confirm placed a second order.
 *  - String quantities ("2") were concatenated into cart lines ("12").
 */

const { createFirebaseMock } = require('./helpers/fakeFirestore');

const mockFirebase = createFirebaseMock();
// "YYYY-MM-DD HH:mm" in the configured timezone; tests move it as needed.
const mockClock = { value: '2026-05-25 22:00' };

jest.mock('../src/config/firebase', () => ({
  get db() {
    return mockFirebase.db;
  },
  get admin() {
    return mockFirebase.admin;
  },
  bucket: null,
}));

jest.mock('../src/utils/date', () => {
  const actual = jest.requireActual('../src/utils/date');
  const moment = require('moment-timezone');
  const config = require('../src/config');
  const now = () => moment.tz(mockClock.value, 'YYYY-MM-DD HH:mm', config.timezone);
  return {
    ...actual,
    now,
    today: () => now().format('YYYY-MM-DD'),
    tomorrow: () => now().add(1, 'day').format('YYYY-MM-DD'),
    dayAfterTomorrow: () => now().add(2, 'days').format('YYYY-MM-DD'),
  };
});

jest.mock('../src/modules/notifications/notification.service', () => ({
  sendSubscriptionUpdatedNotification: jest.fn().mockResolvedValue(undefined),
  sendDeliveryNotification: jest.fn().mockResolvedValue(undefined),
  sendOrderCancelledNotification: jest.fn().mockResolvedValue(undefined),
  sendAdminInstantOrderNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/modules/notifications/email.service', () => ({
  sendInstantOrderCreatedEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/modules/notifications/telegram.service', () => ({
  sendInstantOrderCreatedAlert: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/modules/settings/instantHours.service', () => ({
  DEFAULTS: { eta_minutes: 30 },
  checkAvailability: jest.fn().mockResolvedValue({
    available: true,
    hours: { eta_minutes: 30, auto_expire_minutes: 0 },
  }),
  getHours: jest.fn(),
}));
jest.mock('../src/modules/settings/cartCharges.service', () => ({
  getChargesForType: jest.fn().mockResolvedValue([]),
}));

const mockGenerateManifest = jest.fn().mockResolvedValue({ id: 'manifest-1' });
jest.mock('../src/modules/manifests/manifest.service', () => ({
  generateManifest: (...args) => mockGenerateManifest(...args),
}));

const { buildCacheKey } = require('../src/middleware/cache');
const lifecycle = require('../src/modules/subscriptions/subscription.lifecycle');
const subscriptionService = require('../src/modules/subscriptions/subscription.service');
const { processArea, runScheduledManifestCheck } = require('../src/jobs/nightlyManifest');
const instantService = require('../src/modules/instant/instant.service');
const cartService = require('../src/modules/cart/cart.service');

const TOMORROW = '2026-05-26';
const DAY_AFTER = '2026-05-27';

function area(overrides = {}) {
  return {
    name: 'Mill Road',
    is_active: true,
    manifest_cutoff_time: '21:00',
    manifest_generation_time: '23:00',
    ...overrides,
  };
}

function subscription(overrides = {}) {
  return {
    user_id: 'user-1',
    area_id: 'area-1',
    milk_type: 'cow',
    quantity_litres: 1,
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
    areas: { 'area-1': area() },
    users: {
      'user-1': { name: 'Asha', phone: '9000000001', area_id: 'area-1', address: '12 Mill Road' },
    },
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
  mockClock.value = '2026-05-25 22:00';
});

describe('response cache keys', () => {
  test('GET / on different routers no longer share a key', () => {
    const keyFor = (baseUrl) => buildCacheKey({ baseUrl, path: '/', query: {} });
    const keys = ['/api/areas', '/api/products', '/api/categories', '/api/prices'].map(keyFor);
    expect(new Set(keys).size).toBe(4);
    expect(keyFor('/api/areas')).toBe('cache:api:areas::pub');
  });

  test('keys stay scoped per user and per query', () => {
    const base = { baseUrl: '/api/reports', path: '/user/calendar' };
    const a = buildCacheKey({ ...base, query: { month: '2026-05' }, user: { userId: 'u1' } });
    const b = buildCacheKey({ ...base, query: { month: '2026-05' }, user: { userId: 'u2' } });
    const c = buildCacheKey({ ...base, query: { month: '2026-06' }, user: { userId: 'u1' } });
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe('pause/cancel after the cutoff keeps tomorrow\'s committed delivery', () => {
  test('a post-cutoff pause still delivers tomorrow and stops the day after', async () => {
    const db = mockFirebase.db.reset(seed({ subscriptions: { 'sub-1': subscription() } }));

    const result = await subscriptionService.pauseSubscription('sub-1', 'user-1');
    expect(result.effective_from).toBe(DAY_AFTER);
    expect(db.get('subscriptions', 'sub-1')).toMatchObject({
      status: 'paused',
      delivery_stops_from: DAY_AFTER,
      active_from: '2026-05-01',
    });

    await processArea('area-1', TOMORROW);
    expect(ordersFor(db, TOMORROW)).toHaveLength(1);
    expect(ordersFor(db, TOMORROW)[0].milk).toMatchObject({ quantity_litres: 1, total: 60 });

    await processArea('area-1', DAY_AFTER);
    expect(ordersFor(db, DAY_AFTER)).toHaveLength(0);
  });

  test('a pre-cutoff pause stops tomorrow as before', async () => {
    mockClock.value = '2026-05-25 10:00';
    const db = mockFirebase.db.reset(seed({ subscriptions: { 'sub-1': subscription() } }));

    const result = await subscriptionService.pauseSubscription('sub-1', 'user-1');
    expect(result.effective_from).toBe(TOMORROW);

    await processArea('area-1', TOMORROW);
    expect(ordersFor(db, TOMORROW)).toHaveLength(0);
  });

  test('a post-cutoff cancel still delivers tomorrow, also when cancelled from a pause', async () => {
    const db = mockFirebase.db.reset(seed({ subscriptions: { 'sub-1': subscription() } }));

    await subscriptionService.pauseSubscription('sub-1', 'user-1');
    await subscriptionService.cancelSubscription('sub-1', 'user-1');
    expect(db.get('subscriptions', 'sub-1')).toMatchObject({
      status: 'cancelled',
      delivery_stops_from: DAY_AFTER,
    });

    await processArea('area-1', TOMORROW);
    expect(ordersFor(db, TOMORROW)).toHaveLength(1);
  });

  test('resuming a pause that never took effect undoes it', async () => {
    const db = mockFirebase.db.reset(seed({ subscriptions: { 'sub-1': subscription() } }));

    await subscriptionService.pauseSubscription('sub-1', 'user-1');
    const resumed = await subscriptionService.resumeSubscription('sub-1', 'user-1');

    expect(resumed.status).toBe('active');
    expect(resumed.effective_from).toBe(DAY_AFTER);
    const stored = db.get('subscriptions', 'sub-1');
    expect(stored).toMatchObject({ effective_from: '2026-05-01', delivery_stops_from: null, active_from: null });
    expect(lifecycle.isDeliverableOn(stored, TOMORROW)).toBe(true);
  });

  test('resuming after a pause that did take effect does not backfill', async () => {
    mockClock.value = '2026-05-25 10:00';
    const db = mockFirebase.db.reset(seed({ subscriptions: { 'sub-1': subscription() } }));
    await subscriptionService.pauseSubscription('sub-1', 'user-1'); // stops TOMORROW

    mockClock.value = '2026-05-25 22:00'; // now past the cutoff
    const resumed = await subscriptionService.resumeSubscription('sub-1', 'user-1');

    expect(resumed.effective_from).toBe(DAY_AFTER);
    const stored = db.get('subscriptions', 'sub-1');
    expect(lifecycle.isDeliverableOn(stored, TOMORROW)).toBe(false);
    expect(lifecycle.isDeliverableOn(stored, DAY_AFTER)).toBe(true);
  });

  test('legacy paused/cancelled rows without a stop window are never deliverable', () => {
    expect(lifecycle.isDeliverableOn(subscription({ status: 'paused', effective_from: DAY_AFTER }), TOMORROW)).toBe(false);
    expect(lifecycle.isDeliverableOn(subscription({ status: 'cancelled', effective_from: DAY_AFTER }), TOMORROW)).toBe(false);
  });
});

describe('manifest scheduler catch-up', () => {
  test('generates on a later tick when the exact minute was missed', async () => {
    mockClock.value = '2026-05-25 23:30';
    const db = mockFirebase.db.reset(seed({ subscriptions: { 'sub-1': subscription() } }));

    await runScheduledManifestCheck();

    expect(mockGenerateManifest).toHaveBeenCalledWith('area-1', TOMORROW, 'system');
    expect(ordersFor(db, TOMORROW)).toHaveLength(1);

    // The next tick does not generate again.
    mockGenerateManifest.mockClear();
    mockClock.value = '2026-05-25 23:31';
    await runScheduledManifestCheck();
    expect(mockGenerateManifest).not.toHaveBeenCalled();
  });

  test('does nothing before the generation time', async () => {
    mockClock.value = '2026-05-25 22:30';
    mockFirebase.db.reset(seed({ areas: { 'area-2': area() } }));

    await runScheduledManifestCheck();

    expect(mockGenerateManifest).not.toHaveBeenCalled();
  });

  test('leaves an area alone once its final manifest exists', async () => {
    mockClock.value = '2026-05-25 23:45';
    mockFirebase.db.reset(seed({
      areas: { 'area-3': area() },
      manifests: { 'm-1': { area_id: 'area-3', date: TOMORROW, status: 'ready', is_final: true } },
    }));

    await runScheduledManifestCheck();

    expect(mockGenerateManifest).not.toHaveBeenCalled();
  });

  test('a preview manifest does not count as final', async () => {
    mockClock.value = '2026-05-25 23:45';
    mockFirebase.db.reset(seed({
      areas: { 'area-4': area() },
      manifests: { 'm-1': { area_id: 'area-4', date: TOMORROW, status: 'preview', is_final: false } },
    }));

    await runScheduledManifestCheck();

    expect(mockGenerateManifest).toHaveBeenCalledWith('area-4', TOMORROW, 'system');
  });
});

describe('instant order confirmation', () => {
  function instantSeed() {
    return seed({
      products: {
        'prod-1': { name: 'Paneer', is_active: true, availability: 'instant', price: 100, unit: 'pack' },
      },
      instant_carts: {
        'user-1': {
          user_id: 'user-1',
          area_id: 'area-1',
          items: [{ product_id: 'prod-1', product_name: 'Paneer', quantity: 2, unit: 'pack', price: 100, total: 200 }],
          delivery_charge: 20,
        },
      },
    });
  }

  test('creates one order from the cart and empties it', async () => {
    const db = mockFirebase.db.reset(instantSeed());

    const order = await instantService.confirmOrder('user-1', 'area-1');

    expect(order).toMatchObject({ status: 'pending', items_total: 200, delivery_charge: 20, total_amount: 220 });
    expect(Object.keys(db.dump('instant_orders'))).toEqual([order.id]);
    expect(db.get('instant_carts', 'user-1').items).toEqual([]);
  });

  test('a repeated confirm is refused instead of placing a second order', async () => {
    const db = mockFirebase.db.reset(instantSeed());

    await instantService.confirmOrder('user-1', 'area-1');
    await expect(instantService.confirmOrder('user-1', 'area-1')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Your instant cart is empty',
    });
    expect(Object.keys(db.dump('instant_orders'))).toHaveLength(1);
  });

  test('refuses an item that was disabled while in the cart, leaving the cart intact', async () => {
    const data = instantSeed();
    data.products['prod-1'].is_active = false;
    const db = mockFirebase.db.reset(data);

    await expect(instantService.confirmOrder('user-1', 'area-1')).rejects.toMatchObject({ statusCode: 400 });
    expect(Object.keys(db.dump('instant_orders'))).toHaveLength(0);
    expect(db.get('instant_carts', 'user-1').items).toHaveLength(1);
  });
});

describe('cart quantity parsing', () => {
  test('numeric strings are accepted as numbers', () => {
    expect(cartService.parseUnits('2')).toBe(2);
    expect(cartService.parseUnits(0, { allowZero: true })).toBe(0);
  });

  test('fractions, empty and non-numeric values are refused', () => {
    for (const bad of ['1.5', '', null, 'abc', 0, -1]) {
      expect(() => cartService.parseUnits(bad)).toThrow(/whole number/);
    }
  });
});
