const mockGetDues = jest.fn();
const mockGetUsers = jest.fn();
const mockWhere = jest.fn();
const mockCollection = jest.fn((collectionName) => ({
  where: (...args) => {
    mockWhere(collectionName, ...args);
    return { get: collectionName === 'due_amounts' ? mockGetDues : mockGetUsers };
  },
}));

jest.mock('../src/config/firebase', () => ({
  db: { collection: mockCollection },
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: jest.fn(),
      },
    },
  },
}));

jest.mock('../src/utils/activityLog', () => ({
  logActivity: jest.fn(),
}));

const { listAreaDues } = require('../src/modules/dues/due.service');

function firestoreDoc(id, data) {
  return { id, data: () => data };
}

describe('admin dues list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('includes an area user with no due history as a zero balance', async () => {
    mockGetDues.mockResolvedValue({
      docs: [
        firestoreDoc('user-with-due', {
          user_id: 'user-with-due',
          area_id: 'area-1',
          total_billed: 120,
          total_paid: 20,
          due_amount: 100,
        }),
      ],
    });
    mockGetUsers.mockResolvedValue({
      docs: [
        firestoreDoc('user-with-due', { area_id: 'area-1' }),
        firestoreDoc('new-user', { area_id: 'area-1' }),
      ],
    });

    await expect(listAreaDues('area-1')).resolves.toEqual([
      {
        id: 'user-with-due',
        user_id: 'user-with-due',
        area_id: 'area-1',
        total_billed: 120,
        total_paid: 20,
        due_amount: 100,
      },
      {
        id: 'new-user',
        user_id: 'new-user',
        area_id: 'area-1',
        total_billed: 0,
        total_paid: 0,
        due_amount: 0,
      },
    ]);
    expect(mockWhere).toHaveBeenCalledWith('due_amounts', 'area_id', '==', 'area-1');
    expect(mockWhere).toHaveBeenCalledWith('users', 'area_id', '==', 'area-1');
  });

  test('preserves an existing due row even if its user document is unavailable', async () => {
    mockGetDues.mockResolvedValue({
      docs: [
        firestoreDoc('historic-user', {
          user_id: 'historic-user',
          area_id: 'area-1',
          total_billed: 80,
          total_paid: 0,
          due_amount: 80,
        }),
      ],
    });
    mockGetUsers.mockResolvedValue({ docs: [] });

    const dues = await listAreaDues('area-1');

    expect(dues).toHaveLength(1);
    expect(dues[0]).toEqual(expect.objectContaining({
      id: 'historic-user',
      due_amount: 80,
    }));
  });
});
