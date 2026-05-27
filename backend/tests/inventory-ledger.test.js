const express = require('express');
const request = require('supertest');

const store = {};
let nextId = 1;

function mockTimestamp() {
  return { toDate: () => new Date('2026-05-27T10:00:00.000Z') };
}

function mockCollection(name) {
  if (!store[name]) store[name] = new Map();

  function doc(id) {
    return {
      id,
      async get() {
        const value = store[name].get(id);
        return { id, exists: Boolean(value), data: () => value };
      },
      async update(update) {
        store[name].set(id, { ...store[name].get(id), ...update });
      },
      async delete() {
        store[name].delete(id);
      },
    };
  }

  return {
    async add(value) {
      const id = `${name}-${nextId++}`;
      store[name].set(id, value);
      return doc(id);
    },
    doc,
    where(field, operator, value) {
      if (operator !== '==') throw new Error('Unsupported test query');
      return {
        async get() {
          const docs = [...store[name].entries()]
            .filter(([, data]) => data[field] === value)
            .map(([id]) => doc(id).get());
          return { docs: await Promise.all(docs) };
        },
      };
    },
  };
}

jest.mock('../src/config/firebase', () => ({
  db: { collection: mockCollection },
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: jest.fn(() => mockTimestamp()),
      },
    },
  },
}));

jest.mock('../src/middleware/auth', () => ({
  authenticateAdmin: (req, _res, next) => {
    req.admin = { adminId: req.headers['x-admin-id'] || 'admin-1' };
    next();
  },
}));

const inventoryRoutes = require('../src/modules/inventory/inventory.routes');

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/inventory', inventoryRoutes);
  return server;
}

describe('admin stock ledger', () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    nextId = 1;
    jest.clearAllMocks();
  });

  async function createMasterRecords() {
    const productRes = await request(app()).post('/api/inventory/products').send({
      name: 'Paneer',
      unit: 'kg',
      sku: 'PAN-01',
    });
    const vendorRes = await request(app()).post('/api/inventory/vendors').send({
      name: 'Local Dairy Wholesale',
      phone: '9876543210',
    });
    return {
      productId: productRes.body.data.product.id,
      vendorId: vendorRes.body.data.vendor.id,
    };
  }

  test('records purchases with snapshots and returns product history totals', async () => {
    const { productId, vendorId } = await createMasterRecords();

    const purchase = await request(app()).post('/api/inventory/purchases').send({
      product_id: productId,
      vendor_id: vendorId,
      quantity: 8,
      amount_paid: 2400,
      purchased_on: '2026-05-27',
    });

    expect(purchase.status).toBe(201);
    expect(purchase.body.data.purchase).toEqual(expect.objectContaining({
      product_name: 'Paneer',
      vendor_name: 'Local Dairy Wholesale',
      product_unit: 'kg',
      quantity: 8,
      amount_paid: 2400,
    }));

    const history = await request(app()).get(`/api/inventory/products/${productId}/history`);
    expect(history.status).toBe(200);
    expect(history.body.data.summary).toEqual({
      purchase_count: 1,
      total_quantity: 8,
      total_amount_paid: 2400,
    });

    const dashboard = await request(app()).get('/api/inventory/dashboard');
    expect(dashboard.body.data.totals).toEqual({
      products: 1,
      vendors: 1,
      purchases: 1,
      quantity: 8,
      amount_paid: 2400,
    });
  });

  test('keeps inventory entries scoped to the signed-in admin', async () => {
    await createMasterRecords();

    const otherAdmin = await request(app())
      .get('/api/inventory/products')
      .set('x-admin-id', 'admin-2');

    expect(otherAdmin.status).toBe(200);
    expect(otherAdmin.body.data.products).toEqual([]);
  });

  test('rejects incomplete or invalid purchase values', async () => {
    const { productId, vendorId } = await createMasterRecords();

    const blankAmount = await request(app()).post('/api/inventory/purchases').send({
      product_id: productId,
      vendor_id: vendorId,
      quantity: 2,
      amount_paid: '',
      purchased_on: '2026-05-27',
    });
    const invalidDate = await request(app()).post('/api/inventory/purchases').send({
      product_id: productId,
      vendor_id: vendorId,
      quantity: 2,
      amount_paid: 100,
      purchased_on: '2026-02-31',
    });

    expect(blankAmount.status).toBe(400);
    expect(blankAmount.body.error).toMatch(/amount paid/i);
    expect(invalidDate.status).toBe(400);
    expect(invalidDate.body.error).toMatch(/valid date/i);
  });

  test('protects referenced products and retains inventory audit entries', async () => {
    const { productId, vendorId } = await createMasterRecords();
    await request(app()).post('/api/inventory/purchases').send({
      product_id: productId,
      vendor_id: vendorId,
      quantity: 4,
      amount_paid: 900,
      purchased_on: '2026-05-26',
    });

    const removeProduct = await request(app()).delete(`/api/inventory/products/${productId}`);
    expect(removeProduct.status).toBe(400);
    expect(removeProduct.body.error).toMatch(/purchase history/i);

    const logs = await request(app()).get('/api/inventory/logs');
    expect(logs.body.data.logs.map((log) => log.type)).toEqual(expect.arrayContaining([
      'product_created',
      'vendor_created',
      'purchase_created',
    ]));
  });
});
