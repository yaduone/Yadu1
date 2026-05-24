jest.mock('../src/config/firebase', () => ({
  db: {},
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: jest.fn(() => 'server-time'),
      },
    },
  },
}));

jest.mock('../src/modules/dues/due.service', () => ({
  incrementDue: jest.fn(),
  getUserDue: jest.fn(),
}));

jest.mock('../src/modules/notifications/notification.service', () => ({
  sendDeliveryNotification: jest.fn(),
}));

const { orderTotal, syncPendingOrderExtras } = require('../src/modules/orders/order.service');

describe('generated order extra reconciliation', () => {
  test('computes order totals from milk and extra products', () => {
    const total = orderTotal(
      { total: 60 },
      [{ total: 40 }, { total: 25 }]
    );

    expect(total).toBe(125);
  });

  test('copies cart extras into a pending milk order and recomputes the total', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const orderDoc = {
      data: () => ({
        status: 'pending',
        milk: { total: 60 },
        extra_items: [],
        total_amount: 60,
      }),
      ref: { update },
    };
    const extras = [{ product_id: 'paneer', product_name: 'Paneer', quantity: 2, total: 160 }];

    const result = await syncPendingOrderExtras(orderDoc, extras);

    expect(result.updated).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      extra_items: extras,
      total_amount: 220,
    }));
  });

  test('does not rewrite finalized delivered orders or change their billing basis', async () => {
    const update = jest.fn();
    const orderDoc = {
      data: () => ({
        status: 'delivered',
        milk: { total: 60 },
        extra_items: [],
        total_amount: 60,
      }),
      ref: { update },
    };

    const result = await syncPendingOrderExtras(orderDoc, [{ quantity: 1, total: 80 }]);

    expect(result).toEqual({ updated: false, reason: 'finalized' });
    expect(update).not.toHaveBeenCalled();
  });
});
