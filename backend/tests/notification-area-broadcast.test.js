const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockCommit = jest.fn().mockResolvedValue(undefined);
const mockBatch = jest.fn(() => ({ set: mockSet, update: mockUpdate, commit: mockCommit }));
const mockNotificationDoc = jest.fn(() => ({ id: 'notification-ref' }));
const mockUsersGet = jest.fn();
const mockSendEachForMulticast = jest.fn();

const mockDb = {
  collection: jest.fn((name) => {
    if (name === 'users') {
      return {
        where: () => ({ get: mockUsersGet }),
        doc: jest.fn((id) => ({ id })),
      };
    }
    if (name === 'notifications') return { doc: mockNotificationDoc };
    return {};
  }),
  batch: mockBatch,
};

jest.mock('../src/config/firebase', () => ({
  db: mockDb,
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: jest.fn(() => 'server-time'),
        delete: jest.fn(() => 'delete-field'),
      },
      Timestamp: {
        fromDate: jest.fn((date) => date),
      },
    },
    messaging: jest.fn(() => ({ sendEachForMulticast: mockSendEachForMulticast })),
  },
}));

const { sendAreaBroadcast } = require('../src/modules/notifications/notification.service');

describe('area notification delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCommit.mockResolvedValue(undefined);
    mockUsersGet.mockResolvedValue({
      empty: false,
      docs: [
        { id: 'user-1', data: () => ({ fcm_token: 'token-1' }) },
        { id: 'user-2', data: () => ({}) },
      ],
    });
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      responses: [{ success: true }],
    });
  });

  test('creates a private inbox item for each user and pushes registered devices', async () => {
    const result = await sendAreaBroadcast('area-1', {
      type: 'livestream_reminder',
      title: 'Morning Live Stream in 30 Minutes',
      body: 'Morning slot live stream starts soon.',
      meta: { livestream_id: 'stream-1', slot: 'morning' },
    });

    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet.mock.calls[0][1]).toEqual(expect.objectContaining({
      user_id: 'user-1',
      type: 'livestream_reminder',
      is_read: false,
    }));
    expect(mockSet.mock.calls[1][1]).toEqual(expect.objectContaining({ user_id: 'user-2' }));
    expect(mockSendEachForMulticast).toHaveBeenCalledWith(expect.objectContaining({
      tokens: ['token-1'],
      data: expect.objectContaining({ type: 'livestream_reminder', livestream_id: 'stream-1' }),
    }));
    expect(result).toEqual({ recipients: 2, pushed: 1 });
  });
});
