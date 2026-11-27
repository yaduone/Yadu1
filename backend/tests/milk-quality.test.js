const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { createFirebaseMock } = require('./helpers/fakeFirestore');

const mockFirebase = createFirebaseMock();
const TODAY = '2026-11-27';

jest.mock('../src/config/firebase', () => ({
  get db() { return mockFirebase.db; },
  get admin() { return mockFirebase.admin; },
}));

jest.mock('../src/utils/date', () => ({
  ...jest.requireActual('../src/utils/date'),
  today: () => '2026-11-27',
}));

jest.mock('../src/middleware/auth', () => ({
  authenticateAdmin: (req, res, next) => {
    const areaId = req.headers['x-test-admin-area'];
    if (!areaId) return res.status(401).json({ success: false });
    req.admin = { areaId, adminId: 'admin-1' };
    return next();
  },
  authenticateUser: (req, res, next) => {
    const areaId = req.headers['x-test-user-area'];
    if (!areaId) return res.status(401).json({ success: false });
    req.user = { userId: 'user-1', areaId, isProfileComplete: true };
    return next();
  },
  requireCompleteProfile: (_req, _res, next) => next(),
}));

const config = require('../src/config');
const routes = require('../src/modules/milkQuality/milkQuality.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/milk-quality', routes);
  return app;
}

const validBody = (overrides = {}) => ({
  date: TODAY,
  published: true,
  grade: 'excellent',
  tested_by: 'Ramesh',
  sample_time: '05:30',
  notes: 'Chilled within 30 minutes.',
  samples: [
    { milk_type: 'buffalo', fat: 6.8, snf: 9.3, lactose: 4.9, protein: 3.9, lactometer: 31, ph: 6.7 },
    { milk_type: 'cow', fat: '4.2', snf: 8.7, lactose: 4.7, protein: 3.3, lactometer: 25, ph: '' },
  ],
  tests: { added_water: 'negative', urea: 'negative', starch: 'not_tested' },
  ...overrides,
});

const asAdmin = (req, area = 'area-1') => req.set('x-test-admin-area', area);
const asUser = (req, area = 'area-1') => req.set('x-test-user-area', area);

