const mockOrderRef = { id: 'order-1' };
const mockTransaction = {
  get: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};
const mockDoc = jest.fn(() => mockOrderRef);
const mockDb = {
  collection: jest.fn(() => ({ doc: mockDoc })),
  runTransaction: jest.fn((handler) => handler(mockTransaction)),
};

jest.mock('../src/config/firebase', () => ({
  db: mockDb,
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: jest.fn(() => 'server-time'),
      },
    },
  },
}));

const mockIncrementDueInTransaction = jest.fn();
const mockGetUserDue = jest.fn().mockResolvedValue({ due_amount: 125 });
jest.mock('../src/modules/dues/due.service', () => ({
  incrementDueInTransaction: mockIncrementDueInTransaction,
  getUserDue: mockGetUserDue,
}));

const mockSendDeliveryNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/modules/notifications/notification.service', () => ({
  sendDeliveryNotification: mockSendDeliveryNotification,
}));

const { createOrder, updateOrderStatus } = require('../src/modules/orders/order.service');

describe('delivery status billing transaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.runTransaction.mockImplementation((handler) => handler(mockTransaction));
  });

  test('uses one deterministic generated-order document under concurrent generation', async () => {
    mockTransaction.get.mockResolvedValue({ exists: false });

    const result = await createOrder({
      userId: 'user-1',
      areaId: 'area-1',
      date: '2026-05-25',
      milk: null,
      deliverySlot: 'morning',
      extraItems: [{ quantity: 2, total: 80 }],
      totalAmount: 80,
    });

    expect(mockDoc).toHaveBeenCalledWith('delivery_area-1_2026-05-25_user-1');
    expect(mockTransaction.create).toHaveBeenCalledWith(mockOrderRef, expect.objectContaining({
      extra_items: [{ quantity: 2, total: 80 }],
    }));
    expect(result.created).toBe(true);
  });

  test('marks delivery and adds the charge inside the same transaction', async () => {
    const order = {
      area_id: 'area-1',
      user_id: 'user-1',
      date: '2026-01-01',
      total_amount: 125,
      status: 'pending',
    };
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => order });

    await updateOrderStatus('order-1', 'area-1', 'delivered');

    expect(mockIncrementDueInTransaction).toHaveBeenCalledWith(mockTransaction, 'user-1', 'area-1', 125);
    expect(mockTransaction.update).toHaveBeenCalledWith(mockOrderRef, expect.objectContaining({ status: 'delivered' }));
    expect(mockSendDeliveryNotification).toHaveBeenCalledTimes(1);
  });

  test('does not bill an order already marked delivered', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({
        area_id: 'area-1',
        user_id: 'user-1',
        date: '2026-01-01',
        total_amount: 125,
        status: 'delivered',
      }),
    });

    await updateOrderStatus('order-1', 'area-1', 'delivered');

    expect(mockIncrementDueInTransaction).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
    expect(mockSendDeliveryNotification).not.toHaveBeenCalled();
  });

  test('rejects a change from delivered to cancelled without reversing billing', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({
        area_id: 'area-1',
        user_id: 'user-1',
        date: '2026-01-01',
        total_amount: 125,
        status: 'delivered',
      }),
    });

    await expect(updateOrderStatus('order-1', 'area-1', 'cancelled'))
      .rejects.toThrow('Finalized orders cannot be changed');

    expect(mockIncrementDueInTransaction).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });
});
