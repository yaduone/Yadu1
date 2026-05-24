const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockSubscriptionGet = jest.fn();
const mockOverrideGet = jest.fn();
const mockAuditAdd = jest.fn().mockResolvedValue({ id: 'audit-1' });
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockSendSubscriptionUpdatedNotification = jest.fn().mockResolvedValue(undefined);

const mockSubscriptionRef = { get: mockSubscriptionGet, update: mockUpdate };
const mockDb = {
  collection: jest.fn((name) => {
    if (name === 'subscriptions') return { doc: () => mockSubscriptionRef };
    if (name === 'audit_logs') return { add: mockAuditAdd };
    if (name === 'next_day_overrides') {
      return {
        where: () => ({
          where: () => ({
            limit: () => ({ get: mockOverrideGet }),
            get: mockOverrideGet,
          }),
        }),
      };
    }
    return {};
  }),
  batch: jest.fn(() => ({ delete: mockBatchDelete, commit: mockBatchCommit })),
};

jest.mock('../src/config/firebase', () => ({
  db: mockDb,
  admin: {
    firestore: {
      FieldValue: { serverTimestamp: jest.fn(() => 'server-time') },
    },
  },
}));

jest.mock('../src/modules/settings/manifestSettings.service', () => ({
  isPastCutoff: jest.fn().mockResolvedValue(false),
  getCartTargetDate: jest.fn().mockResolvedValue('2026-05-26'),
}));

jest.mock('../src/modules/notifications/notification.service', () => ({
  sendSubscriptionUpdatedNotification: mockSendSubscriptionUpdatedNotification,
}));

const {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
  updateQuantity,
} = require('../src/modules/subscriptions/subscription.service');

function subscription(status) {
  return {
    exists: true,
    data: () => ({ user_id: 'user-1', area_id: 'area-1', status }),
  };
}

describe('subscription lifecycle notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOverrideGet.mockResolvedValue({ empty: true, docs: [] });
    mockBatchCommit.mockResolvedValue(undefined);
  });

  test('alerts a customer when recurring deliveries are paused and resumed', async () => {
    mockSubscriptionGet.mockResolvedValueOnce(subscription('active'));
    await pauseSubscription('subscription-1', 'user-1');

    mockSubscriptionGet.mockResolvedValueOnce(subscription('paused'));
    await resumeSubscription('subscription-1', 'user-1');

    expect(mockSendSubscriptionUpdatedNotification).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'area-1',
      expect.objectContaining({ title: 'Subscription Paused', action: 'paused' }),
    );
    expect(mockSendSubscriptionUpdatedNotification).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'area-1',
      expect.objectContaining({ title: 'Subscription Resumed', action: 'resumed' }),
    );
  });

  test('alerts a customer when a subscription is cancelled or quantity changes', async () => {
    mockSubscriptionGet.mockResolvedValueOnce(subscription('active'));
    await cancelSubscription('subscription-1', 'user-1');

    mockSubscriptionGet.mockResolvedValueOnce(subscription('active'));
    await updateQuantity('subscription-1', 'user-1', 1.5);

    expect(mockSendSubscriptionUpdatedNotification).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'area-1',
      expect.objectContaining({ title: 'Subscription Cancelled', action: 'cancelled' }),
    );
    expect(mockSendSubscriptionUpdatedNotification).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'area-1',
      expect.objectContaining({ title: 'Daily Quantity Updated', action: 'quantity_updated' }),
    );
  });
});
