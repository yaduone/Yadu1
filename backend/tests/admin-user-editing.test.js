/**
 * Admin user page: editing a customer's profile and account settings, manual
 * due adjustments (add / reduce / reverse, linking an unpaid instant order),
 * custom milk rate and milk-type changes, and the per-customer instant-order
 * block.
 */

const { createFirebaseMock } = require('./helpers/fakeFirestore');

const TARGET = '2026-05-26';

const mockFirebase = createFirebaseMock();
const mockIsPastCutoff = jest.fn();
const mockNotify = {
  sendDueAdjustedNotification: jest.fn().mockResolvedValue(undefined),
  sendSubscriptionUpdatedNotification: jest.fn().mockResolvedValue(undefined),
  sendAdminInstantOrderNotification: jest.fn().mockResolvedValue(undefined),
};

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
  getCartTargetDate: async () => TARGET,
  isPastCutoff: (...args) => mockIsPastCutoff(...args),
}));
jest.mock('../src/modules/notifications/notification.service', () => mockNotify);
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
jest.mock('../src/utils/activityLog', () => ({ logActivity: jest.fn().mockResolvedValue(undefined) }));

const dueService = require('../src/modules/dues/due.service');
const userAdmin = require('../src/modules/users/userAdmin.service');
const adminOrders = require('../src/modules/adminOrders/adminOrder.service');
const instantService = require('../src/modules/instant/instant.service');

const AREA_ADMIN = { adminId: 'admin-1', areaId: 'area-1', role: 'area_admin', username: 'ravi' };
const OTHER_ADMIN = { adminId: 'admin-2', areaId: 'area-2', role: 'area_admin', username: 'meena' };
const SUPER_ADMIN = { adminId: 'admin-9', areaId: 'area-1', role: 'super_admin', username: 'root' };

const ASHA = { id: 'user-1', name: 'Asha', phone: '+919000000001', area_id: 'area-1' };

function seed(extra = {}) {
  return {
    users: {
      'user-1': {
        name: 'Asha',
        phone: '+919000000001',
        area_id: 'area-1',
        address: { line1: '12 Mill Road', landmark: '', pincode: '243001' },
      },
      'user-2': { name: 'Bina', phone: '+919000000002', area_id: 'area-2', address: { line1: 'X', pincode: '243002' } },
    },
    areas: {
      'area-1': { name: 'Bareilly', is_active: true },
      'area-2': { name: 'Satellite', is_active: true },
      'area-off': { name: 'Closed', is_active: false },
    },
    due_amounts: {
      'user-1': { user_id: 'user-1', area_id: 'area-1', total_billed: 500, total_paid: 200, due_amount: 300 },
    },
    price_config: {
      cow: { milk_type: 'cow', price_per_litre: 60, is_active: true },
      buffalo: { milk_type: 'buffalo', price_per_litre: 70, is_active: true },
    },
    ...extra,
  };
}

