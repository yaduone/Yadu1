/**
 * End-to-end service tests for the subscription lifecycle:
 * start -> pause -> resume -> cancel, and the downstream effects on orders,
 * overrides, audit logs and notifications.
 *
 * These lock in the behaviours that were previously broken:
 *  - pause/resume/cancel were refused outright once an area's cutoff passed
 *  - a pause or cancel left a pending milk order behind, which got billed
 *  - two concurrent creates could both produce an active subscription
 *  - pause/resume/cancel wrote no audit log
 *  - consumers disagreed about when a subscription is deliverable
 */

const { createFirebaseMock } = require('./helpers/fakeFirestore');

const TOMORROW = '2026-05-26';
const DAY_AFTER = '2026-05-27';

// One stable instance: the services under test capture `db` when they are
// first required, so each case resets this instance rather than replacing it.
const mockFirebase = createFirebaseMock();
const mockGetCartTargetDate = jest.fn();
const mockIsPastCutoff = jest.fn();
const mockSendSubscriptionUpdated = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/config/firebase', () => {
  // Lazily delegate to the per-test instance installed in beforeEach.
  return {
    get db() {
      return mockFirebase.db;
    },
    get admin() {
      return mockFirebase.admin;
    },
  };
});

jest.mock('../src/modules/settings/manifestSettings.service', () => ({
  getCartTargetDate: (...args) => mockGetCartTargetDate(...args),
  isPastCutoff: (...args) => mockIsPastCutoff(...args),
}));

jest.mock('../src/modules/notifications/notification.service', () => ({
  sendSubscriptionUpdatedNotification: (...args) => mockSendSubscriptionUpdated(...args),
  sendDeliveryNotification: jest.fn().mockResolvedValue(undefined),
  sendOrderCancelledNotification: jest.fn().mockResolvedValue(undefined),
}));

const subscriptionService = require('../src/modules/subscriptions/subscription.service');
const lifecycle = require('../src/modules/subscriptions/subscription.lifecycle');

const COMPLETE_USER = {
  name: 'Asha',
  phone: '9000000001',
  area_id: 'area-1',
  address: '12 Mill Road',
};

function seedBase(extra = {}) {
  return {
    users: { 'user-1': { ...COMPLETE_USER } },
    price_config: {
      'price-cow': { milk_type: 'cow', is_active: true, price_per_litre: 60 },
    },
    ...extra,
  };
}

function activeSubscription(overrides = {}) {
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
    paused_at: null,
    resumed_at: null,
    cancelled_at: null,
    created_at: { seconds: 100 },
    ...overrides,
  };
}

function pendingMilkOrder(date, overrides = {}) {
  return {
    user_id: 'user-1',
    area_id: 'area-1',
    date,
    delivery_slot: 'morning',
    milk: { milk_type: 'cow', quantity_litres: 1, price_per_litre: 60, total: 60 },
    extra_items: [],
    total_amount: 60,
    status: 'pending',
    non_delivery_reason: null,
    ...overrides,
  };
}

function install(seed) {
  mockFirebase.db.reset(seed);
  return mockFirebase.db;
}

function auditActions(db) {
  return Object.values(db.dump('audit_logs')).map((log) => log.action);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCartTargetDate.mockResolvedValue(TOMORROW);
  mockIsPastCutoff.mockResolvedValue(false);
  mockSendSubscriptionUpdated.mockResolvedValue(undefined);
});

describe('starting a subscription', () => {
  test('creates an active subscription anchored to its start date', async () => {
    const db = install(seedBase());

    const created = await subscriptionService.createSubscription('user-1', 'area-1', {
      milk_type: 'cow',
      quantity_litres: 1.5,
      start_date: TOMORROW,
      delivery_slot: 'morning',
    });

    expect(created.status).toBe('active');
    expect(created.effective_from).toBe(TOMORROW);
    expect(created.price_per_litre).toBe(60);
    expect(Object.keys(db.dump('subscriptions'))).toHaveLength(1);
    expect(auditActions(db)).toContain('subscription.created');
  });

  test('rejects a start date earlier than the next open delivery date', async () => {
    install(seedBase());
    mockGetCartTargetDate.mockResolvedValue(DAY_AFTER);

    await expect(
      subscriptionService.createSubscription('user-1', 'area-1', {
        milk_type: 'cow',
        quantity_litres: 1,
        start_date: TOMORROW,
        delivery_slot: 'morning',
      })
    ).rejects.toThrow(`Start date must be ${DAY_AFTER} or later`);
  });

  test('refuses a second live subscription for the same user', async () => {
    const db = install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));

    await expect(
      subscriptionService.createSubscription('user-1', 'area-1', {
        milk_type: 'cow',
        quantity_litres: 1,
        start_date: TOMORROW,
        delivery_slot: 'morning',
      })
    ).rejects.toThrow('You already have an active or paused subscription');

    // The duplicate guard and the write share one transaction, so nothing was created.
    expect(Object.keys(db.dump('subscriptions'))).toHaveLength(1);
  });

  test('refuses to start when the profile is incomplete', async () => {
    install({
      users: { 'user-1': { name: 'Asha', area_id: 'area-1' } },
      price_config: { 'price-cow': { milk_type: 'cow', is_active: true, price_per_litre: 60 } },
    });

    await expect(
      subscriptionService.createSubscription('user-1', 'area-1', {
        milk_type: 'cow',
        quantity_litres: 1,
        start_date: TOMORROW,
        delivery_slot: 'morning',
      })
    ).rejects.toThrow('Please complete your profile before starting a subscription.');
  });
});

