const express = require('express');
const request = require('supertest');

const mockCollection = jest.fn();
const mockWhere = jest.fn();
const mockQueryGet = jest.fn();
const mockAdd = jest.fn();
const mockDoc = jest.fn();
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockDocDelete = jest.fn();
const mockServerTimestamp = jest.fn(() => 'server-time');

jest.mock('../src/config/firebase', () => ({
  db: { collection: mockCollection },
  admin: {
    firestore: { FieldValue: { serverTimestamp: mockServerTimestamp } },
  },
}));

jest.mock('../src/middleware/auth', () => ({
  authenticateAdmin: (req, _res, next) => {
    req.admin = { areaId: 'area-1', adminId: 'admin-1' };
    next();
  },
}));

const noteRoutes = require('../src/modules/notes/note.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/notes', noteRoutes);
  return app;
}

function noteDoc(id, data, exists = true) {
  return {
    id,
    exists,
    data: () => data,
  };
}

describe('admin notes', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockCollection.mockReturnValue({
      where: mockWhere,
      add: mockAdd,
      doc: mockDoc,
    });
    mockWhere.mockReturnValue({ get: mockQueryGet });
    mockDoc.mockReturnValue({
      get: mockDocGet,
      update: mockDocUpdate,
      delete: mockDocDelete,
    });
    mockQueryGet.mockResolvedValue({ docs: [] });
  });

  test('lists notes for the admin area', async () => {
    mockQueryGet.mockResolvedValue({
      docs: [
        noteDoc('old-note', {
          title: 'Old',
          body: 'Older note',
          area_id: 'area-1',
          created_at: '2026-05-30T10:00:00.000Z',
          updated_at: '2026-05-30T10:00:00.000Z',
        }),
        noteDoc('new-note', {
          title: 'New',
          body: 'Newer note',
          area_id: 'area-1',
          created_at: '2026-05-31T10:00:00.000Z',
          updated_at: '2026-05-31T10:00:00.000Z',
        }),
      ],
    });

    const response = await request(createApp()).get('/api/notes');

    expect(response.status).toBe(200);
    expect(mockWhere).toHaveBeenCalledWith('area_id', '==', 'area-1');
    expect(response.body.data.notes.map((note) => note.id)).toEqual(['new-note', 'old-note']);
  });

  test('creates a note', async () => {
    mockAdd.mockImplementation(async (data) => ({
      id: 'note-1',
      get: jest.fn(async () => noteDoc('note-1', data)),
    }));

    const response = await request(createApp())
      .post('/api/notes')
      .send({ title: ' Route plan ', body: ' Call users before dispatch. ' });

    expect(response.status).toBe(201);
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Route plan',
      body: 'Call users before dispatch.',
      area_id: 'area-1',
      created_by_admin_id: 'admin-1',
      updated_by_admin_id: 'admin-1',
    }));
    expect(response.body.data.note.id).toBe('note-1');
  });

  test('rejects blank notes', async () => {
    const response = await request(createApp())
      .post('/api/notes')
      .send({ title: ' ', body: '' });

    expect(response.status).toBe(400);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  test('updates a note in the admin area', async () => {
    mockDocGet
      .mockResolvedValueOnce(noteDoc('note-1', {
        title: 'Old',
        body: 'Old body',
        area_id: 'area-1',
      }))
      .mockResolvedValueOnce(noteDoc('note-1', {
        title: 'New',
        body: 'New body',
        area_id: 'area-1',
        updated_by_admin_id: 'admin-1',
        updated_at: 'server-time',
      }));

    const response = await request(createApp())
      .put('/api/notes/note-1')
      .send({ title: 'New', body: 'New body' });

    expect(response.status).toBe(200);
    expect(mockDocUpdate).toHaveBeenCalledWith(expect.objectContaining({
      title: 'New',
      body: 'New body',
      updated_by_admin_id: 'admin-1',
    }));
    expect(response.body.data.note.title).toBe('New');
  });

  test('does not update a note from another area', async () => {
    mockDocGet.mockResolvedValueOnce(noteDoc('note-2', {
      title: 'Other',
      body: 'Other area',
      area_id: 'area-2',
    }));

    const response = await request(createApp())
      .put('/api/notes/note-2')
      .send({ title: 'New', body: 'New body' });

    expect(response.status).toBe(404);
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  test('deletes a note in the admin area', async () => {
    mockDocGet.mockResolvedValueOnce(noteDoc('note-1', {
      title: 'Delete me',
      body: 'Temporary',
      area_id: 'area-1',
    }));

    const response = await request(createApp()).delete('/api/notes/note-1');

    expect(response.status).toBe(200);
    expect(mockDocDelete).toHaveBeenCalled();
  });
});
