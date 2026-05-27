const mockAreaGet = jest.fn();
const mockStatusGet = jest.fn();
const mockAdd = jest.fn();
const mockDocGet = jest.fn();
const mockRefUpdate = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockSendAreaBroadcast = jest.fn();

const mockStreamRef = {
  get: mockDocGet,
  update: mockRefUpdate,
};
const mockCollection = jest.fn((name) => {
  if (name !== 'livestreams') return {};
  return {
    add: mockAdd,
    doc: jest.fn(() => mockStreamRef),
    where: (field) => ({ get: field === 'status' ? mockStatusGet : mockAreaGet }),
  };
});
const mockDb = {
  collection: mockCollection,
  runTransaction: jest.fn((handler) => handler({
    get: mockTransactionGet,
    update: mockTransactionUpdate,
  })),
};

function mockTimestamp(date) {
  return { toDate: () => date };
}

jest.mock('../src/config/firebase', () => ({
  db: mockDb,
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: jest.fn(() => 'server-time'),
        delete: jest.fn(() => 'delete-field'),
      },
      Timestamp: {
        fromDate: jest.fn((date) => mockTimestamp(date)),
      },
    },
  },
}));

jest.mock('../src/config', () => ({ timezone: 'Asia/Kolkata' }));

jest.mock('../src/modules/notifications/notification.service', () => ({
  sendAreaBroadcast: mockSendAreaBroadcast,
}));

const {
  createStream,
  createScheduledStream,
  getViewerStreams,
  processScheduledStreams,
} = require('../src/modules/livestreams/livestream.service');

function streamDoc(id, data, ref = mockStreamRef) {
  return { id, data: () => data, ref };
}