describe('pausing', () => {
  test('is allowed after the cutoff and takes effect the day after tomorrow', async () => {
    const db = install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));
    // Past cutoff: tomorrow is already committed, so the change rolls forward.
    mockIsPastCutoff.mockResolvedValue(true);
    mockGetCartTargetDate.mockResolvedValue(DAY_AFTER);

    const result = await subscriptionService.pauseSubscription('sub-1', 'user-1');

    expect(result.status).toBe('paused');
    expect(result.effective_from).toBe(DAY_AFTER);
    expect(db.get('subscriptions', 'sub-1').status).toBe('paused');
    expect(db.get('subscriptions', 'sub-1').effective_from).toBe(DAY_AFTER);
  });

  test('closes a pending milk-only order so a paused customer is not billed', async () => {
    const db = install(
      seedBase({
        subscriptions: { 'sub-1': activeSubscription() },
        orders: { 'order-tomorrow': pendingMilkOrder(TOMORROW) },
      })
    );

    await subscriptionService.pauseSubscription('sub-1', 'user-1');

    const order = db.get('orders', 'order-tomorrow');
    expect(order.milk).toBeNull();
    expect(order.total_amount).toBe(0);
    expect(order.status).toBe('not_delivered');
    expect(order.non_delivery_reason).toBe('subscription_paused');
  });

  test('keeps extra products but drops the milk charge', async () => {
    const db = install(
      seedBase({
        subscriptions: { 'sub-1': activeSubscription() },
        orders: {
          'order-tomorrow': pendingMilkOrder(TOMORROW, {
            extra_items: [{ product_name: 'Paneer', quantity: 1, total: 120 }],
            total_amount: 180,
          }),
        },
      })
    );

    await subscriptionService.pauseSubscription('sub-1', 'user-1');

    const order = db.get('orders', 'order-tomorrow');
    expect(order.milk).toBeNull();
    expect(order.status).toBe('pending');
    expect(order.total_amount).toBe(120);
  });

  test('never rewrites history: delivered and past orders are untouched', async () => {
    const db = install(
      seedBase({
        subscriptions: { 'sub-1': activeSubscription() },
        orders: {
          'order-delivered': pendingMilkOrder(TOMORROW, { status: 'delivered' }),
          'order-past': pendingMilkOrder('2026-05-20'),
        },
      })
    );

    await subscriptionService.pauseSubscription('sub-1', 'user-1');

    expect(db.get('orders', 'order-delivered').milk).not.toBeNull();
    expect(db.get('orders', 'order-delivered').total_amount).toBe(60);
    expect(db.get('orders', 'order-past').milk).not.toBeNull();
  });

  test('clears upcoming overrides and writes an audit log and notification', async () => {
    const db = install(
      seedBase({
        subscriptions: { 'sub-1': activeSubscription() },
        next_day_overrides: {
          'ovr-upcoming': { user_id: 'user-1', date: TOMORROW, override_type: 'modify', modified_quantity: 3 },
          'ovr-past': { user_id: 'user-1', date: '2026-05-20', override_type: 'skip' },
        },
      })
    );

    await subscriptionService.pauseSubscription('sub-1', 'user-1');

    expect(db.get('next_day_overrides', 'ovr-upcoming')).toBeUndefined();
    expect(db.get('next_day_overrides', 'ovr-past')).toBeDefined();
    expect(auditActions(db)).toContain('subscription.paused');
    expect(mockSendSubscriptionUpdated).toHaveBeenCalledWith(
      'user-1',
      'area-1',
      expect.objectContaining({ action: 'paused', title: 'Subscription Paused' })
    );
  });

  test('cannot pause an already paused subscription', async () => {
    install(seedBase({ subscriptions: { 'sub-1': activeSubscription({ status: 'paused' }) } }));

    await expect(subscriptionService.pauseSubscription('sub-1', 'user-1')).rejects.toThrow(
      'Only an active subscription can be paused.'
    );
  });

  test('rejects another user acting on the subscription', async () => {
    install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));

    await expect(subscriptionService.pauseSubscription('sub-1', 'intruder')).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('resuming', () => {
  test('reactivates from the next open delivery date', async () => {
    const db = install(
      seedBase({ subscriptions: { 'sub-1': activeSubscription({ status: 'paused', paused_at: 'then' }) } })
    );

    const result = await subscriptionService.resumeSubscription('sub-1', 'user-1');

    expect(result).toMatchObject({ status: 'active', effective_from: TOMORROW });
    const stored = db.get('subscriptions', 'sub-1');
    expect(stored.status).toBe('active');
    expect(stored.paused_at).toBeNull();
    expect(stored.effective_from).toBe(TOMORROW);
    expect(auditActions(db)).toContain('subscription.resumed');
  });

  test('a resume does not backfill deliveries for the paused days', async () => {
    install(seedBase({ subscriptions: { 'sub-1': activeSubscription({ status: 'paused' }) } }));

    const { effective_from: effectiveFrom } = await subscriptionService.resumeSubscription('sub-1', 'user-1');
    const resumed = { ...activeSubscription(), effective_from: effectiveFrom };

    // Yesterday stays undelivered; the effective date and later are live again.
    expect(lifecycle.isDeliverableOn(resumed, '2026-05-24')).toBe(false);
    expect(lifecycle.isDeliverableOn(resumed, effectiveFrom)).toBe(true);
    expect(lifecycle.isDeliverableOn(resumed, DAY_AFTER)).toBe(true);
  });

  test('cannot resume an active subscription', async () => {
    install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));

    await expect(subscriptionService.resumeSubscription('sub-1', 'user-1')).rejects.toThrow(
      'Only a paused subscription can be resumed.'
    );
  });
});

