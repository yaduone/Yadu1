const mockOrderRef = { id: 'instant-1' };
const mockTransaction = {
  get: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};
const mockDoc = jest.fn(() => mockOrderRef);
// Docs returned by the pending-orders query the expiry job runs.
let mockPendingDocs = [];
const mockGet = jest.fn(() => Promise.resolve({ docs: mockPendingDocs }));
const mockWhere = jest.fn(() => ({ get: mockGet }));
const mockDb = {
  collection: jest.fn(() => ({ doc: mockDoc, where: mockWhere })),
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
  getUserDue: jest.fn().mockResolvedValue({ due_amount: 0 }),
}));

const mockSendInstantOrderRejectedNotification = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/modules/notifications/notification.service', () => ({
  sendCodDeliveryNotification: jest.fn().mockResolvedValue(undefined),
  sendOrderCancelledNotification: jest.fn().mockResolvedValue(undefined),
  sendInstantOrderAcknowledgedNotification: jest.fn().mockResolvedValue(undefined),
  sendInstantOrderRejectedNotification: mockSendInstantOrderRejectedNotification,
}));

const { rejectOrder, expireStaleOrders } = require('../src/modules/instant/instant.service');

const pendingOrder = {
  area_id: 'area-1',
  user_id: 'user-1',
  date: '2026-06-28',
  order_type: 'instant',
  payment_mode: 'cod',
  items: [{ product_id: 'p1', product_name: 'Curd', quantity: 2, price: 50, total: 100 }],
  total_amount: 120,
  eta_minutes: 30,
  status: 'pending',
};

describe('instant order rejection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.runTransaction.mockImplementation((handler) => handler(mockTransaction));
  });

  test('rejects a pending order with the reason and notifies the customer', async () => {
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => pendingOrder });

    const result = await rejectOrder('instant-1', 'area-1', 'Item out of stock', 'admin-9');

    expect(mockTransaction.update).toHaveBeenCalledWith(
      mockOrderRef,
      expect.objectContaining({
        status: 'rejected',
        rejection_reason: 'Item out of stock',
        rejected_by: 'admin-9',
        // Clearing the deadline stops the expiry job re-processing it.
        expires_at: null,
      }),
    );
    expect(result.status).toBe('rejected');
    expect(mockSendInstantOrderRejectedNotification).toHaveBeenCalledWith(
      'user-1',
      'area-1',
      expect.objectContaining({ reason: 'Item out of stock' }),
    );
  });

  test('requires a non-empty reason', async () => {
    await expect(rejectOrder('instant-1', 'area-1', '   ')).rejects.toThrow(/reason is required/i);
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  test('refuses to reject an already-acknowledged order', async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ ...pendingOrder, status: 'acknowledged' }),
    });

    await expect(rejectOrder('instant-1', 'area-1', 'Item out of stock'))
      .rejects.toThrow(/Only pending orders can be rejected/i);
  });

  test('blocks rejecting an order from another area', async () => {
    mockTransaction.get.mockResolvedValue({ exists: true, data: () => pendingOrder });

    await expect(rejectOrder('instant-1', 'area-2', 'Item out of stock'))
      .rejects.toThrow(/Forbidden/i);
  });
});

describe('instant order auto-expiry', () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60 * 60_000).toISOString();

  function docFor(id, data) {
    return { id, ref: { id }, data: () => data };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.runTransaction.mockImplementation((handler) => handler(mockTransaction));
  });

  test('auto-rejects only orders whose deadline has passed', async () => {
    mockPendingDocs = [
      docFor('overdue-1', { ...pendingOrder, expires_at: past }),
      docFor('still-waiting', { ...pendingOrder, expires_at: future }),
      // Auto-expiry disabled for this order (admin set 0 minutes).
      docFor('no-deadline', { ...pendingOrder, expires_at: null }),
    ];
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ ...pendingOrder, expires_at: past }),
    });

    const result = await expireStaleOrders();

    expect(result.expired).toBe(1);
    expect(mockTransaction.update).toHaveBeenCalledTimes(1);
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'rejected', rejected_by: 'auto_expiry' }),
    );
    expect(mockSendInstantOrderRejectedNotification).toHaveBeenCalledTimes(1);
  });

  test('skips an order an admin accepted between the query and the transaction', async () => {
    mockPendingDocs = [docFor('raced', { ...pendingOrder, expires_at: past })];
    // By the time the transaction reads it, the admin has accepted it.
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ ...pendingOrder, status: 'acknowledged', expires_at: past }),
    });

    const result = await expireStaleOrders();

    expect(result.expired).toBe(0);
    expect(mockTransaction.update).not.toHaveBeenCalled();
    expect(mockSendInstantOrderRejectedNotification).not.toHaveBeenCalled();
  });

  test('does nothing when no orders are pending', async () => {
    mockPendingDocs = [];

    expect(await expireStaleOrders()).toEqual({ expired: 0 });
    expect(mockTransaction.update).not.toHaveBeenCalled();
  });
});