function binary(res, cb) {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('milk quality report', () => {
  let app;

  beforeEach(() => {
    mockFirebase.db.reset({
      areas: { 'area-1': { name: 'Gomti Nagar' }, 'area-2': { name: 'Aliganj' } },
    });
    app = createApp();
  });

  test('rejects invalid reports', async () => {
    const noSamples = await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody({ samples: [] }));
    expect(noSamples.status).toBe(400);

    const outOfBounds = await asAdmin(request(app).put('/api/milk-quality/admin'))
      .send(validBody({ samples: [{ milk_type: 'cow', fat: 42 }] }));
    expect(outOfBounds.status).toBe(400);
    expect(outOfBounds.body.error).toMatch(/Fat must be between/);

    const notANumber = await asAdmin(request(app).put('/api/milk-quality/admin'))
      .send(validBody({ samples: [{ milk_type: 'cow', fat: 'abc' }] }));
    expect(notANumber.status).toBe(400);

    const duplicate = await asAdmin(request(app).put('/api/milk-quality/admin'))
      .send(validBody({ samples: [{ milk_type: 'cow', fat: 4 }, { milk_type: 'cow', fat: 4.1 }] }));
    expect(duplicate.status).toBe(400);

    const future = await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody({ date: '2026-11-28' }));
    expect(future.status).toBe(400);

    const badTest = await asAdmin(request(app).put('/api/milk-quality/admin'))
      .send(validBody({ tests: { urea: 'maybe' } }));
    expect(badTest.status).toBe(400);

    expect(mockFirebase.db.dump('milk_quality_reports')).toEqual({});
  });

  test('admin saves a report and gets it back decorated, keyed by area and day', async () => {
    const res = await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody());
    expect(res.status).toBe(200);

    const stored = mockFirebase.db.get('milk_quality_reports', `area-1_${TODAY}`);
    expect(stored).toMatchObject({ area_id: 'area-1', date: TODAY, published: true, grade: 'excellent' });
    // Sorted into the canonical order; blank values stored as null, strings coerced.
    expect(stored.samples.map((s) => s.milk_type)).toEqual(['cow', 'buffalo']);
    expect(stored.samples[0]).toMatchObject({ fat: 4.2, ph: null });
    expect(stored.tests).toMatchObject({ added_water: 'negative', starch: 'not_tested', formalin: 'not_tested' });

    const { report } = res.body.data;
    const cow = report.samples.find((s) => s.milk_type === 'cow');
    const lacto = cow.parameters.find((p) => p.key === 'lactometer');
    expect(lacto).toMatchObject({ value: 25, status: 'low', display: '25 °LR', reference_display: '26 – 30 °LR' });
    expect(cow.parameters.find((p) => p.key === 'fat')).toMatchObject({ display: '4.2%', status: 'ok' });
    expect(cow.parameters.find((p) => p.key === 'ph')).toMatchObject({ status: 'not_tested', display: '—' });
    expect(report.summary).toMatchObject({
      parameters_tested: 11, parameters_in_range: 10, tests_done: 2, tests_flagged: 0, tests_clear: true,
    });

    const get = await asAdmin(request(app).get('/api/milk-quality/admin'));
    expect(get.status).toBe(200);
    expect(get.body.data.report.id).toBe(`area-1_${TODAY}`);
    expect(get.body.data.recent[0]).toEqual({ date: TODAY, exists: true, published: true, grade: 'excellent' });
    expect(get.body.data.recent).toHaveLength(14);
    expect(get.body.data.meta.parameters.map((p) => p.key)).toEqual(['fat', 'snf', 'lactose', 'protein', 'lactometer', 'ph']);
  });

  test('customers only see published reports from their own area', async () => {
    await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody({ published: false }));

    const draft = await asUser(request(app).get('/api/milk-quality/today'));
    expect(draft.status).toBe(200);
    expect(draft.body.data.report).toBeNull();

    await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody());
    const published = await asUser(request(app).get('/api/milk-quality/today'));
    expect(published.body.data.report.date).toBe(TODAY);
    expect(published.body.data.is_today).toBe(true);
    expect(published.body.data.pdf_path).toMatch(/^\/milk-quality\/pdf\/.+/);
    expect(published.body.data.pdf_url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api\/milk-quality\/pdf\/.+/);

    const otherArea = await asUser(request(app).get('/api/milk-quality/today'), 'area-2');
    expect(otherArea.body.data.report).toBeNull();
  });

  test('falls back to the latest published report within the past week', async () => {
    await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody({ date: '2026-11-25' }));
    await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody({ date: '2026-11-26', published: false }));

    const res = await asUser(request(app).get('/api/milk-quality/today'));
    expect(res.body.data.report.date).toBe('2026-11-25');
    expect(res.body.data.is_today).toBe(false);

    mockFirebase.db.reset({ areas: { 'area-1': { name: 'Gomti Nagar' } } });
    await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody({ date: '2026-11-19' }));
    const stale = await asUser(request(app).get('/api/milk-quality/today'));
    expect(stale.body.data.report).toBeNull();
  });

  test('signed PDF link serves a PDF and stops working once unpublished', async () => {
    await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody());
    const { pdf_path: pdfPath } = (await asUser(request(app).get('/api/milk-quality/today'))).body.data;

    const pdf = await request(app).get(`/api/${pdfPath.replace(/^\//, '')}`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain(`YaduONE-Milk-Quality-Report-${TODAY}.pdf`);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');

    await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody({ published: false }));
    const gone = await request(app).get(`/api/${pdfPath.replace(/^\//, '')}`);
    expect(gone.status).toBe(404);
  });

  test('PDF tokens cannot be forged and cannot double as admin tokens', async () => {
    await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody());
    const { pdf_path: pdfPath } = (await asUser(request(app).get('/api/milk-quality/today'))).body.data;
    const token = pdfPath.split('/').pop();

    expect(() => jwt.verify(token, config.jwt.secret)).toThrow();

    const forged = jwt.sign({ rid: `area-1_${TODAY}` }, config.jwt.secret);
    const res = await request(app).get(`/api/milk-quality/pdf/${forged}`);
    expect(res.status).toBe(404);
  });

  test('admin can preview a draft as PDF and delete a report', async () => {
    await asAdmin(request(app).put('/api/milk-quality/admin')).send(validBody({ published: false }));

    const preview = await asAdmin(request(app).get(`/api/milk-quality/admin/pdf?date=${TODAY}`)).buffer(true).parse(binary);
    expect(preview.status).toBe(200);
    expect(preview.body.subarray(0, 5).toString()).toBe('%PDF-');

    const otherAdmin = await asAdmin(request(app).get(`/api/milk-quality/admin/pdf?date=${TODAY}`), 'area-2');
    expect(otherAdmin.status).toBe(404);

    const del = await asAdmin(request(app).delete(`/api/milk-quality/admin/${TODAY}`));
    expect(del.status).toBe(200);
    expect(mockFirebase.db.dump('milk_quality_reports')).toEqual({});

    const again = await asAdmin(request(app).delete(`/api/milk-quality/admin/${TODAY}`));
    expect(again.status).toBe(404);
  });
});