describe('cancelling', () => {
  test('is always permitted, even after the cutoff', async () => {
    const db = install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));
    mockIsPastCutoff.mockResolvedValue(true);
    mockGetCartTargetDate.mockResolvedValue(DAY_AFTER);

    const result = await subscriptionService.cancelSubscription('sub-1', 'user-1');

    expect(result).toMatchObject({ status: 'cancelled', effective_from: DAY_AFTER });
    expect(db.get('subscriptions', 'sub-1').status).toBe('cancelled');
    expect(auditActions(db)).toContain('subscription.cancelled');
  });

  test('can cancel straight from paused', async () => {
    const db = install(seedBase({ subscriptions: { 'sub-1': activeSubscription({ status: 'paused' }) } }));

    await subscriptionService.cancelSubscription('sub-1', 'user-1');

    expect(db.get('subscriptions', 'sub-1').status).toBe('cancelled');
  });

  test('withdraws upcoming milk orders and overrides', async () => {
    const db = install(
      seedBase({
        subscriptions: { 'sub-1': activeSubscription() },
        orders: { 'order-tomorrow': pendingMilkOrder(TOMORROW) },
        next_day_overrides: { 'ovr-1': { user_id: 'user-1', date: TOMORROW, override_type: 'skip' } },
      })
    );

    await subscriptionService.cancelSubscription('sub-1', 'user-1');

    expect(db.get('orders', 'order-tomorrow').non_delivery_reason).toBe('subscription_cancelled');
    expect(db.get('orders', 'order-tomorrow').total_amount).toBe(0);
    expect(db.get('next_day_overrides', 'ovr-1')).toBeUndefined();
  });

  test('cannot cancel twice', async () => {
    install(seedBase({ subscriptions: { 'sub-1': activeSubscription({ status: 'cancelled' }) } }));

    await expect(subscriptionService.cancelSubscription('sub-1', 'user-1')).rejects.toThrow(
      'This subscription is already cancelled.'
    );
  });

  test('frees the user to start a fresh subscription afterwards', async () => {
    const db = install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));

    await subscriptionService.cancelSubscription('sub-1', 'user-1');
    const fresh = await subscriptionService.createSubscription('user-1', 'area-1', {
      milk_type: 'cow',
      quantity_litres: 2,
      start_date: TOMORROW,
      delivery_slot: 'evening',
    });

    expect(fresh.status).toBe('active');
    expect(Object.keys(db.dump('subscriptions'))).toHaveLength(2);
  });
});

