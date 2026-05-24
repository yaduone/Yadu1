const express = require('express');
const request = require('supertest');

const mockUserGet = jest.fn();
const mockRecordPayment = jest.fn().mockResolvedValue({ payment_id: 'payment-1' });
const mockGetUserDue = jest.fn().mockResolvedValue({
  due_amount: 75,
  total_billed: 275,
  total_paid: 200,
});
const mockGetUserPayments = jest.fn().mockResolvedValue([]);
const mockSendPaymentRecordedNotification = jest.fn().mockResolvedValue(undefined);

jest.mock('../src/config/firebase', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ get: mockUserGet })),
    })),
  },
}));

jest.mock('../src/modules/dues/due.service', () => ({
  recordPayment: mockRecordPayment,
  getUserDue: mockGetUserDue,
  getUserPayments: mockGetUserPayments,
}));

jest.mock('../src/modules/notifications/notification.service', () => ({
  sendPaymentRecordedNotification: mockSendPaymentRecordedNotification,
  sendDueReminderNotification: jest.fn(),
}));

jest.mock('../src/middleware/auth', () => ({
  authenticateUser: (_req, _res, next) => next(),
  requireCompleteProfile: (_req, _res, next) => next(),
  authenticateAdmin: (req, _res, next) => {
    req.admin = { areaId: 'area-1', adminId: 'admin-1' };
    next();
  },
}));

const dueRoutes = require('../src/modules/dues/due.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dues', dueRoutes);
  return app;
}

describe('admin payment notification authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ area_id: 'area-1' }),
    });
    mockRecordPayment.mockResolvedValue({ payment_id: 'payment-1' });
    mockGetUserDue.mockResolvedValue({ due_amount: 75, total_billed: 275, total_paid: 200 });
  });

  test('records and announces a payment only in the authenticated admin area', async () => {
    const response = await request(createApp())
      .post('/api/dues/admin/payment')
      .send({
        user_id: 'user-1',
        area_id: 'area-from-client',
        amount: 200,
        method: 'cash',
      });

    expect(response.status).toBe(200);
    expect(mockRecordPayment).toHaveBeenCalledWith('admin-1', 'user-1', 'area-1', expect.objectContaining({
      amount: 200,
      method: 'cash',
    }));
    expect(mockSendPaymentRecordedNotification).toHaveBeenCalledWith(
      'user-1',
      'area-1',
      expect.objectContaining({ amount: 200, remainingDue: 75 }),
    );
  });

  test('rejects payment creation for a customer outside the admin area', async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ area_id: 'area-2' }),
    });

    const response = await request(createApp())
      .post('/api/dues/admin/payment')
      .send({ user_id: 'user-2', amount: 100, method: 'upi' });

    expect(response.status).toBe(404);
    expect(mockRecordPayment).not.toHaveBeenCalled();
    expect(mockSendPaymentRecordedNotification).not.toHaveBeenCalled();
  });

  test('does not inspect or remind dues for a customer outside the admin area', async () => {
    mockUserGet.mockResolvedValue({
      exists: true,
      data: () => ({ area_id: 'area-2' }),
    });

    const response = await request(createApp()).post('/api/dues/admin/ping/user-2');

    expect(response.status).toBe(404);
    expect(mockGetUserDue).not.toHaveBeenCalled();
  });
});
