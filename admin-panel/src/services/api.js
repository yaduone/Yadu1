import axios from 'axios';

const PRIMARY_URL = 'https://backend.yaduone111.workers.dev/api';
const FALLBACK_URL = 'https://yadu1.up.railway.app/api';

const getUrls = () => {
  const isProd = typeof window !== 'undefined' && window.location.hostname === 'yadu1-ten.vercel.app';
  if (isProd) {
    return { primary: PRIMARY_URL, fallback: FALLBACK_URL };
  }
  const devUrl = import.meta.env.VITE_API_URL || '/api';
  return { primary: devUrl, fallback: PRIMARY_URL };
};

const requestInterceptor = (config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  return config;
};

const { primary, fallback } = getUrls();

const api = axios.create({ baseURL: primary, headers: { 'Content-Type': 'application/json' } });
const fallbackApi = axios.create({ baseURL: fallback, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use(requestInterceptor);
fallbackApi.interceptors.request.use(requestInterceptor);

// Retrying a write against the *other* backend is not safe: the first attempt
// may have already reached the server and completed, so a retry can duplicate
// the effect (two emails, two orders). Only replay requests that carry no side
// effect. A 404 is exempt below — it proves no handler ran.
const IDEMPOTENT_METHODS = ['get', 'head', 'options'];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const requestUrl = err.config?.url || '';
    const method = (err.config?.method || 'get').toLowerCase();
    const shouldRetryRouteOnFallback =
      err.response?.status === 404 &&
      !err.config?._retried &&
      requestUrl.startsWith('/settings/');
    // Network-level failure (no response) — retry once with fallback, but only
    // when replaying the request cannot cause the work to happen twice.
    const shouldRetryNetworkFailure =
      !err.response && !err.config?._retried && IDEMPOTENT_METHODS.includes(method);

    if (shouldRetryNetworkFailure || shouldRetryRouteOnFallback) {
      const retryConfig = { ...err.config, _retried: true };
      delete retryConfig.baseURL;
      return fallbackApi.request(retryConfig);
    }

    if (err.response?.status === 401 && localStorage.getItem('admin_token')) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_data');
      window.location.href = '/login';
    }

    if (err.response?.status === 429) {
      const retryAfter = err.response.data?.retryAfter
        || parseInt(err.response.headers['retry-after'] || '60', 10);
      err.retryAfter = retryAfter;
      err.isRateLimited = true;
    }

    return Promise.reject(err);
  }
);

export default api;
