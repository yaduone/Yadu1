const mockNotificationAdd = jest.fn().mockResolvedValue({ id: 'notification-1' });
const mockUserGet = jest.fn();
const mockSend = jest.fn().mockResolvedValue('message-1');

const mockDb = {
  collection: jest.fn((name) => {
    if (name === 'notifications') return { add: mockNotificationAdd };
    if (name === 'users') return { doc: () => ({ get: mockUserGet, update: jest.fn() }) };
    return {};
  }),
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
    messaging: jest.fn(() => ({ send: mockSend })),
  },
}));

const {
  sendPaymentRecordedNotification,
  sendDueReminderNotification,
} = require('../src/modules/notifications/notification.service');

describe('customer notification catalog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ fcm_token: 'token-1' }),
    });
  });

  test('payment recorded notification stores amount and sends actionable push metadata', async () => {
    await sendPaymentRecordedNotification('user-1', 'area-1', {
      amount: 250,
      method: 'upi',
      remainingDue: -50,
      paymentDate: '2026-05-25',
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockNotificationAdd).toHaveBeenCalledWith(expect.objectContaining({
      type: 'payment_recorded',
      title: 'Payment Received - Rs. 250.00',
      meta: expect.objectContaining({
        destination: 'dues',
        amount: 250,
        remaining_due: -50,
      }),
    }));
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'payment_recorded',
        destination: 'dues',
        amount: '250',
        remaining_due: '-50',
      }),
    }));
  });

  test('admin payment ping includes the outstanding amount and dues destination', async () => {
    await sendDueReminderNotification('user-1', 'area-1', {
      dueAmount: 180,
      totalBilled: 500,
      totalPaid: 320,
    });

    expect(mockNotificationAdd).toHaveBeenCalledWith(expect.objectContaining({
      type: 'due_reminder',
      body: expect.stringContaining('Rs. 180.00'),
      meta: expect.objectContaining({ destination: 'dues', due_amount: 180 }),
    }));
  });
});
