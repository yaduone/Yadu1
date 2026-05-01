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

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // Network-level failure (no response) — retry once with fallback
    if (!err.response && !err.config?._retried) {
      const retryConfig = { ...err.config, _retried: true };
      delete retryConfig.baseURL;
      return fallbackApi.request(retryConfig);
    }

    if (err.response?.status === 401) {
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
