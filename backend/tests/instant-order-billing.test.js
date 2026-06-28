const mockOrderRef = { id: 'instant-1' };
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
      FieldValue: { serverTimestamp: jest.fn(() => 'server-time') },
      FieldPath: { documentId: jest.fn(() => '__name__') },
    },
  },
}));

const mockIncrementDueInTransaction = jest.fn();
const mockGetUserDue = jest.fn().mockResolvedValue({ due_amount: 240 });
jest.mock('../src/modules/dues/due.service', () => ({
  incrementDueInTransaction: mockIncrementDueInTransaction,
  getUserDue: mockGetUserDue,
}));

const mockSendDeliveryNotification = jest.fn().mockResolvedValue(undefined);
const mockSendOrderCancelledNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/modules/notifications/notification.service', () => ({
  sendDeliveryNotification: mockSendDeliveryNotification,
  sendOrderCancelledNotification: mockSendOrderCancelledNotification,
}));

const { updateOrderStatus } = require('../src/modules/instant/instant.service');

const baseOrder = {
  area_id: 'area-1',
  user_id: 'user-1',
  date: '2026-06-28',
  order_type: 'instant',
  items: [{ product_id: 'p1', product_name: 'Curd', quantity: 2, price: 50, total: 100 }],
  items_total: 100,
  delivery_charge: 20,
  total_amount: 120,
  status: 'pending',
};

describe('instant order delivery billing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.runTransaction.mockImplementation((handler) => handler(mockTransaction));
  });

  test('marks delivered and bills the full total (items + delivery charge)', async () => {
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => baseOrder });

    await updateOrderStatus('instant-1', 'area-1', 'delivered');

    expect(mockIncrementDueInTransaction).toHaveBeenCalledWith(mockTransaction, 'user-1', 'area-1', 120);
    expect(mockTransaction.update).toHaveBeenCalledWith(mockOrderRef, expect.objectContaining({ status: 'delivered' }));
    expect(mockSendDeliveryNotification).toHaveBeenCalledTimes(1);
  });

  test('does not double-bill an order already delivered', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseOrder, status: 'delivered' }),
    });

    await updateOrderStatus('instant-1', 'area-1', 'delivered');

    expect(mockIncrementDueInTransaction).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
    expect(mockSendDeliveryNotification).not.toHaveBeenCalled();
  });

  test('cancels a pending order without billing and notifies the customer', async () => {
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => baseOrder });

    await updateOrderStatus('instant-1', 'area-1', 'cancelled');

    expect(mockIncrementDueInTransaction).not.toHaveBeenCalled();
    expect(mockSendOrderCancelledNotification).toHaveBeenCalledWith(
      'user-1',
      'area-1',
      { date: '2026-06-28', amount: 120 },
    );
  });

  test('rejects status changes on a finalized order', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseOrder, status: 'delivered' }),
    });

    await expect(updateOrderStatus('instant-1', 'area-1', 'cancelled'))
      .rejects.toThrow('Finalized orders cannot be changed');

    expect(mockIncrementDueInTransaction).not.toHaveBeenCalled();
  });

  test('blocks updating an order from another area', async () => {
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => baseOrder });

    await expect(updateOrderStatus('instant-1', 'area-2', 'delivered'))
      .rejects.toThrow('Forbidden');

    expect(mockIncrementDueInTransaction).not.toHaveBeenCalled();
  });
});