describe('quantity changes', () => {
  test('updates the daily quantity and audits the previous value', async () => {
    const db = install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));

    await subscriptionService.updateQuantity('sub-1', 'user-1', 2.5);

    expect(db.get('subscriptions', 'sub-1').quantity_litres).toBe(2.5);
    const log = Object.values(db.dump('audit_logs')).find(
      (l) => l.action === 'subscription.quantity_updated'
    );
    expect(log.details).toMatchObject({ quantity_litres: 2.5, previous_quantity: 1 });
  });

  test('is closed after the cutoff, because it edits a committed delivery', async () => {
    install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));
    mockIsPastCutoff.mockResolvedValue(true);

    await expect(subscriptionService.updateQuantity('sub-1', 'user-1', 2)).rejects.toThrow(
      /closed for the next delivery/
    );
  });

  test('rejects an off-grid quantity', async () => {
    install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));

    await expect(subscriptionService.updateQuantity('sub-1', 'user-1', 0.3)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('reading current state', () => {
  test('prefers the active subscription over a stale paused row', async () => {
    install(
      seedBase({
        subscriptions: {
          'sub-paused': activeSubscription({ status: 'paused', created_at: { seconds: 300 } }),
          'sub-active': activeSubscription({ created_at: { seconds: 100 } }),
        },
      })
    );

    const current = await subscriptionService.getActiveSubscription('user-1');

    expect(current.id).toBe('sub-active');
  });

  test('ignores cancelled subscriptions', async () => {
    install(seedBase({ subscriptions: { 'sub-1': activeSubscription({ status: 'cancelled' }) } }));

    await expect(subscriptionService.getActiveSubscription('user-1')).resolves.toBeNull();
  });
});

describe('admin area listing', () => {
  test('reports lifecycle state, customer details and area totals', async () => {
    install(
      seedBase({
        subscriptions: {
          'sub-active': activeSubscription({ quantity_litres: 2, created_at: { seconds: 200 } }),
          'sub-paused': activeSubscription({
            status: 'paused',
            quantity_litres: 1,
            created_at: { seconds: 100 },
          }),
        },
      })
    );

    const result = await subscriptionService.listByArea('area-1', {});

    expect(result.summary).toMatchObject({ active: 1, paused: 1, cancelled: 0, total: 2 });
    // Only active subscriptions count toward the daily commitment.
    expect(result.summary.daily_litres).toBe(2);
    expect(result.summary.daily_value).toBe(120);
    // Newest first.
    expect(result.subscriptions[0].id).toBe('sub-active');
    expect(result.subscriptions[0].user).toMatchObject({ name: 'Asha', phone: '9000000001' });
  });

  test('filters by status', async () => {
    install(
      seedBase({
        subscriptions: {
          'sub-active': activeSubscription(),
          'sub-cancelled': activeSubscription({ status: 'cancelled' }),
        },
      })
    );

    const result = await subscriptionService.listByArea('area-1', { status: 'cancelled' });

    expect(result.total).toBe(1);
    expect(result.subscriptions[0].status).toBe('cancelled');
  });
});

describe('customer notifications', () => {
  test('every lifecycle transition alerts the customer exactly once', async () => {
    install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));

    await subscriptionService.pauseSubscription('sub-1', 'user-1');
    await subscriptionService.resumeSubscription('sub-1', 'user-1');
    await subscriptionService.updateQuantity('sub-1', 'user-1', 2);
    await subscriptionService.cancelSubscription('sub-1', 'user-1');

    const actions = mockSendSubscriptionUpdated.mock.calls.map(([, , payload]) => payload.action);
    expect(actions).toEqual(['paused', 'resumed', 'quantity_updated', 'cancelled']);
    mockSendSubscriptionUpdated.mock.calls.forEach(([userId, areaId]) => {
      expect(userId).toBe('user-1');
      expect(areaId).toBe('area-1');
    });
  });

  test('a failed notification never fails the lifecycle change', async () => {
    const db = install(seedBase({ subscriptions: { 'sub-1': activeSubscription() } }));
    mockSendSubscriptionUpdated.mockRejectedValue(new Error('FCM unavailable'));

    await expect(subscriptionService.cancelSubscription('sub-1', 'user-1')).resolves.toMatchObject({
      status: 'cancelled',
    });
    expect(db.get('subscriptions', 'sub-1').status).toBe('cancelled');
  });
});

describe('deliverability predicate', () => {
  test('a paused subscription is never deliverable', () => {
    expect(lifecycle.isDeliverableOn(activeSubscription({ status: 'paused' }), TOMORROW)).toBe(false);
  });

  test('a subscription is not deliverable before its start date', () => {
    expect(lifecycle.isDeliverableOn(activeSubscription({ start_date: DAY_AFTER }), TOMORROW)).toBe(false);
  });

  test('a subscription is not deliverable before its effective date', () => {
    expect(
      lifecycle.isDeliverableOn(activeSubscription({ effective_from: DAY_AFTER }), TOMORROW)
    ).toBe(false);
  });

  test('an active, started subscription is deliverable', () => {
    expect(lifecycle.isDeliverableOn(activeSubscription(), TOMORROW)).toBe(true);
  });

  test('a missing subscription is not deliverable', () => {
    expect(lifecycle.isDeliverableOn(null, TOMORROW)).toBe(false);
  });
});
