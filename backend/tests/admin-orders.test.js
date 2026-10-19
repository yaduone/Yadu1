/**
 * Admin "order for customer" flow: products into the customer's next open
 * delivery, subscription changes made on their behalf, one-day milk changes —
 * and the guarantees around them (area scope, cutoff roll-over, finalized
 * deliveries, replayed requests, customer notifications).
 */

const { createFirebaseMock } = require('./helpers/fakeFirestore');

const TARGET = '2026-05-26';
const DAY_AFTER = '2026-05-27';

const mockFirebase = createFirebaseMock();
const mockGetCartTargetDate = jest.fn();
const mockIsPastCutoff = jest.fn();
const mockNotify = {
  sendSubscriptionUpdatedNotification: jest.fn().mockResolvedValue(undefined),
  sendCartUpdatedNotification: jest.fn().mockResolvedValue(undefined),
  sendNextDeliveryChangedNotification: jest.fn().mockResolvedValue(undefined),
  sendDeliveryNotification: jest.fn().mockResolvedValue(undefined),
  sendOrderCancelledNotification: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../src/config/firebase', () => ({
  get db() {
    return mockFirebase.db;
  },
  get admin() {
    return mockFirebase.admin;
  },
}));

jest.mock('../src/modules/settings/manifestSettings.service', () => ({
  getCartTargetDate: (...args) => mockGetCartTargetDate(...args),
  isPastCutoff: (...args) => mockIsPastCutoff(...args),
  getAreaManifestSettings: async (areaId) => ({ area_id: areaId, cutoff_time: '21:00', generation_time: '23:00', timezone: 'Asia/Kolkata' }),
  cartTargetDateFromSettings: () => mockGetCartTargetDate.__current,
  isAtOrPast: () => false,
}));

jest.mock('../src/modules/notifications/notification.service', () => mockNotify);

jest.mock('../src/utils/activityLog', () => ({ logActivity: jest.fn().mockResolvedValue(undefined) }));

const adminOrders = require('../src/modules/adminOrders/adminOrder.service');
const cartService = require('../src/modules/cart/cart.service');

const AREA_ADMIN = { adminId: 'admin-1', areaId: 'area-1', role: 'area_admin', username: 'ravi' };

function seed(extra = {}) {
  return {
    users: {
      'user-1': { name: 'Asha', phone: '9000000001', area_id: 'area-1', address: { line1: '12 Mill Road' } },
      'user-other-area': { name: 'Bina', phone: '9000000002', area_id: 'area-2', address: { line1: 'X' } },
      'user-incomplete': { phone: '9000000003', area_id: 'area-1' },
    },
    products: {
      paneer: { name: 'Paneer', unit: '200g', price: 90, is_active: true, availability: 'scheduled' },
      curd: { name: 'Curd', unit: '500g', price: 40, is_active: true },
      ghee: { name: 'Ghee', unit: '1L', price: 600, is_active: false },
      icecream: { name: 'Ice cream', unit: '1 cup', price: 30, is_active: true, availability: 'instant' },
    },
    price_config: {
      'price-cow': { milk_type: 'cow', is_active: true, price_per_litre: 60 },
    },
    ...extra,
  };
}

function setTargetDate(date) {
  mockGetCartTargetDate.mockResolvedValue(date);
  mockGetCartTargetDate.__current = date;
}

function cartsFor(userId) {
  return Object.values(mockFirebase.db.dump('carts')).filter((c) => c.user_id === userId);
}

beforeEach(() => {
  mockFirebase.db.reset(seed());
  setTargetDate(TARGET);
  mockIsPastCutoff.mockResolvedValue(false);
  Object.values(mockNotify).forEach((fn) => fn.mockClear());
});

