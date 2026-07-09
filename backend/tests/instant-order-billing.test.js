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

const mockSendCodDeliveryNotification = jest.fn().mockResolvedValue(undefined);
const mockSendOrderCancelledNotification = jest.fn().mockResolvedValue(undefined);
const mockSendInstantOrderAcknowledgedNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/modules/notifications/notification.service', () => ({
  sendCodDeliveryNotification: mockSendCodDeliveryNotification,
  sendOrderCancelledNotification: mockSendOrderCancelledNotification,
  sendInstantOrderAcknowledgedNotification: mockSendInstantOrderAcknowledgedNotification,
}));

const { updateOrderStatus, acknowledgeOrder } = require('../src/modules/instant/instant.service');

const baseOrder = {
  area_id: 'area-1',
  user_id: 'user-1',
  date: '2026-06-28',
  order_type: 'instant',
  payment_mode: 'cod',
  items: [{ product_id: 'p1', product_name: 'Curd', quantity: 2, price: 50, total: 100 }],
  items_total: 100,
  delivery_charge: 20,
  total_amount: 120,
  eta_minutes: 30,
  status: 'pending',
};

const acknowledgedOrder = { ...baseOrder, status: 'acknowledged' };

describe('instant order delivery billing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.runTransaction.mockImplementation((handler) => handler(mockTransaction));
  });

  test('acknowledges a pending order and notifies the customer with an ETA', async () => {
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => baseOrder });

    await acknowledgeOrder('instant-1', 'area-1');

    expect(mockTransaction.update).toHaveBeenCalledWith(mockOrderRef, expect.objectContaining({ status: 'acknowledged' }));
    expect(mockSendInstantOrderAcknowledgedNotification).toHaveBeenCalledTimes(1);
  });

  test('marks delivered from acknowledged without billing due (settled cash-on-delivery)', async () => {
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => acknowledgedOrder });

    await updateOrderStatus('instant-1', 'area-1', 'delivered');

    expect(mockIncrementDueInTransaction).not.toHaveBeenCalled();
    expect(mockTransaction.update).toHaveBeenCalledWith(mockOrderRef, expect.objectContaining({ status: 'delivered' }));
    expect(mockSendCodDeliveryNotification).toHaveBeenCalledTimes(1);
  });

  test('rejects marking a pending (not yet acknowledged) order delivered', async () => {
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => baseOrder });

    await expect(updateOrderStatus('instant-1', 'area-1', 'delivered'))
      .rejects.toThrow('Order must be acknowledged before it can be marked delivered');

    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  test('does not double-bill an order already delivered', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseOrder, status: 'delivered' }),
    });

    await updateOrderStatus('instant-1', 'area-1', 'delivered');

    expect(mockIncrementDueInTransaction).not.toHaveBeenCalled();
    expect(mockTransaction.update).not.toHaveBeenCalled();
    expect(mockSendCodDeliveryNotification).not.toHaveBeenCalled();
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
