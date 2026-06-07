const express = require('express');
const request = require('supertest');

const mockCollection = jest.fn();
const mockUserDoc = jest.fn();
const mockAreaDoc = jest.fn();
const mockUserWhere = jest.fn();
const mockSubscriptionWhere = jest.fn();
const mockUserGet = jest.fn();
const mockAreaGet = jest.fn();
const mockUserUpdate = jest.fn();
const mockUsersQueryGet = jest.fn();
const mockSubscriptionsQueryGet = jest.fn();
const mockServerTimestamp = jest.fn(() => 'server-time');

jest.mock('../src/config/firebase', () => ({
  db: { collection: mockCollection },
  admin: {
    auth: jest.fn(),
    firestore: { FieldValue: { serverTimestamp: mockServerTimestamp } },
  },
}));

jest.mock('../src/modules/reports/report.service', () => ({
  getUserCalendar: jest.fn(),
}));

jest.mock('../src/utils/activityLog', () => ({
  logActivity: jest.fn(),
}));

jest.mock('../src/middleware/auth', () => ({
  authenticateUser: (req, _res, next) => {
    req.user = { userId: 'user-1', isProfileComplete: true };
    next();
  },
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

function doc(id, data) {
  return {
    id,
    exists: true,
    data: () => data,
  };
}

describe('user Call In preference', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCollection.mockImplementation((name) => {
      if (name === 'users') {
        return {
          doc: mockUserDoc,
          where: mockUserWhere,
        };
      }
      if (name === 'areas') {
        return { doc: mockAreaDoc };
      }
      if (name === 'subscriptions') {
        return { where: mockSubscriptionWhere };
      }
      return {};
    });

    mockUserDoc.mockReturnValue({
      get: mockUserGet,
      update: mockUserUpdate,
    });
    mockAreaDoc.mockReturnValue({ get: mockAreaGet });
    mockUserWhere.mockReturnValue({ get: mockUsersQueryGet });
    mockSubscriptionWhere.mockReturnValue({ get: mockSubscriptionsQueryGet });
    mockAreaGet.mockResolvedValue(doc('area-1', { name: 'Bareilly' }));
    mockUsersQueryGet.mockResolvedValue({ empty: true, docs: [] });
    mockSubscriptionsQueryGet.mockResolvedValue({ docs: [] });
  });

  test('defaults Call In to on when an existing profile has no stored field', async () => {
    mockUserGet.mockResolvedValue(doc('user-1', {
      name: 'Asha',
      area_id: 'area-1',
      address: { line1: '12 Main Road', pincode: '243001' },
    }));

    const response = await request(createApp()).get('/api/users/profile');

    expect(response.status).toBe(200);
    expect(response.body.data.user.call_in_enabled).toBe(true);
  });

  test('updates the Call In preference from the profile endpoint', async () => {
    mockUserGet.mockResolvedValue(doc('user-1', {
      name: 'Asha',
      area_id: 'area-1',
      address: { line1: '12 Main Road', pincode: '243001' },
      call_in_enabled: false,
    }));

    const response = await request(createApp())
      .put('/api/users/profile')
      .send({ call_in_enabled: false });

    expect(response.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith(expect.objectContaining({
      call_in_enabled: false,
    }));
    expect(response.body.data.user.call_in_enabled).toBe(false);
  });

  test('rejects non-boolean Call In values', async () => {
    const response = await request(createApp())
      .put('/api/users/profile')
      .send({ call_in_enabled: 'yes' });

    expect(response.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  test('includes defaulted Call In status in the admin users list', async () => {
    mockUsersQueryGet.mockResolvedValue({
      empty: false,
      docs: [
        doc('user-on', {
          name: 'Asha',
          phone: '+911234567890',
          area_id: 'area-1',
          address: { line1: '12 Main Road', pincode: '243001' },
        }),
        doc('user-off', {
          name: 'Dev',
          phone: '+919876543210',
          area_id: 'area-1',
          address: { line1: '45 Lake View', pincode: '243001' },
          call_in_enabled: false,
        }),
      ],
    });

    const response = await request(createApp()).get('/api/users/admin/list');

    expect(response.status).toBe(200);
    const usersById = Object.fromEntries(
      response.body.data.users.map((user) => [user.id, user]),
    );
    expect(usersById['user-on'].call_in_enabled).toBe(true);
    expect(usersById['user-off'].call_in_enabled).toBe(false);
  });
});
