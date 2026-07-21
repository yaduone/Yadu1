const mockOrderRef = { id: 'instant-1' };
const mockTransaction = { get: jest.fn(), update: jest.fn() };
const mockDoc = jest.fn(() => mockOrderRef);
const mockDb = {
  collection: jest.fn(() => ({ doc: mockDoc, where: jest.fn() })),
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

jest.mock('../src/modules/dues/due.service', () => ({
  incrementDueInTransaction: jest.fn(),
  getUserDue: jest.fn(),
}));

const mockAdminCancelPush = jest.fn();
jest.mock('../src/modules/notifications/notification.service', () => ({
  sendCodDeliveryNotification: jest.fn(),
  sendOrderCancelledNotification: jest.fn(),
  sendInstantOrderAcknowledgedNotification: jest.fn(),
  sendInstantOrderRejectedNotification: jest.fn(),
  sendAdminInstantOrderCancelledNotification: mockAdminCancelPush,
}));

const mockGetHours = jest.fn();
jest.mock('../src/modules/settings/instantHours.service', () => ({
  DEFAULTS: { eta_minutes: 30 },
  getHours: mockGetHours,
  checkAvailability: jest.fn(),
}));

const { cancelOwnOrder } = require('../src/modules/instant/instant.service');

const baseOrder = {
  user_id: 'user-1',
  area_id: 'area-1',
  status: 'pending',
  date: '2026-06-28',
  items: [],
  total_amount: 120,
};

function withWindow(window) {
  mockGetHours.mockResolvedValue({ customer_cancel_window: window });
}

describe('customer cancellation of an instant order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.runTransaction.mockImplementation((handler) => handler(mockTransaction));
    withWindow('until_delivery');
  });

  test('cancels a pending order and alerts the admins', async () => {
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => baseOrder });

    const result = await cancelOwnOrder('instant-1', 'user-1');

    expect(result.status).toBe('cancelled');
    expect(mockTransaction.update).toHaveBeenCalledWith(
      mockOrderRef,
      expect.objectContaining({ status: 'cancelled', cancelled_by: 'customer', expires_at: null }),
    );
    expect(mockAdminCancelPush).toHaveBeenCalledWith(
      'area-1',
      expect.objectContaining({ orderId: 'instant-1', wasAccepted: false }),
    );
  });

  test('cancels an accepted order and flags that a rider may be en route', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseOrder, status: 'acknowledged' }),
    });

    await cancelOwnOrder('instant-1', 'user-1');

    expect(mockAdminCancelPush).toHaveBeenCalledWith(
      'area-1',
      expect.objectContaining({ wasAccepted: true }),
    );
  });

  test('refuses once the order has been delivered', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseOrder, status: 'delivered' }),
    });

    await expect(cancelOwnOrder('instant-1', 'user-1'))
      .rejects.toThrow(/already been delivered/i);
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  test('refuses an already-rejected order', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ ...baseOrder, status: 'rejected' }),
    });

    await expect(cancelOwnOrder('instant-1', 'user-1')).rejects.toThrow(/no longer active/i);
  });

  test("refuses to cancel someone else's order", async () => {
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => baseOrder });

    await expect(cancelOwnOrder('instant-1', 'intruder')).rejects.toThrow(/Forbidden/i);
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  describe('admin-configured cancel window', () => {
    test('until_acceptance blocks cancelling once accepted', async () => {
      withWindow('until_acceptance');
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({ ...baseOrder, status: 'acknowledged' }),
      });

      await expect(cancelOwnOrder('instant-1', 'user-1'))
        .rejects.toThrow(/already accepted/i);
      expect(mockTransaction.update).not.toHaveBeenCalled();
    });

    test('until_acceptance still allows cancelling while pending', async () => {
      withWindow('until_acceptance');
      mockTransaction.get.mockResolvedValue({ exists: true, data: () => baseOrder });

      expect((await cancelOwnOrder('instant-1', 'user-1')).status).toBe('cancelled');
    });

    test('disabled blocks cancellation outright, without touching the order', async () => {
      withWindow('disabled');

      await expect(cancelOwnOrder('instant-1', 'user-1'))
        .rejects.toThrow(/contact the store/i);
      expect(mockDb.runTransaction).not.toHaveBeenCalled();
    });
  });
});
