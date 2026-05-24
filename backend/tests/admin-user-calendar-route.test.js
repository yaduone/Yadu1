const express = require('express');
const request = require('supertest');

const mockGetUserCalendar = jest.fn();
const mockGetUser = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGetUser }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock('../src/config/firebase', () => ({
  db: { collection: mockCollection },
  admin: {
    auth: jest.fn(),
    firestore: { FieldValue: { serverTimestamp: jest.fn() } },
  },
}));

jest.mock('../src/modules/reports/report.service', () => ({
  getUserCalendar: mockGetUserCalendar,
}));

jest.mock('../src/utils/activityLog', () => ({
  logActivity: jest.fn(),
}));

jest.mock('../src/middleware/auth', () => ({
  authenticateUser: (_req, _res, next) => next(),
  requireCompleteProfile: (_req, _res, next) => next(),
  authenticateAdmin: (req, _res, next) => {
    req.admin = { areaId: 'area-1', adminId: 'admin-1' };
    next();
  },
}));

const userRoutes = require('../src/modules/users/user.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  return app;
}

describe('admin user delivery calendar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({
      exists: true,
      data: () => ({ area_id: 'area-1' }),
    });
    mockGetUserCalendar.mockResolvedValue({
      month: '2026-05',
      calendar: {},
      summary: { delivered: 0, pending: 0, not_delivered: 0 },
    });
  });

  test('returns a user calendar for an admin in the same area', async () => {
    const response = await request(createApp()).get('/api/users/admin/user-1/calendar?month=2026-05');

    expect(response.status).toBe(200);
    expect(mockGetUserCalendar).toHaveBeenCalledWith('user-1', '2026-05');
    expect(response.body.data.summary.not_delivered).toBe(0);
  });

  test('does not expose a user from a different area', async () => {
    mockGetUser.mockResolvedValue({
      exists: true,
      data: () => ({ area_id: 'area-2' }),
    });

    const response = await request(createApp()).get('/api/users/admin/user-2/calendar?month=2026-05');

    expect(response.status).toBe(404);
    expect(mockGetUserCalendar).not.toHaveBeenCalled();
  });

  test('rejects an invalid month query', async () => {
    const response = await request(createApp()).get('/api/users/admin/user-1/calendar?month=May');

    expect(response.status).toBe(400);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockGetUserCalendar).not.toHaveBeenCalled();
  });
});
