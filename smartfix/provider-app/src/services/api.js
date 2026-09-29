import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hb_provider_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hb_provider_token');
      localStorage.removeItem('hb_provider_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  sendOtp: (data) => api.post('/otp/send', data),
  verifyOtp: (data) => api.post('/otp/verify', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const bookingAPI = {
  getMyBookings: () => api.get('/bookings/my'),
  getById: (id) => api.get(`/bookings/${id}`),
  accept: (id) => api.patch(`/bookings/${id}/accept`),
  decline: (id, data) => api.patch(`/bookings/${id}/decline`, data),
  updateStatus: (id, data) => api.patch(`/bookings/${id}/status`, data),
  updateWorkerLocation: (id, data) => api.patch(`/bookings/${id}/worker-location`, data),
  getPendingForProvider: () => api.get('/bookings/pending-for-provider'),
};

export const walletAPI = {
  getMyWallet: () => api.get('/wallet/me'),
};

// ── Generic API Helper ───────────────────────
export const apiCall = async (endpoint, method = 'GET', data = null, headers = {}) => {
  const config = {
    url: endpoint,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...(data ? (method.toUpperCase() === 'GET' ? { params: data } : { data }) : {}),
  };
  const response = await api(config);
  return response.data;
};

export default api;

