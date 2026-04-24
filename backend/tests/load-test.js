/**
 * k6 Load Test — Rate Limiting & Caching Validation
 *
 * Run: k6 run tests/load-test.js
 * Install k6: https://k6.io/docs/getting-started/installation/
 *
 * Scenarios:
 *   1. public_burst    — 150 VUs hit GET /api/products (should see 429s after 120/min)
 *   2. auth_brute      — 20 VUs hammer POST /api/auth/admin/login (should 429 after 5/min)
 *   3. normal_load     — 100 VUs simulate realistic mixed traffic
 *   4. cache_hit_check — Verify X-Cache: HIT on repeated public GETs
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const rateLimitedRate = new Rate('rate_limited_responses');
const cacheHitRate    = new Rate('cache_hit_responses');
const responseTime    = new Trend('response_time_ms');

export const options = {
  scenarios: {
    // Scenario 1: Burst public endpoint — expect 429s
    public_burst: {
      executor: 'constant-vus',
      vus: 150,
      duration: '30s',
      tags: { scenario: 'public_burst' },
    },
    // Scenario 2: Auth brute force — expect 429 after 5 req/min per IP
    auth_brute: {
      executor: 'constant-vus',
      vus: 20,
      duration: '30s',
      startTime: '35s',
      tags: { scenario: 'auth_brute' },
    },
    // Scenario 3: Realistic mixed load — 100 concurrent users
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },
        { duration: '30s', target: 100 },
        { duration: '10s', target: 0 },
      ],
      startTime: '70s',
      tags: { scenario: 'normal_load' },
    },
  },
  thresholds: {
    // 95% of requests should complete under 500ms
    http_req_duration: ['p(95)<500'],
    // Rate limiting should kick in (we expect some 429s in burst scenario)
    rate_limited_responses: ['rate>0'],
    // Cache should be working (we expect hits on repeated GETs)
    cache_hit_responses: ['rate>0.3'],
  },
};

const SCENARIOS = {
  public_burst() {
    const res = http.get(`${BASE_URL}/api/products`);
    responseTime.add(res.timings.duration);

    const is429 = res.status === 429;
    rateLimitedRate.add(is429);

    const isHit = res.headers['X-Cache'] === 'HIT';
    cacheHitRate.add(isHit);

    check(res, {
      'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
      'has rate limit headers': (r) => r.headers['X-RateLimit-Limit'] !== undefined,
      '429 has Retry-After': (r) => r.status !== 429 || r.headers['Retry-After'] !== undefined,
    });

    sleep(0.1);
  },

  auth_brute() {
    const payload = JSON.stringify({ username: 'admin', password: 'wrongpassword' });
    const params  = { headers: { 'Content-Type': 'application/json' } };
    const res     = http.post(`${BASE_URL}/api/auth/admin/login`, payload, params);

    responseTime.add(res.timings.duration);
    rateLimitedRate.add(res.status === 429);

    check(res, {
      'auth returns 200, 401, or 429': (r) => [200, 401, 429].includes(r.status),
      '429 has retry-after': (r) => r.status !== 429 || r.headers['Retry-After'] !== undefined,
    });

    sleep(0.2);
  },

  normal_load() {
    // Mix of public and health endpoints
    const endpoints = [
      `${BASE_URL}/api/health`,
      `${BASE_URL}/api/products`,
      `${BASE_URL}/api/areas`,
      `${BASE_URL}/api/prices`,
    ];
    const url = endpoints[Math.floor(Math.random() * endpoints.length)];
    const res = http.get(url);

    responseTime.add(res.timings.duration);
    cacheHitRate.add(res.headers['X-Cache'] === 'HIT');

    check(res, {
      'status 200 or 429': (r) => r.status === 200 || r.status === 429,
    });

    sleep(0.5 + Math.random() * 0.5);
  },
};

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || 'public_burst';
  const fn = SCENARIOS[scenario] || SCENARIOS.public_burst;
  fn();
}
