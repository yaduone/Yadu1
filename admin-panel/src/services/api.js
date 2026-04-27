import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Don't set Content-Type for FormData — let browser set multipart/form-data
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_data');
      window.location.href = '/login';
    }

    // Handle rate limiting — surface retryAfter to callers
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