function liveSubscription(overrides = {}) {
  return {
    'sub-1': {
      user_id: 'user-1',
      area_id: 'area-1',
      milk_type: 'cow',
      quantity_litres: 1,
      delivery_slot: 'morning',
      price_per_litre: 60,
      status: 'active',
      start_date: '2026-05-01',
      effective_from: '2026-05-01',
      ...overrides,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsPastCutoff.mockResolvedValue(false);
});

// ─── Due adjustments ─────────────────────────────────────────────────────────

describe('manual due adjustments', () => {
  test('a charge adds to billed and due and tells the customer why', async () => {
    const db = mockFirebase.db.reset(seed());

    const result = await dueService.recordAdjustment(AREA_ADMIN, ASHA, {
      type: 'charge', amount: 150, category: 'previous_balance', note: 'April balance before the app',
    });

    expect(result.due).toEqual({ total_billed: 650, total_paid: 200, due_amount: 450 });
    expect(db.get('due_amounts', 'user-1')).toMatchObject({ total_billed: 650, total_paid: 200, due_amount: 450 });

    const [adjustment] = Object.values(db.dump('due_adjustments'));
    expect(adjustment).toMatchObject({
      user_id: 'user-1', type: 'charge', amount: 150, category: 'previous_balance',
      due_before: 300, due_after: 450, voided: false,
      created_by: { admin_id: 'admin-1', username: 'ravi' },
    });
    expect(mockNotify.sendDueAdjustedNotification).toHaveBeenCalledWith('user-1', 'area-1', expect.objectContaining({
      type: 'charge', amount: 150, reason: 'April balance before the app', newDue: 450,
    }));
  });

  test('a credit reduces billed and due, keeping due = billed - paid', async () => {
    const db = mockFirebase.db.reset(seed());

    // Sent as a string, as a form field would be; money is kept to 2 decimals.
    await dueService.recordAdjustment(AREA_ADMIN, ASHA, { type: 'credit', amount: '50.499', category: 'discount' });

    const due = db.get('due_amounts', 'user-1');
    expect(due.due_amount).toBe(249.5);
    expect(due.total_billed).toBe(449.5);
    expect(due.total_billed - due.total_paid).toBeCloseTo(due.due_amount, 5);
  });

  test('creates the balance document for a customer who has none yet', async () => {
    const db = mockFirebase.db.reset(seed({ due_amounts: {} }));

    await dueService.recordAdjustment(AREA_ADMIN, ASHA, { type: 'charge', amount: 80 });

    expect(db.get('due_amounts', 'user-1')).toMatchObject({
      user_id: 'user-1', area_id: 'area-1', total_billed: 80, total_paid: 0, due_amount: 80,
    });
  });

  test('notify: false records the change without messaging the customer', async () => {
    mockFirebase.db.reset(seed());
    await dueService.recordAdjustment(AREA_ADMIN, ASHA, { type: 'charge', amount: 10 }, { notify: false });
    expect(mockNotify.sendDueAdjustedNotification).not.toHaveBeenCalled();
  });

  test.each([
    [{ type: 'refund', amount: 10 }, /type must be/],
    [{ type: 'charge', amount: 0 }, /greater than 0/],
    [{ type: 'charge', amount: -5 }, /greater than 0/],
    [{ type: 'charge', amount: 'abc' }, /greater than 0/],
    [{ type: 'charge', amount: 100001 }, /cannot exceed/],
    [{ type: 'charge', amount: 10, category: 'bribe' }, /category must be/],
    [{ type: 'charge', amount: 10, date: '26/05/2026' }, /YYYY-MM-DD/],
    [{ type: 'charge', amount: 10, note: 'x'.repeat(201) }, /200 characters/],
    [{ type: 'credit', amount: 10, reference_type: 'instant_order', reference_id: 'io-1' }, /only be added to the due as a charge/],
  ])('rejects invalid input %j', async (body, message) => {
    const db = mockFirebase.db.reset(seed());
    await expect(dueService.recordAdjustment(AREA_ADMIN, ASHA, body)).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(message) });
    expect(db.get('due_amounts', 'user-1').due_amount).toBe(300);
  });

  test('a replayed request_id is recorded once', async () => {
    const db = mockFirebase.db.reset(seed());
    const body = { type: 'charge', amount: 100, request_id: 'req-abc-12345' };

    const first = await dueService.recordAdjustment(AREA_ADMIN, ASHA, body);
    const second = await dueService.recordAdjustment(AREA_ADMIN, ASHA, body);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(db.get('due_amounts', 'user-1').due_amount).toBe(400);
    expect(Object.keys(db.dump('due_adjustments'))).toHaveLength(1);
    expect(mockNotify.sendDueAdjustedNotification).toHaveBeenCalledTimes(1);
  });

  describe('linking an unpaid instant (cash) order', () => {
    function withInstant(status = 'delivered', extra = {}) {
      return seed({
        instant_orders: {
          'io-1': { user_id: 'user-1', area_id: 'area-1', status, total_amount: 220, ...extra },
          'io-other': { user_id: 'user-2', area_id: 'area-2', status: 'delivered', total_amount: 99 },
        },
      });
    }

    test('moves a delivered order onto the account exactly once', async () => {
      const db = mockFirebase.db.reset(withInstant());
      const body = { type: 'charge', amount: 220, category: 'instant_order', reference_type: 'instant_order', reference_id: 'io-1' };

      const { adjustment } = await dueService.recordAdjustment(AREA_ADMIN, ASHA, body);

      expect(db.get('instant_orders', 'io-1').due_adjustment_id).toBe(adjustment.id);
      expect(db.get('due_amounts', 'user-1').due_amount).toBe(520);

      await expect(dueService.recordAdjustment(AREA_ADMIN, ASHA, body)).rejects.toMatchObject({ statusCode: 409 });
      expect(db.get('due_amounts', 'user-1').due_amount).toBe(520);
    });

    test('refuses an order that was not delivered', async () => {
      mockFirebase.db.reset(withInstant('rejected'));
      await expect(dueService.recordAdjustment(AREA_ADMIN, ASHA, {
        type: 'charge', amount: 220, reference_type: 'instant_order', reference_id: 'io-1',
      })).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/delivered/) });
    });

    test("refuses another customer's order", async () => {
      mockFirebase.db.reset(withInstant());
      await expect(dueService.recordAdjustment(AREA_ADMIN, ASHA, {
        type: 'charge', amount: 99, reference_type: 'instant_order', reference_id: 'io-other',
      })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('reversing the charge frees the order to be added again', async () => {
      const db = mockFirebase.db.reset(withInstant());
      const { adjustment } = await dueService.recordAdjustment(AREA_ADMIN, ASHA, {
        type: 'charge', amount: 220, reference_type: 'instant_order', reference_id: 'io-1',
      });

      await dueService.voidAdjustment(AREA_ADMIN, adjustment.id, { reason: 'Customer had paid cash' });

      expect(db.get('instant_orders', 'io-1').due_adjustment_id).toBeNull();
      expect(db.get('due_amounts', 'user-1').due_amount).toBe(300);
    });
  });

  describe('reversing', () => {
    test('applies the exact inverse and keeps the entry, marked voided', async () => {
      const db = mockFirebase.db.reset(seed());
      const { adjustment } = await dueService.recordAdjustment(AREA_ADMIN, ASHA, { type: 'credit', amount: 75 });
      expect(db.get('due_amounts', 'user-1').due_amount).toBe(225);

      const result = await dueService.voidAdjustment(AREA_ADMIN, adjustment.id, { reason: 'typo' });

      expect(result.due).toEqual({ total_billed: 500, total_paid: 200, due_amount: 300 });
      expect(db.get('due_adjustments', adjustment.id)).toMatchObject({
        voided: true, void_reason: 'typo', voided_by: { admin_id: 'admin-1', username: 'ravi' },
      });
      expect(mockNotify.sendDueAdjustedNotification).toHaveBeenLastCalledWith('user-1', 'area-1', expect.objectContaining({
        voided: true, newDue: 300,
      }));
    });

    test('cannot be done twice', async () => {
      const db = mockFirebase.db.reset(seed());
      const { adjustment } = await dueService.recordAdjustment(AREA_ADMIN, ASHA, { type: 'charge', amount: 40 });
      await dueService.voidAdjustment(AREA_ADMIN, adjustment.id);

      await expect(dueService.voidAdjustment(AREA_ADMIN, adjustment.id)).rejects.toMatchObject({ statusCode: 400 });
      expect(db.get('due_amounts', 'user-1').due_amount).toBe(300);
    });

    test("an admin of another area cannot reverse it (and cannot tell it exists)", async () => {
      const db = mockFirebase.db.reset(seed());
      const { adjustment } = await dueService.recordAdjustment(AREA_ADMIN, ASHA, { type: 'charge', amount: 40 });

      await expect(dueService.voidAdjustment(OTHER_ADMIN, adjustment.id)).rejects.toMatchObject({ statusCode: 404 });
      expect(db.get('due_amounts', 'user-1').due_amount).toBe(340);
    });
  });

  test('history lists adjustments for the customer only', async () => {
    mockFirebase.db.reset(seed());
    await dueService.recordAdjustment(AREA_ADMIN, ASHA, { type: 'charge', amount: 10 });
    await dueService.recordAdjustment(OTHER_ADMIN, { id: 'user-2', area_id: 'area-2' }, { type: 'charge', amount: 20 });

    const history = await dueService.getUserAdjustments('user-1');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ user_id: 'user-1', amount: 10, type: 'charge' });
  });
});