describe('adding products for a customer', () => {
  test('creates the cart for the next open date, flags admin lines and notifies the customer', async () => {
    const result = await adminOrders.addProducts(AREA_ADMIN, 'user-1', {
      items: [{ product_id: 'paneer', quantity: 2 }, { product_id: 'curd', quantity: 1 }],
      expected_date: TARGET,
      note: 'As discussed on call',
    });

    const carts = cartsFor('user-1');
    expect(carts).toHaveLength(1);
    expect(carts[0].date).toBe(TARGET);
    expect(carts[0].items).toEqual([
      expect.objectContaining({ product_id: 'paneer', quantity: 2, total: 180, added_by_admin: true }),
      expect.objectContaining({ product_id: 'curd', quantity: 1, total: 40, added_by_admin: true }),
    ]);

    expect(result.next_delivery.extra_items).toHaveLength(2);
    expect(mockNotify.sendCartUpdatedNotification).toHaveBeenCalledTimes(1);
    const [userId, areaId, payload] = mockNotify.sendCartUpdatedNotification.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(areaId).toBe('area-1');
    expect(payload).toEqual(expect.objectContaining({ date: TARGET, cartTotal: 220, note: 'As discussed on call' }));
    expect(payload.changes.added).toHaveLength(2);

    const audits = Object.values(mockFirebase.db.dump('audit_logs'));
    expect(audits).toEqual([expect.objectContaining({ actor_type: 'admin', actor_id: 'admin-1', action: 'cart.admin_added' })]);
  });

  test('merges into a line the customer already has and reports it as a quantity change', async () => {
    await cartService.addItem('user-1', 'area-1', { product_id: 'paneer', quantity: 1 });

    await adminOrders.addProducts(AREA_ADMIN, 'user-1', {
      items: [{ product_id: 'paneer', quantity: 2 }],
      expected_date: TARGET,
    });

    const [cart] = cartsFor('user-1');
    expect(cart.items).toEqual([expect.objectContaining({ product_id: 'paneer', quantity: 3, total: 270 })]);
    const { changes } = mockNotify.sendCartUpdatedNotification.mock.calls[0][2];
    expect(changes.added).toHaveLength(0);
    expect(changes.updated).toEqual([expect.objectContaining({ previousQuantity: 1 })]);
  });

  test('a replayed request is applied once and notified once', async () => {
    const body = { items: [{ product_id: 'paneer', quantity: 2 }], expected_date: TARGET, request_id: 'req-12345678' };
    await adminOrders.addProducts(AREA_ADMIN, 'user-1', body);
    const replay = await adminOrders.addProducts(AREA_ADMIN, 'user-1', body);

    expect(replay.duplicate).toBe(true);
    expect(cartsFor('user-1')[0].items[0].quantity).toBe(2);
    expect(mockNotify.sendCartUpdatedNotification).toHaveBeenCalledTimes(1);
  });

  test('refuses when the cutoff rolled the delivery date forward while the page was open', async () => {
    setTargetDate(DAY_AFTER);

    await expect(adminOrders.addProducts(AREA_ADMIN, 'user-1', {
      items: [{ product_id: 'paneer', quantity: 1 }],
      expected_date: TARGET,
    })).rejects.toMatchObject({ statusCode: 409, code: 'TARGET_DATE_CHANGED', details: { target_date: DAY_AFTER } });

    expect(cartsFor('user-1')).toHaveLength(0);
    expect(mockNotify.sendCartUpdatedNotification).not.toHaveBeenCalled();
  });

  test('keeps an already generated pending order in step with the cart', async () => {
    const orderId = ['delivery', 'area-1', TARGET, 'user-1'].join('_');
    mockFirebase.db.reset(seed({
      orders: {
        [orderId]: {
          user_id: 'user-1', area_id: 'area-1', date: TARGET, status: 'pending',
          milk: { milk_type: 'cow', quantity_litres: 1, price_per_litre: 60, total: 60 },
          extra_items: [], total_amount: 60,
        },
      },
    }));

    await adminOrders.addProducts(AREA_ADMIN, 'user-1', {
      items: [{ product_id: 'curd', quantity: 2 }],
      expected_date: TARGET,
    });

    const order = mockFirebase.db.get('orders', orderId);
    expect(order.extra_items).toEqual([expect.objectContaining({ product_id: 'curd', quantity: 2 })]);
    expect(order.total_amount).toBe(140);
  });

  test('never edits a delivery that is already finalized', async () => {
    const orderId = ['delivery', 'area-1', TARGET, 'user-1'].join('_');
    mockFirebase.db.reset(seed({
      orders: { [orderId]: { user_id: 'user-1', area_id: 'area-1', date: TARGET, status: 'delivered', extra_items: [], total_amount: 0 } },
    }));

    await expect(adminOrders.addProducts(AREA_ADMIN, 'user-1', {
      items: [{ product_id: 'curd', quantity: 1 }],
      expected_date: TARGET,
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(cartsFor('user-1')).toHaveLength(0);
  });

  test.each([
    ['inactive product', { product_id: 'ghee', quantity: 1 }, /inactive/],
    ['instant-only product', { product_id: 'icecream', quantity: 1 }, /instant store/],
    ['fractional quantity', { product_id: 'paneer', quantity: 1.5 }, /whole number/],
    ['quantity above the cap', { product_id: 'paneer', quantity: 51 }, /whole number/],
  ])('rejects an %s', async (_label, item, message) => {
    await expect(adminOrders.addProducts(AREA_ADMIN, 'user-1', { items: [item], expected_date: TARGET }))
      .rejects.toThrow(message);
    expect(cartsFor('user-1')).toHaveLength(0);
  });

  test('cannot reach a customer outside the admin area', async () => {
    await expect(adminOrders.addProducts(AREA_ADMIN, 'user-other-area', {
      items: [{ product_id: 'paneer', quantity: 1 }],
      expected_date: TARGET,
    })).rejects.toMatchObject({ statusCode: 404 });
  });

  test('requires a complete customer profile', async () => {
    await expect(adminOrders.addProducts(AREA_ADMIN, 'user-incomplete', {
      items: [{ product_id: 'paneer', quantity: 1 }],
      expected_date: TARGET,
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('setting a quantity to 0 removes the line and tells the customer', async () => {
    await adminOrders.addProducts(AREA_ADMIN, 'user-1', {
      items: [{ product_id: 'paneer', quantity: 2 }, { product_id: 'curd', quantity: 1 }],
      expected_date: TARGET,
    });
    mockNotify.sendCartUpdatedNotification.mockClear();

    await adminOrders.setProductQuantity(AREA_ADMIN, 'user-1', 'paneer', { quantity: 0, expected_date: TARGET });

    expect(cartsFor('user-1')[0].items.map((i) => i.product_id)).toEqual(['curd']);
    const { changes } = mockNotify.sendCartUpdatedNotification.mock.calls[0][2];
    expect(changes.removed).toEqual([expect.objectContaining({ product_id: 'paneer' })]);
  });
});

describe('subscriptions on the customer behalf', () => {
  test('starts a subscription audited as the admin, with dairy wording for the customer', async () => {
    const { subscription } = await adminOrders.createSubscription(AREA_ADMIN, 'user-1', {
      milk_type: 'cow',
      quantity_litres: 1.5,
      start_date: TARGET,
      delivery_slot: 'morning',
    });

    expect(subscription).toEqual(expect.objectContaining({ status: 'active', quantity_litres: 1.5, price_per_litre: 60 }));
    expect(subscription.created_by).toEqual(expect.objectContaining({ type: 'admin', admin_id: 'admin-1' }));

    const audit = Object.values(mockFirebase.db.dump('audit_logs')).find((a) => a.action === 'subscription.created');
    expect(audit).toEqual(expect.objectContaining({ actor_type: 'admin', actor_id: 'admin-1', target_user_id: 'user-1' }));

    const payload = mockNotify.sendSubscriptionUpdatedNotification.mock.calls[0][2];
    expect(payload.changeDescription).toMatch(/^Your dairy has set up a subscription for you/);
  });

  test('rejects a start date before the next open delivery date', async () => {
    await expect(adminOrders.createSubscription(AREA_ADMIN, 'user-1', {
      milk_type: 'cow', quantity_litres: 1, start_date: '2026-05-20', delivery_slot: 'morning',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('pauses and resumes with customer notifications', async () => {
    const { subscription } = await adminOrders.createSubscription(AREA_ADMIN, 'user-1', {
      milk_type: 'cow', quantity_litres: 1, start_date: TARGET, delivery_slot: 'morning',
    });

    const paused = await adminOrders.updateSubscription(AREA_ADMIN, 'user-1', subscription.id, { action: 'pause' });
    expect(paused.subscription.status).toBe('paused');
    expect(mockNotify.sendSubscriptionUpdatedNotification.mock.calls[1][2].changeDescription)
      .toMatch(/^Your dairy has paused/);

    const resumed = await adminOrders.updateSubscription(AREA_ADMIN, 'user-1', subscription.id, { action: 'resume' });
    expect(resumed.subscription.status).toBe('active');
  });

  test('changes the delivery slot, refusing a no-op and after the cutoff', async () => {
    const { subscription } = await adminOrders.createSubscription(AREA_ADMIN, 'user-1', {
      milk_type: 'cow', quantity_litres: 1, start_date: TARGET, delivery_slot: 'morning',
    });

    await expect(adminOrders.updateSubscription(AREA_ADMIN, 'user-1', subscription.id, { action: 'slot', delivery_slot: 'morning' }))
      .rejects.toThrow(/already/);

    const { subscription: updated } = await adminOrders.updateSubscription(AREA_ADMIN, 'user-1', subscription.id, {
      action: 'slot', delivery_slot: 'evening',
    });
    expect(updated.delivery_slot).toBe('evening');

    mockIsPastCutoff.mockResolvedValue(true);
    await expect(adminOrders.updateSubscription(AREA_ADMIN, 'user-1', subscription.id, { action: 'slot', delivery_slot: 'both' }))
      .rejects.toThrow(/closed/);
  });

  test('cannot act on another customer subscription through this customer', async () => {
    mockFirebase.db.reset(seed({
      subscriptions: {
        'sub-x': { user_id: 'someone-else', area_id: 'area-1', status: 'active', milk_type: 'cow', quantity_litres: 1, price_per_litre: 60 },
      },
    }));
    await expect(adminOrders.updateSubscription(AREA_ADMIN, 'user-1', 'sub-x', { action: 'pause' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('one-day milk changes', () => {
  beforeEach(async () => {
    await adminOrders.createSubscription(AREA_ADMIN, 'user-1', {
      milk_type: 'cow', quantity_litres: 1, start_date: TARGET, delivery_slot: 'morning',
    });
    mockNotify.sendNextDeliveryChangedNotification.mockClear();
  });

  test('skip, then restore, notifying each time', async () => {
    const skipped = await adminOrders.changeNextDelivery(AREA_ADMIN, 'user-1', { action: 'skip', expected_date: TARGET });
    expect(skipped.next_delivery.is_skipped).toBe(true);

    await expect(adminOrders.changeNextDelivery(AREA_ADMIN, 'user-1', { action: 'skip', expected_date: TARGET }))
      .rejects.toThrow(/already skipped/);

    const restored = await adminOrders.changeNextDelivery(AREA_ADMIN, 'user-1', { action: 'revert', expected_date: TARGET });
    expect(restored.next_delivery.is_skipped).toBe(false);
    expect(mockNotify.sendNextDeliveryChangedNotification).toHaveBeenCalledTimes(2);
  });

  test('changes the quantity for that day only', async () => {
    const { next_delivery: status } = await adminOrders.changeNextDelivery(AREA_ADMIN, 'user-1', {
      action: 'modify', quantity_litres: 2, expected_date: TARGET,
    });
    expect(status.effective_milk.quantity_litres).toBe(2);
    expect(status.subscription.base_quantity).toBe(1);
  });
});

describe('diffItems', () => {
  test('classifies added, updated and removed lines', () => {
    const changes = adminOrders.diffItems(
      [{ product_id: 'a', quantity: 1 }, { product_id: 'b', quantity: 2 }],
      [{ product_id: 'b', quantity: 3 }, { product_id: 'c', quantity: 1 }]
    );
    expect(changes.added.map((i) => i.product_id)).toEqual(['c']);
    expect(changes.updated).toEqual([{ item: { product_id: 'b', quantity: 3 }, previousQuantity: 2 }]);
    expect(changes.removed.map((i) => i.product_id)).toEqual(['a']);
  });
});
