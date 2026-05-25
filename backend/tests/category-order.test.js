const express = require('express');
const request = require('supertest');

const mockCategoryGet = jest.fn();
const mockLimitGet = jest.fn();
const mockDocRef = jest.fn((id) => ({ id }));
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockCollection = jest.fn(() => ({
  get: mockCategoryGet,
  limit: jest.fn(() => ({ get: mockLimitGet })),
  doc: mockDocRef,
}));

jest.mock('../src/config/firebase', () => ({
  db: {
    collection: mockCollection,
    batch: jest.fn(() => ({
      update: mockBatchUpdate,
      set: jest.fn(),
      commit: mockBatchCommit,
    })),
  },
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: jest.fn(() => 'server-time'),
      },
    },
  },
}));

jest.mock('../src/middleware/auth', () => ({
  authenticateAdmin: (req, _res, next) => {
    req.admin = { adminId: 'admin-1' };
    next();
  },
}));

jest.mock('../src/middleware/cache', () => ({
  cache: {
    publicStatic: (_req, _res, next) => next(),
  },
  invalidateOn: () => (_req, _res, next) => next(),
}));

jest.mock('../src/utils/storage', () => ({
  uploadImages: jest.fn(),
  deleteImages: jest.fn(),
}));

const categoryRoutes = require('../src/modules/categories/category.routes');

function categoryDoc(id, data) {
  return { id, data: () => data };
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/categories', categoryRoutes);
  return app;
}

describe('category app ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLimitGet.mockResolvedValue({ empty: false });
    mockBatchCommit.mockResolvedValue(undefined);
  });

  test('normalizes legacy categories into the public display order', async () => {
    mockCategoryGet.mockResolvedValue({
      docs: [
        categoryDoc('paneer', { slug: 'paneer', label: 'Paneer' }),
        categoryDoc('curd', { slug: 'curd', label: 'Curd' }),
      ],
    });

    const response = await request(createApp()).get('/api/categories');

    expect(response.status).toBe(200);
    expect(response.body.data.categories).toEqual([
      expect.objectContaining({ id: 'curd', priority: 1 }),
      expect.objectContaining({ id: 'paneer', priority: 2 }),
    ]);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  test('persists an admin-selected order for the user app', async () => {
    mockCategoryGet.mockResolvedValue({
      docs: [
        categoryDoc('curd', { slug: 'curd', label: 'Curd', priority: 1 }),
        categoryDoc('paneer', { slug: 'paneer', label: 'Paneer', priority: 2 }),
      ],
    });

    const response = await request(createApp())
      .put('/api/categories/order')
      .send({ category_ids: ['paneer', 'curd'] });

    expect(response.status).toBe(200);
    expect(response.body.data.categories.map((category) => category.id)).toEqual(['paneer', 'curd']);
    expect(mockBatchUpdate).toHaveBeenNthCalledWith(1, { id: 'paneer' }, expect.objectContaining({ priority: 1 }));
    expect(mockBatchUpdate).toHaveBeenNthCalledWith(2, { id: 'curd' }, expect.objectContaining({ priority: 2 }));
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });
});
