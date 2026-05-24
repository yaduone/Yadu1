const query = {
  where: jest.fn(),
  get: jest.fn(),
};
query.where.mockReturnValue(query);

const batch = {
  update: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};

const mockDb = {
  collection: jest.fn(() => query),
  batch: jest.fn(() => batch),
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

jest.mock('../src/utils/date', () => ({
  today: jest.fn(() => '2026-05-24'),
}));

jest.mock('../src/modules/dues/due.service', () => ({}));
jest.mock('../src/modules/notifications/notification.service', () => ({}));

const { markPastPendingOrdersNotDelivered } = require('../src/modules/orders/order.service');

describe('missed delivery finalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.where.mockReturnValue(query);
    batch.commit.mockResolvedValue(undefined);
  });

  test('marks only older pending orders as not delivered for a user', async () => {
    const missedRef = { id: 'missed' };
    query.get.mockResolvedValue({
      docs: [
        { ref: missedRef, data: () => ({ status: 'pending', date: '2026-05-23' }) },
        { ref: { id: 'today' }, data: () => ({ status: 'pending', date: '2026-05-24' }) },
        { ref: { id: 'done' }, data: () => ({ status: 'delivered', date: '2026-05-22' }) },
      ],
    });

    const updated = await markPastPendingOrdersNotDelivered({ userId: 'user-1' });

    expect(query.where).toHaveBeenCalledWith('user_id', '==', 'user-1');
    expect(updated).toBe(1);
    expect(batch.update).toHaveBeenCalledWith(missedRef, expect.objectContaining({
      status: 'not_delivered',
      non_delivery_reason: 'not_marked_delivered',
    }));
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  test('queries pending orders for the scheduled global sweep', async () => {
    query.get.mockResolvedValue({ docs: [] });

    await markPastPendingOrdersNotDelivered();

    expect(query.where).toHaveBeenCalledWith('status', '==', 'pending');
    expect(mockDb.batch).not.toHaveBeenCalled();
  });
});
