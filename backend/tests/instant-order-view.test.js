const mockOrderDoc = { exists: true, id: 'instant-1', data: jest.fn() };
const mockDoc = jest.fn(() => ({ get: jest.fn(() => Promise.resolve(mockOrderDoc)) }));
// Docs returned by the user-history query.
let mockUserDocs = [];
const mockWhere = jest.fn(() => ({
  get: jest.fn(() => Promise.resolve({ docs: mockUserDocs })),
}));
const mockDb = {
  collection: jest.fn(() => ({ doc: mockDoc, where: mockWhere })),
  runTransaction: jest.fn(),
};

jest.mock('../src/config/firebase', () => ({
  db: mockDb,
  admin: {
    firestore: {
      FieldValue: { serverTimestamp: jest.fn(() => ({ _methodName: 'serverTimestamp' })) },
      FieldPath: { documentId: jest.fn(() => '__name__') },
    },
  },
}));

jest.mock('../src/modules/dues/due.service', () => ({
  incrementDueInTransaction: jest.fn(),
  getUserDue: jest.fn(),
}));
jest.mock('../src/modules/notifications/notification.service', () => ({
  sendCodDeliveryNotification: jest.fn(),
  sendOrderCancelledNotification: jest.fn(),
  sendInstantOrderAcknowledgedNotification: jest.fn(),
  sendInstantOrderRejectedNotification: jest.fn(),
}));

const { getUserOrder, getUserOrders } = require('../src/modules/instant/instant.service');

/** Stand-in for a committed Firestore Timestamp. */
function timestamp(iso) {
  return { toDate: () => new Date(iso) };
}

const baseOrder = {
  user_id: 'user-1',
  area_id: 'area-1',
  status: 'acknowledged',
  date: '2026-06-28',
  items: [],
  total_amount: 120,
  eta_minutes: 30,
};

describe('instant order client serialization', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders committed timestamps as strings, not raw Timestamp objects', async () => {
    mockOrderDoc.data.mockReturnValue({
      ...baseOrder,
      placed_at: timestamp('2026-06-28T10:00:00Z'),
      acknowledged_at: timestamp('2026-06-28T10:02:00Z'),
      expected_delivery_by: new Date(Date.now() + 20 * 60_000).toISOString(),
    });

    const order = await getUserOrder('instant-1', 'user-1');

    expect(typeof order.placed_at).toBe('string');
    expect(typeof order.acknowledged_at).toBe('string');
    expect(order.id).toBe('instant-1');
  });

  test('treats uncommitted write sentinels as unset rather than emitting {}', async () => {
    // A serverTimestamp() sentinel has no toDate() and serializes to `{}` — the
    // client must receive null instead of an unusable empty object.
    mockOrderDoc.data.mockReturnValue({
      ...baseOrder,
      status: 'pending',
      placed_at: { _methodName: 'serverTimestamp' },
      acknowledged_at: null,
    });

    const order = await getUserOrder('instant-1', 'user-1');

    expect(order.placed_at).toBeNull();
    expect(order.acknowledged_at).toBeNull();
    expect(JSON.stringify(order)).not.toContain('_methodName');
  });

  test('flags an acknowledged order past its promised ETA as overdue', async () => {
    mockOrderDoc.data.mockReturnValue({
      ...baseOrder,
      expected_delivery_by: new Date(Date.now() - 60_000).toISOString(),
    });

    expect((await getUserOrder('instant-1', 'user-1')).is_overdue).toBe(true);
  });

  test('does not flag a pending order as overdue even with a past deadline', async () => {
    mockOrderDoc.data.mockReturnValue({
      ...baseOrder,
      status: 'pending',
      expected_delivery_by: new Date(Date.now() - 60_000).toISOString(),
    });

    expect((await getUserOrder('instant-1', 'user-1')).is_overdue).toBe(false);
  });

  test("refuses to return another user's order", async () => {
    mockOrderDoc.data.mockReturnValue(baseOrder);

    await expect(getUserOrder('instant-1', 'intruder')).rejects.toThrow(/Forbidden/i);
  });
});

describe('instant order history', () => {
  function doc(id, data) {
    return { id, data: () => data };
  }

  beforeEach(() => jest.clearAllMocks());

  test('includes delivered orders — they must appear in the delivery log', async () => {
    mockUserDocs = [
      doc('o-delivered', {
        ...baseOrder,
        status: 'delivered',
        placed_at: { toDate: () => new Date('2026-06-28T09:00:00Z') },
      }),
      doc('o-pending', { ...baseOrder, status: 'pending' }),
    ];

    const { orders, total } = await getUserOrders('user-1', { limit: 20 });

    expect(total).toBe(2);
    expect(orders.map((o) => o.status)).toContain('delivered');
    expect(orders.find((o) => o.id === 'o-delivered').placed_at).toEqual(expect.any(String));
  });

  test('keeps newest-first ordering within a single day', async () => {
    // Regression guard: serializing before sorting would call .toMillis() on a
    // string, collapsing every comparison to 0 and scrambling same-day orders.
    mockUserDocs = [
      doc('older', {
        ...baseOrder,
        date: '2026-06-28',
        placed_at: { toDate: () => new Date('2026-06-28T08:00:00Z'), toMillis: () => 1000 },
      }),
      doc('newer', {
        ...baseOrder,
        date: '2026-06-28',
        placed_at: { toDate: () => new Date('2026-06-28T18:00:00Z'), toMillis: () => 9000 },
      }),
    ];

    const { orders } = await getUserOrders('user-1', { limit: 20 });

    expect(orders.map((o) => o.id)).toEqual(['newer', 'older']);
  });
});