// ─── Profile editing ─────────────────────────────────────────────────────────

describe('editing a customer profile', () => {
  test('updates name, phone and address, normalising the phone and keeping extra address keys', async () => {
    const db = mockFirebase.db.reset(seed());
    db._col('users').get('user-1').address.geo = 'kept';

    const { user, changed } = await userAdmin.updateUserProfile(AREA_ADMIN, 'user-1', {
      name: '  Asha Devi ',
      phone: '98765 43210',
      address: { line1: '14 Mill Road', line2: 'Near temple', landmark: 'Gate 2', pincode: '243005' },
    });

    expect(changed.sort()).toEqual(['address', 'name', 'phone']);
    expect(user).toMatchObject({ name: 'Asha Devi', phone: '+919876543210', area_name: 'Bareilly' });
    expect(db.get('users', 'user-1').address).toEqual({
      line1: '14 Mill Road', line2: 'Near temple', landmark: 'Gate 2', pincode: '243005', geo: 'kept',
    });
    expect(Object.values(db.dump('audit_logs'))[0]).toMatchObject({
      action: 'user.admin_updated', actor_id: 'admin-1', target_user_id: 'user-1',
    });
  });

  test.each([
    [{ name: '   ' }, /Name is required/],
    [{ phone: '12345' }, /valid phone/],
    [{ address: { line1: '', pincode: '243001' } }, /Address line 1 is required/],
    [{ address: { line1: 'A', pincode: '2430' } }, /6 digits/],
    [{ call_in_enabled: 'yes' }, /true or false/],
    [{ deletion_requested: true }, /can only be cleared/],
    [{ name: 'Asha' }, /Nothing to update/],
    [{}, /Nothing to update/],
  ])('rejects %j', async (body, message) => {
    mockFirebase.db.reset(seed());
    await expect(userAdmin.updateUserProfile(AREA_ADMIN, 'user-1', body))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(message) });
  });

  test("an area admin cannot see or edit another area's customer", async () => {
    mockFirebase.db.reset(seed());
    await expect(userAdmin.updateUserProfile(AREA_ADMIN, 'user-2', { name: 'X' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(userAdmin.getUserDetail(AREA_ADMIN, 'user-2')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('blocking instant orders stores the reason; unblocking clears it', async () => {
    const db = mockFirebase.db.reset(seed());

    await userAdmin.updateUserProfile(AREA_ADMIN, 'user-1', { instant_orders_blocked: true, instant_block_reason: 'Unpaid cash orders' });
    expect(db.get('users', 'user-1')).toMatchObject({ instant_orders_blocked: true, instant_block_reason: 'Unpaid cash orders' });

    await userAdmin.updateUserProfile(AREA_ADMIN, 'user-1', { instant_orders_blocked: false });
    expect(db.get('users', 'user-1')).toMatchObject({ instant_orders_blocked: false, instant_block_reason: null });
  });

  test('clears a deletion request', async () => {
    const db = mockFirebase.db.reset(seed());
    Object.assign(db._col('users').get('user-1'), { deletion_requested: true, deletion_requested_at: 'then' });

    await userAdmin.updateUserProfile(AREA_ADMIN, 'user-1', { deletion_requested: false });

    expect(db.get('users', 'user-1')).toMatchObject({ deletion_requested: false, deletion_requested_at: null });
  });

  describe('moving to another area', () => {
    test('is for super admins only', async () => {
      mockFirebase.db.reset(seed());
      await expect(userAdmin.updateUserProfile(AREA_ADMIN, 'user-1', { area_id: 'area-2' })).rejects.toMatchObject({ statusCode: 403 });
    });

    test('is refused while the customer still has a live subscription', async () => {
      const db = mockFirebase.db.reset(seed({ subscriptions: liveSubscription() }));
      await expect(userAdmin.updateUserProfile(SUPER_ADMIN, 'user-1', { area_id: 'area-2' }))
        .rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/cancel their subscription/) });
      expect(db.get('users', 'user-1').area_id).toBe('area-1');
    });

    test('refuses an inactive area', async () => {
      mockFirebase.db.reset(seed());
      await expect(userAdmin.updateUserProfile(SUPER_ADMIN, 'user-1', { area_id: 'area-off' })).rejects.toMatchObject({ statusCode: 400 });
    });

    test('moves the customer and their balance', async () => {
      const db = mockFirebase.db.reset(seed({ subscriptions: liveSubscription({ status: 'cancelled' }) }));

      const { user } = await userAdmin.updateUserProfile(SUPER_ADMIN, 'user-1', { area_id: 'area-2' });

      expect(user).toMatchObject({ area_id: 'area-2', area_name: 'Satellite' });
      expect(db.get('due_amounts', 'user-1').area_id).toBe('area-2');
    });
  });

  test('detail gathers profile, balance, ledger, subscriptions and orders', async () => {
    mockFirebase.db.reset(seed({
      subscriptions: liveSubscription(),
      payments: { 'pay-1': { user_id: 'user-1', amount: 200, method: 'cash', payment_date: '2026-05-10' } },
      instant_orders: { 'io-1': { user_id: 'user-1', status: 'delivered', total_amount: 120, items: [] } },
      orders: { 'o-1': { user_id: 'user-1', date: '2026-05-20', status: 'delivered', total_amount: 60 } },
    }));

    const detail = await userAdmin.getUserDetail(AREA_ADMIN, 'user-1');

    expect(detail.user).toMatchObject({ id: 'user-1', name: 'Asha', area_name: 'Bareilly', call_in_enabled: true, instant_orders_blocked: false });
    expect(detail.due).toEqual({ total_billed: 500, total_paid: 200, due_amount: 300 });
    expect(detail.payments).toHaveLength(1);
    expect(detail.subscriptions[0]).toMatchObject({ id: 'sub-1', status: 'active', daily_value: 60 });
    expect(detail.instant_summary).toMatchObject({ total: 1, delivered: 1, delivered_value: 120, added_to_due: 0 });
    expect(detail.orders).toHaveLength(1);
    expect(detail.can_change_area).toBe(false);
    expect(detail.areas).toBeNull();
  });
});

// ─── Subscription rate and milk type ─────────────────────────────────────────

describe('subscription rate and milk type', () => {
  test('sets a custom rate for the customer and notifies them', async () => {
    const db = mockFirebase.db.reset(seed({ subscriptions: liveSubscription() }));

    const { subscription } = await adminOrders.updateSubscription(AREA_ADMIN, 'user-1', 'sub-1', { action: 'price', price_per_litre: 55.5 });

    expect(db.get('subscriptions', 'sub-1')).toMatchObject({ price_per_litre: 55.5, price_overridden: true });
    expect(subscription).toMatchObject({ price_per_litre: 55.5, price_overridden: true, daily_value: 55.5 });
    expect(mockNotify.sendSubscriptionUpdatedNotification).toHaveBeenCalledWith('user-1', 'area-1', expect.objectContaining({
      action: 'price_updated',
      changeDescription: expect.stringContaining('Rs. 60/L to Rs. 55.5/L'),
    }));
  });

  test('refuses a rate change after the cutoff', async () => {
    const db = mockFirebase.db.reset(seed({ subscriptions: liveSubscription() }));
    mockIsPastCutoff.mockResolvedValue(true);

    await expect(adminOrders.updateSubscription(AREA_ADMIN, 'user-1', 'sub-1', { action: 'price', price_per_litre: 50 }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(db.get('subscriptions', 'sub-1').price_per_litre).toBe(60);
  });

  test.each([0, -1, 'abc', 20000])('refuses rate %p', async (price) => {
    mockFirebase.db.reset(seed({ subscriptions: liveSubscription() }));
    await expect(adminOrders.updateSubscription(AREA_ADMIN, 'user-1', 'sub-1', { action: 'price', price_per_litre: price }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('switching milk type moves the customer onto that type’s list price', async () => {
    const db = mockFirebase.db.reset(seed({ subscriptions: liveSubscription({ price_per_litre: 50, price_overridden: true }) }));

    await adminOrders.updateSubscription(AREA_ADMIN, 'user-1', 'sub-1', { action: 'milk_type', milk_type: 'buffalo' });

    expect(db.get('subscriptions', 'sub-1')).toMatchObject({ milk_type: 'buffalo', price_per_litre: 70, price_overridden: false });
  });

  test('refuses changes to a cancelled subscription', async () => {
    mockFirebase.db.reset(seed({ subscriptions: liveSubscription({ status: 'cancelled' }) }));
    await expect(adminOrders.updateSubscription(AREA_ADMIN, 'user-1', 'sub-1', { action: 'price', price_per_litre: 50 }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

// ─── Instant-order block ─────────────────────────────────────────────────────

describe('per-customer instant-order block', () => {
  function instantSeed(userPatch = {}) {
    const data = seed({
      products: { 'prod-1': { name: 'Paneer', is_active: true, availability: 'instant', price: 100, unit: 'pack' } },
      instant_carts: {
        'user-1': {
          user_id: 'user-1',
          area_id: 'area-1',
          items: [{ product_id: 'prod-1', product_name: 'Paneer', quantity: 1, unit: 'pack', price: 100, total: 100 }],
          delivery_charge: 0,
        },
      },
    });
    Object.assign(data.users['user-1'], userPatch);
    return data;
  }

  test('a blocked customer cannot place an instant order and keeps their cart', async () => {
    const db = mockFirebase.db.reset(instantSeed({ instant_orders_blocked: true, instant_block_reason: 'internal' }));

    const attempt = instantService.confirmOrder('user-1', 'area-1');
    await expect(attempt).rejects.toMatchObject({ statusCode: 403, code: 'INSTANT_BLOCKED' });
    await expect(instantService.confirmOrder('user-1', 'area-1')).rejects.toThrow(/not available on your account/);

    expect(Object.keys(db.dump('instant_orders'))).toHaveLength(0);
    expect(db.get('instant_carts', 'user-1').items).toHaveLength(1);
  });

  test('an unblocked customer orders as before', async () => {
    const db = mockFirebase.db.reset(instantSeed({ instant_orders_blocked: false }));
    const order = await instantService.confirmOrder('user-1', 'area-1');
    expect(order.status).toBe('pending');
    expect(Object.keys(db.dump('instant_orders'))).toEqual([order.id]);
  });
});