describe('scheduled livestreams', () => {
  const now = new Date('2026-05-24T10:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockAreaGet.mockResolvedValue({ docs: [] });
    mockStatusGet.mockResolvedValue({ docs: [] });
    mockAdd.mockResolvedValue({ id: 'stream-1', update: mockRefUpdate });
    mockSendAreaBroadcast.mockResolvedValue({ recipients: 2, pushed: 1 });
  });

  test('creates a slot-based scheduled stream with a 30-minute reminder window', async () => {
    const stream = await createScheduledStream('area-1', 'admin-1', {
      slot: 'morning',
      youtube_url: 'https://youtube.com/live/abcdefghijk',
      scheduled_start_at: '2026-05-24T10:45:00.000Z',
      duration_minutes: 60,
    }, now);

    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      slot: 'morning',
      status: 'scheduled',
      is_active: false,
      title: 'Morning Slot Live Stream',
    }));
    const stored = mockAdd.mock.calls[0][0];
    expect(stored.reminder_at.toDate().toISOString()).toBe('2026-05-24T10:15:00.000Z');
    expect(stream.status).toBe('scheduled');
  });

  test('starts an immediate stream and publishes its viewing link right away', async () => {
    mockTransactionGet.mockResolvedValue({ data: () => ({}) });

    const stream = await createStream('area-1', 'admin-1', {
      start_mode: 'immediate',
      slot: 'morning',
      youtube_url: 'https://youtube.com/live/abcdefghijk',
      duration_minutes: 60,
    }, now);

    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
      start_mode: 'immediate',
      status: 'live',
      is_active: true,
      reminder_at: null,
    }));
    const stored = mockAdd.mock.calls[0][0];
    expect(stored.scheduled_start_at.toDate().toISOString()).toBe(now.toISOString());
    expect(mockSendAreaBroadcast).toHaveBeenCalledWith('area-1', expect.objectContaining({
      type: 'livestream_started',
      meta: expect.objectContaining({
        livestream_id: 'stream-1',
        youtube_url: 'https://youtube.com/live/abcdefghijk',
      }),
    }));
    expect(mockRefUpdate).toHaveBeenCalledWith({
      started_notification_sent_at: 'server-time',
    });
    expect(stream.status).toBe('live');
  });

  test('keeps an immediate stream live and releases its alert claim when broadcasting fails', async () => {
    const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockTransactionGet.mockResolvedValue({ data: () => ({}) });
    mockSendAreaBroadcast.mockRejectedValueOnce(new Error('Temporary push outage'));

    try {
      const stream = await createStream('area-1', 'admin-1', {
        start_mode: 'immediate',
        slot: 'evening',
        youtube_url: 'https://youtube.com/live/abcdefghijk',
        duration_minutes: 60,
      }, now);

      expect(stream.status).toBe('live');
      expect(mockRefUpdate).toHaveBeenCalledWith(expect.objectContaining({
        started_notification_sent_at_claimed_at: 'delete-field',
        started_notification_error: 'Temporary push outage',
      }));
    } finally {
      logSpy.mockRestore();
    }
  });

  test('hides a future link but releases it once its scheduled window begins', async () => {
    const data = {
      area_id: 'area-1',
      title: 'Morning Check',
      slot: 'morning',
      youtube_url: 'https://youtube.com/live/abcdefghijk',
      status: 'scheduled',
      scheduled_start_at: mockTimestamp(new Date('2026-05-24T10:45:00.000Z')),
      scheduled_end_at: mockTimestamp(new Date('2026-05-24T11:45:00.000Z')),
    };
    mockAreaGet.mockResolvedValue({ docs: [streamDoc('stream-1', data)] });

    const beforeStart = await getViewerStreams('area-1', now);
    const duringStream = await getViewerStreams('area-1', new Date('2026-05-24T11:00:00.000Z'));

    expect(beforeStart.livestream).toBeNull();
    expect(beforeStart.upcoming.youtube_url).toBeUndefined();
    expect(duringStream.livestream.youtube_url).toBe('https://youtube.com/live/abcdefghijk');
    expect(duringStream.upcoming).toBeNull();
  });

  test('sends a reminder without disclosing the URL before the stream starts', async () => {
    const data = {
      area_id: 'area-1',
      title: 'Evening Check',
      slot: 'evening',
      youtube_url: 'https://youtube.com/live/abcdefghijk',
      status: 'scheduled',
      scheduled_start_at: mockTimestamp(new Date('2026-05-24T10:30:00.000Z')),
      scheduled_end_at: mockTimestamp(new Date('2026-05-24T11:30:00.000Z')),
    };
    mockStatusGet.mockResolvedValue({ docs: [streamDoc('stream-1', data)] });
    mockTransactionGet.mockResolvedValue({ data: () => data });

    const result = await processScheduledStreams(now);

    expect(result.reminders).toBe(1);
    expect(mockTransactionUpdate).toHaveBeenCalled();
    expect(mockSendAreaBroadcast).toHaveBeenCalledWith('area-1', expect.objectContaining({
      type: 'livestream_reminder',
      meta: expect.not.objectContaining({ youtube_url: expect.anything() }),
    }));
  });

  test('publishes a go-live alert with the viewing URL at start time', async () => {
    const data = {
      area_id: 'area-1',
      title: 'Morning Check',
      slot: 'morning',
      youtube_url: 'https://youtube.com/live/abcdefghijk',
      status: 'scheduled',
      scheduled_start_at: mockTimestamp(new Date('2026-05-24T09:59:00.000Z')),
      scheduled_end_at: mockTimestamp(new Date('2026-05-24T11:00:00.000Z')),
    };
    mockStatusGet.mockResolvedValue({ docs: [streamDoc('stream-1', data)] });
    mockTransactionGet.mockResolvedValue({ data: () => data });

    const result = await processScheduledStreams(now);

    expect(result.started).toBe(1);
    expect(mockRefUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'live',
      is_active: true,
    }));
    expect(mockSendAreaBroadcast).toHaveBeenCalledWith('area-1', expect.objectContaining({
      type: 'livestream_started',
      meta: expect.objectContaining({ youtube_url: data.youtube_url }),
    }));
  });

  test('releases a reminder claim after a broadcast failure so the scheduler can retry', async () => {
    const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const data = {
      area_id: 'area-1',
      title: 'Morning Check',
      slot: 'morning',
      youtube_url: 'https://youtube.com/live/abcdefghijk',
      status: 'scheduled',
      scheduled_start_at: mockTimestamp(new Date('2026-05-24T10:30:00.000Z')),
      scheduled_end_at: mockTimestamp(new Date('2026-05-24T11:30:00.000Z')),
    };
    mockStatusGet.mockResolvedValue({ docs: [streamDoc('stream-1', data)] });
    mockTransactionGet.mockResolvedValue({ data: () => data });
    mockSendAreaBroadcast.mockRejectedValueOnce(new Error('Temporary push outage'));

    try {
      const result = await processScheduledStreams(now);

      expect(result.reminders).toBe(0);
      expect(mockRefUpdate).toHaveBeenCalledWith(expect.objectContaining({
        reminder_sent_at_claimed_at: 'delete-field',
        reminder_error: 'Temporary push outage',
      }));
    } finally {
      logSpy.mockRestore();
    }
  });
});
