import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hb_token');
      localStorage.removeItem('hb_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  googleAuth: (idToken) => api.post('/auth/google', { idToken }),
  sendOtp: (data) => api.post('/otp/send', data),
  verifyOtp: (data) => api.post('/otp/verify', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me'),
};

// ── Bookings ──────────────────────────────────
export const bookingAPI = {
  create: (data) => api.post('/bookings', data),
  getMyBookings: () => api.get('/bookings/my'),
  getById: (id) => api.get(`/bookings/${id}`),
  updateStatus: (id, data) => api.patch(`/bookings/${id}/status`, data),
  accept: (id) => api.patch(`/bookings/${id}/accept`),
  decline: (id, data) => api.patch(`/bookings/${id}/decline`, data),
  rate: (id, data) => api.post(`/bookings/${id}/rate`, data),
  updateWorkerLocation: (id, data) => api.patch(`/bookings/${id}/worker-location`, data),
  getAllBookings: (params) => api.get('/bookings/all', { params }),
  getPendingForProvider: () => api.get('/bookings/pending-for-provider'),
};

// ── Dispatch ─────────────────────────────────
export const dispatchAPI = {
  estimateFare: (data) => api.post('/dispatch/estimate', data),
  findNearestCaptains: (data) => api.post('/dispatch/find-captains', data),
  requestDispatch: (data) => api.post('/dispatch/request', data),
};

// ── Workers ─────────────────────────────────
export const workerAPI = {
  getAll: () => api.get('/workers'),
  getById: (id) => api.get(`/workers/${id}`),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// ── Payments ─────────────────────────────────
export const paymentAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  verify: (data) => api.post('/payments/verify', data),
  getByBooking: (bookingId) => api.get(`/payments/booking/${bookingId}`),
  getAll: () => api.get('/payments/all'),
};

// ── Wallet ─────────────────────────────────
export const walletAPI = {
  getMyWallet: () => api.get('/wallet/me'),
  getAllWallets: () => api.get('/wallet/admin/all'),
};

// ── Commission ─────────────────────────────
export const commissionAPI = {
  getConfig: () => api.get('/commission'),
  updateConfig: (data) => api.put('/commission', data),
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

