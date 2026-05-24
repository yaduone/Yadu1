const express = require('express');
const request = require('supertest');

const mockGenerateLivePreview = jest.fn();
const mockGetNextDayStatus = jest.fn();
const mockRunNightlyJob = jest.fn();
const mockGetWindow = jest.fn();

jest.mock('../src/modules/manifests/manifest.service', () => ({
  generateLivePreview: mockGenerateLivePreview,
  getNextDayStatus: mockGetNextDayStatus,
  listManifests: jest.fn(),
  getManifestSignedUrl: jest.fn(),
  generateManifest: jest.fn(),
}));

jest.mock('../src/jobs/nightlyManifest', () => ({
  runNightlyJob: mockRunNightlyJob,
}));

jest.mock('../src/modules/settings/manifestSettings.service', () => ({
  getNextDayManifestWindow: mockGetWindow,
}));

jest.mock('../src/middleware/auth', () => ({
  authenticateAdmin: (req, _res, next) => {
    req.admin = { areaId: 'area-1', adminId: 'admin-1' };
    next();
  },
}));

const manifestRoutes = require('../src/modules/manifests/manifest.routes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/manifests', manifestRoutes);
  return app;
}

describe('next-day manifest trigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNextDayStatus.mockResolvedValue({ delivery_date: '2026-05-25' });
  });

  test('generates a live preview before scheduled finalization without processing orders', async () => {
    mockGetWindow.mockResolvedValue({
      isReady: false,
      deliveryDate: '2026-05-25',
      cronTime: '23:00',
    });

    const response = await request(createApp()).post('/api/manifests/trigger');

    expect(response.status).toBe(200);
    expect(mockGenerateLivePreview).toHaveBeenCalledWith('area-1', '2026-05-25', 'admin-1');
    expect(mockRunNightlyJob).not.toHaveBeenCalled();
    expect(response.body.message).toMatch(/preview generated/i);
  });

  test('uses final order processing after scheduled finalization time', async () => {
    mockGetWindow.mockResolvedValue({
      isReady: true,
      deliveryDate: '2026-05-25',
      cronTime: '23:00',
    });

    const response = await request(createApp()).post('/api/manifests/trigger');

    expect(response.status).toBe(200);
    expect(mockRunNightlyJob).toHaveBeenCalledWith('area-1');
    expect(mockGenerateLivePreview).not.toHaveBeenCalled();
  });
});
