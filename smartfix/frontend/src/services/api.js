import { getStoredWorkers, saveWorkerToStorage, deleteWorkerFromStorage } from '../data/mockData';
import { getPortalToken } from '../utils/authStorage';

export const getApiBase = () => {
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
};

const API_BASE = getApiBase();

const getHeaders = (tokenOrRole) => {
  const headers = { 'Content-Type': 'application/json' };
  let authToken = null;
  if (tokenOrRole && typeof tokenOrRole === 'string' && tokenOrRole.startsWith('ey')) {
    authToken = tokenOrRole;
  } else if (tokenOrRole === 'customer' || tokenOrRole === 'worker' || tokenOrRole === 'admin') {
    authToken = getPortalToken(tokenOrRole);
  } else {
    // Infer role namespace from active route
    if (typeof window !== 'undefined' && window.location?.pathname) {
      if (window.location.pathname.startsWith('/worker')) {
        authToken = getPortalToken('worker');
      } else if (window.location.pathname.startsWith('/admin')) {
        authToken = getPortalToken('admin');
      } else {
        authToken = getPortalToken('customer');
      }
    } else {
      authToken = getPortalToken('customer');
    }
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

export const apiService = {
  // Customer Auth Endpoints (/api/customer/auth)
  customerLogin: async (identifier, password) => {
    const res = await fetch(`${API_BASE}/customer/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || 'Invalid credentials');
      err.locked = data.locked;
      err.remainingMinutes = data.remainingMinutes;
      err.status = res.status;
      throw err;
    }
    return data;
  },

  workerGetMe: async (token) => {
    const res = await fetch(`${API_BASE}/worker/me`, {
      headers: getHeaders(token || 'worker'),
    });
    if (!res.ok) throw new Error('Failed to retrieve worker profile');
    const data = await res.json();
    return data.worker || data.user;
  },

  authMe: async (tokenOrRole) => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(tokenOrRole),
    });
    if (!res.ok) throw new Error('Session verification failed');
    return await res.json();
  },

  customerSendLoginOtp: async (email) => {
    const res = await fetch(`${API_BASE}/customer/auth/login-otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || 'Failed to send login OTP');
      err.roleMismatch = data.roleMismatch;
      err.registeredRole = data.registeredRole;
      throw err;
    }
    return data;
  },

  customerVerifyLoginOtp: async (email, otp) => {
    const res = await fetch(`${API_BASE}/customer/auth/login-otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to verify login OTP');
    return data;
  },

  customerSendForgotOtp: async (email) => {
    const res = await fetch(`${API_BASE}/customer/auth/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || 'Failed to request reset OTP');
      err.roleMismatch = data.roleMismatch;
      err.registeredRole = data.registeredRole;
      throw err;
    }
    return data;
  },

  customerVerifyForgotOtp: async (email, otp) => {
    const res = await fetch(`${API_BASE}/customer/auth/forgot-password/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to verify reset OTP');
    return data;
  },

  customerResetPassword: async (resetToken, newPassword) => {
    const res = await fetch(`${API_BASE}/customer/auth/forgot-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reset password');
    return data;
  },

  // Service Categories from DB (/api/services/categories)
  getCategories: async () => {
    const res = await fetch(`${API_BASE}/services/categories`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch categories');
    return data.categories || [];
  },

  // Anonymous Nearby Workers (/api/nearby-workers)
  getNearbyWorkers: async (lat, lng, category = '') => {
    const params = new URLSearchParams();
    if (lat) params.append('lat', lat);
    if (lng) params.append('lng', lng);
    if (category) params.append('category', category);
    const res = await fetch(`${API_BASE}/nearby-workers?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch nearby workers');
    return data.workers || [];
  },

  // Razorpay Payment Order & Verification (/api/payments)
  createPaymentOrder: async (bookingId, useWallet = false, amount = null) => {
    const payload = { bookingId, useWallet };
    if (amount !== null && amount !== undefined) payload.amount = amount;
    const res = await fetch(`${API_BASE}/payments/create-order`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create payment order');
    return data;
  },

  verifyPayment: async (paymentPayload) => {
    const res = await fetch(`${API_BASE}/payments/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(paymentPayload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Payment signature verification failed');
    return data;
  },

  // Wallet
  getWallet: async () => {
    const res = await fetch(`${API_BASE}/wallet`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch wallet');
    return data.wallet || { balance: 0, transactions: [] };
  },

  // Customer Payment History
  getMyPayments: async () => {
    const res = await fetch(`${API_BASE}/payments/my`, {
      headers: getHeaders('customer'),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch payment history');
    return data.payments || [];
  },

  // Admin Payment Analytics & History
  getAdminPayments: async (token) => {
    const res = await fetch(`${API_BASE}/admin/payments`, {
      headers: getHeaders(token || 'admin'),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch payments data');
    return data;
  },

  // Payment by Booking ID
  getPaymentByBooking: async (bookingId) => {
    const res = await fetch(`${API_BASE}/payments/booking/${bookingId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch booking payment');
    return data.payment;
  },
  sendEmailOtp: async (email) => {
    const res = await fetch(`${API_BASE}/auth/email/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
    return data;
  },

  verifyEmailOtp: async (email, otp) => {
    const res = await fetch(`${API_BASE}/auth/email/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Invalid OTP');
    return data;
  },

  emailRegister: async (payload, signupToken) => {
    const res = await fetch(`${API_BASE}/auth/email/register`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${signupToken}`
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    return data;
  },

  forgotPasswordSendOtp: async (email) => {
    const res = await fetch(`${API_BASE}/auth/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to request reset code');
    return data;
  },

  forgotPasswordVerifyOtp: async (email, otp) => {
    const res = await fetch(`${API_BASE}/auth/forgot-password/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Invalid or expired code');
    return data;
  },

  forgotPasswordReset: async (resetToken, newPassword) => {
    const res = await fetch(`${API_BASE}/auth/forgot-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reset password');
    return data;
  },

  completeProfile: async (payload, token) => {
    const authToken = token || localStorage.getItem('smartfix_token');
    const res = await fetch(`${API_BASE}/auth/complete-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to complete profile');
    return data;
  },


  // Services Search (AI + Local)
  searchServices: async (query) => {
    const res = await fetch(`${API_BASE}/services/search`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Search failed');
    return data;
  },

  // Workers
  getWorkers: async (params = {}) => {
    try {
      const queryStr = new URLSearchParams(params).toString();
      const res = await fetch(`${API_BASE}/workers${queryStr ? `?${queryStr}` : ''}`);
      if (!res.ok) throw new Error('Failed to fetch workers');
      const data = await res.json();
      return data.workers || [];
    } catch (err) {
      console.warn('Backend unavailable, using local stored workers:', err.message);
      return getStoredWorkers();
    }
  },

  getWorkerById: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/workers/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.worker) return data.worker;
      }
    } catch (err) {
      console.warn('Backend fetch worker failed:', err.message);
    }
    const local = getStoredWorkers();
    return local.find((w) => w.id === id || w._id === id) || null;
  },

  createWorker: async (workerData) => {
    try {
      const res = await fetch(`${API_BASE}/workers`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(workerData),
      });
      const data = await res.json();
      if (res.ok && data.worker) {
        saveWorkerToStorage(data.worker);
        return data.worker;
      }
    } catch (err) {
      console.warn('Backend create worker error, saving locally:', err.message);
    }
    return saveWorkerToStorage(workerData);
  },

  deleteWorker: async (workerId) => {
    try {
      await fetch(`${API_BASE}/workers/${workerId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
    } catch (err) {
      console.warn('Backend delete worker error');
    }
    return deleteWorkerFromStorage(workerId);
  },

  // Bookings
  createBooking: async (bookingData) => {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(bookingData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create booking');
    return data.booking;
  },

  getMyBookings: async () => {
    const res = await fetch(`${API_BASE}/bookings/my`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch bookings');
    return data.bookings || [];
  },

  getBooking: async (bookingId) => {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || 'Failed to fetch booking');
      err.status = res.status;
      throw err;
    }
    return data.booking;
  },

  cancelBooking: async (bookingId, reason = 'Customer requested cancellation') => {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status: 'cancelled', reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.message || 'Failed to cancel booking');
      err.status = res.status;
      throw err;
    }
    return data.booking;
  },

  updateBookingStatus: async (bookingId, status, extraData = {}) => {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, ...extraData }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update booking status');
    return data.booking;
  },

  acceptBooking: async (bookingId) => {
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}/accept`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok) return data.booking;
    } catch (e) {
      console.warn('Direct accept endpoint fallback:', e.message);
    }
    // Fallback to updateBookingStatus
    return apiService.updateBookingStatus(bookingId, 'Accepted');
  },

  declineBooking: async (bookingId, reason = '') => {
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}/decline`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) return data.booking;
    } catch (e) {
      console.warn('Direct decline endpoint fallback:', e.message);
    }
    // Fallback to updateBookingStatus
    return apiService.updateBookingStatus(bookingId, 'Declined', { cancelReason: reason });
  },

  payBooking: async (bookingId, paymentDetails) => {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/pay`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(paymentDetails),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to process payment');
    return data.booking;
  },

  rateBooking: async (bookingId, rating, review) => {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}/rate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ rating, review }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to submit rating');
    return data.booking;
  },

  diagnoseCustomerIssue: async (payload) => {
    // payload can be { text, language, image (File) }
    const formData = new FormData();
    if (payload.text) formData.append('text', payload.text);
    if (payload.language) formData.append('language', payload.language);
    if (payload.zone) formData.append('zone', payload.zone);
    if (payload.image) formData.append('image', payload.image);

    const authToken = localStorage.getItem('smartfix_token');
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE}/ai/diagnose`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to diagnose issue');
    return data;
  },

  getBookingById: async (bookingId) => {
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch booking');
      return data.booking;
    } catch (err) {
      console.warn('getBookingById error:', err.message);
      return null;
    }
  },

  updateWorkerLocation: async (bookingId, lat, lng) => {
    try {
      const res = await fetch(`${API_BASE}/bookings/${bookingId}/worker-location`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update worker location');
      return data;
    } catch (err) {
      console.warn('Worker location update error:', err.message);
      return null;
    }
  },

  estimateFare: async (params) => {
    try {
      const res = await fetch(`${API_BASE}/dispatch/estimate-fare`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Fare estimation failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend estimation unavailable, calculating fallback:', err.message);
      const dist = 2.5;
      return {
        distanceKm: dist,
        estimatedMinutes: 15,
        fareEstimates: [
          { tier: 'BikePro', label: 'Express Handyman ⚡', price: 149, distanceKm: dist, etaMinutes: 5 },
          { tier: 'AutoHandyman', label: 'Standard Handyman Pro 🚗', price: 249, distanceKm: dist, etaMinutes: 8 },
          { tier: 'MasterTech', label: 'Master Specialist 🚚', price: 449, distanceKm: dist, etaMinutes: 12 },
        ],
      };
    }
  },

  findNearestCaptains: async (params) => {
    try {
      const res = await fetch(`${API_BASE}/dispatch/find-nearest`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error('Failed to fetch radial handymen');
      return await res.json();
    } catch (err) {
      console.warn('Backend radial search fallback');
      return { captains: [] };
    }
  },

  requestDispatch: async (params) => {
    try {
      const res = await fetch(`${API_BASE}/dispatch/request`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Dispatch request failed');
      return data;
    } catch (err) {
      console.warn('Backend dispatch request fallback');
      return {
        message: 'On-demand dispatch initiated (Offline Fallback)',
        booking: {
          id: `b_${Date.now()}`,
          trade: params.trade || 'Plumbing',
          serviceTier: params.serviceTier || 'AutoHandyman',
          price: params.price || 249,
          status: 'PendingDispatch',
          address: params.address || 'Pickup Location',
          date: new Date().toISOString().split('T')[0],
          time: '10:00 AM',
        },
      };
    }
  },

  uploadWorkProof: async (bookingId, stage, file) => {
    try {
      const formData = new FormData();
      formData.append('photos', file);
      const token = localStorage.getItem('smartfix_token');
      const res = await fetch(`${API_BASE}/work-proof/${bookingId}/${stage}`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      return data;
    } catch (err) {
      throw err;
    }
  },

  getPendingCaptains: async (status) => {
    try {
      const url = status ? `${API_BASE}/admin/pending-captains?status=${status}` : `${API_BASE}/admin/pending-captains`;
      const res = await fetch(url, {
        headers: getHeaders(),
      });
      const data = await res.json();
      return data.captains || [];
    } catch (err) {
      return [];
    }
  },

  verifyCaptain: async (captainId, verificationStatus, rejectionReason = '', workerId = '') => {
    const res = await fetch(`${API_BASE}/admin/verify-captain/${captainId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ verificationStatus, rejectionReason, workerId }),
    });
    return await res.json();
  },

  getAdminCustomers: async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/customers`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      return data.customers || [];
    } catch (err) {
      return [];
    }
  },

  toggleBlockCustomer: async (customerId) => {
    const res = await fetch(`${API_BASE}/admin/customers/${customerId}/toggle-block`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return await res.json();
  },

  getAdminCustomersData: async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/customers`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { totalCount: 0, inactiveOneMonthCount: 0, customers: [] };
    }
  },

  deleteCustomer: async (customerId) => {
    const res = await fetch(`${API_BASE}/admin/customers/${customerId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete customer');
    return data;
  },

  cleanupInactiveCustomers: async () => {
    const res = await fetch(`${API_BASE}/admin/customers/inactive-cleanup`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to clean up inactive customers');
    return data;
  },

  sendWorkerFeedback: async (workerId, payload) => {
    const res = await fetch(`${API_BASE}/admin/workers/${workerId}/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to send worker feedback');
    return data;
  },

  getWorkerFeedback: async (workerId) => {
    const res = await fetch(`${API_BASE}/admin/workers/${workerId}/feedback`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch worker feedback');
    return data;
  },

  getAdminAnalytics: async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/analytics`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      return data.analytics || data.metrics || {};
    } catch (err) {
      return {
        totalCaptains: 18,
        activeCaptains: 14,
        verifiedCaptains: 16,
        totalCustomers: 45,
        totalBookings: 38,
        completedBookings: 32,
        totalRevenue: 14850,
      };
    }
  },

  withdrawWallet: async (withdrawData) => {
    try {
      const res = await fetch(`${API_BASE}/wallet/withdraw`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(withdrawData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Withdrawal failed');
      return data;
    } catch (err) {
      console.warn('Withdrawal API fallback:', err.message);
      return { message: 'Withdrawal request processed offline' };
    }
  },

  getAdminBookings: async (status = '', slaBreached = false) => {
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (slaBreached) params.set('slaBreached', 'true');
      const res = await fetch(`${API_BASE}/admin/bookings?${params.toString()}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      return data.bookings || [];
    } catch (err) {
      console.warn('getAdminBookings error:', err.message);
      return [];
    }
  },

  getWalletOverview: async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/wallet-overview`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('getWalletOverview error:', err.message);
      return { totalLiability: 0, wallets: [] };
    }
  },

  getCommissionConfig: async () => {
    try {
      const res = await fetch(`${API_BASE}/commission`);
      const data = await res.json();
      return data.config || null;
    } catch (err) {
      console.warn('getCommissionConfig error:', err.message);
      return null;
    }
  },

  updateCommissionConfig: async (payload) => {
    try {
      const res = await fetch(`${API_BASE}/commission`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('updateCommissionConfig error:', err.message);
      return { message: 'Commission updated locally' };
    }
  },

  startSkillInterview: async (workerId, category, language = 'en') => {
    try {
      const res = await fetch(`${API_BASE}/interview/start`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ workerId, category, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start interview');
      return data.session;
    } catch (err) {
      throw err;
    }
  },

  submitSkillAnswer: async (sessionId, answerText, language = 'en') => {
    try {
      const res = await fetch(`${API_BASE}/interview/answer`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ sessionId, answerText, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit answer');
      return data.session;
    } catch (err) {
      throw err;
    }
  },

  getWorkerInterview: async (workerId) => {
    try {
      const res = await fetch(`${API_BASE}/interview/session/${workerId}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      return data.session || null;
    } catch (err) {
      console.warn('getWorkerInterview error:', err.message);
      return null;
    }
  },

  logAdminAuditDecision: async (workerId, adminDecision, aiVerdict) => {
    try {
      const res = await fetch(`${API_BASE}/interview/admin-audit-decision`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ workerId, adminDecision, aiVerdict }),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('logAdminAuditDecision error:', err.message);
      return null;
    }
  },

  normalizeAddress: async (text) => {
    try {
      const res = await fetch(`${API_BASE}/address/normalize`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.warn('normalizeAddress error:', err.message);
      return null;
    }
  },

  // ==========================================================================
  // Worker (Service Provider) Portal APIs
  // ==========================================================================
  workerSendOtp: async (email) => {
    const res = await fetch(`${API_BASE}/worker/auth/email/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to send verification code.');
    return data;
  },

  workerVerifyOtp: async (email, otp) => {
    const res = await fetch(`${API_BASE}/worker/auth/email/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Invalid or expired OTP.');
    return data;
  },

  workerRegister: async (formData, signupToken) => {
    const isFormData = formData instanceof FormData;
    const headers = isFormData ? {} : { 'Content-Type': 'application/json' };
    if (signupToken) {
      headers['Authorization'] = `Bearer ${signupToken}`;
    }

    const res = await fetch(`${API_BASE}/worker/auth/register`, {
      method: 'POST',
      headers,
      body: isFormData ? formData : JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Worker registration failed.');
    return data;
  },

  workerLogin: async (identifier, password) => {
    const res = await fetch(`${API_BASE}/worker/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identifier, identifier, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data.message || 'Invalid credentials');
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  },

  workerLogout: async () => {
    try {
      const token = localStorage.getItem('smartfix_worker_token') || localStorage.getItem('smartfix_token');
      await fetch(`${API_BASE}/worker/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
      });
    } catch (e) {}
  },

  workerGetMe: async (token) => {
    const authToken = token || localStorage.getItem('smartfix_worker_token') || localStorage.getItem('smartfix_token');
    const res = await fetch(`${API_BASE}/worker/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch worker profile');
    return data.worker;
  },

  workerUploadKyc: async (formData, token) => {
    const authToken = token || localStorage.getItem('smartfix_worker_token') || localStorage.getItem('smartfix_token');
    const res = await fetch(`${API_BASE}/worker/kyc/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to upload KYC documents.');
    return data;
  },

  workerInterviewStart: async (category, language, token) => {
    const authToken = token || sessionStorage.getItem('worker_signup_token') || localStorage.getItem('smartfix_worker_token') || localStorage.getItem('smartfix_token');
    const res = await fetch(`${API_BASE}/worker/interview/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ category, language }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to start interview.');
    return data;
  },

  workerInterviewAnswer: async (sessionId, answerText, language, token) => {
    const authToken = token || sessionStorage.getItem('worker_signup_token') || localStorage.getItem('smartfix_worker_token') || localStorage.getItem('smartfix_token');
    const res = await fetch(`${API_BASE}/worker/interview/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ sessionId, answerText, language }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to submit interview answer.');
    return data;
  },

  workerToggleAvailability: async (availability, token) => {
    const authToken = token || localStorage.getItem('smartfix_worker_token') || localStorage.getItem('smartfix_token');
    const res = await fetch(`${API_BASE}/worker/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ availability }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update availability.');
    return data;
  },

  workerGetEarnings: async (token) => {
    const authToken = token || localStorage.getItem('smartfix_worker_token') || localStorage.getItem('smartfix_token');
    const res = await fetch(`${API_BASE}/worker/earnings`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch earnings.');
    return data.earnings;
  },

  workerForgotPassSendOtp: async (email) => {
    const res = await fetch(`${API_BASE}/worker/auth/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to send password reset code.');
    return data;
  },

  workerForgotPassVerifyOtp: async (email, otp) => {
    const res = await fetch(`${API_BASE}/worker/auth/forgot-password/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Invalid or expired OTP.');
    return data;
  },

  workerForgotPassReset: async (payload, resetToken) => {
    const res = await fetch(`${API_BASE}/worker/auth/forgot-password/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resetToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reset password.');
    return data;
  },

  adminGetWorkerReviewQueue: async (status, token) => {
    const authToken = token || localStorage.getItem('smartfix_token');
    const url = status ? `${API_BASE}/admin/workers/review-queue?status=${status}` : `${API_BASE}/admin/workers/review-queue`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load review queue');
    return data.queue || [];
  },

  adminReviewWorker: async (workerId, decision, reason, token) => {
    const authToken = token || localStorage.getItem('smartfix_token');
    const res = await fetch(`${API_BASE}/admin/workers/${workerId}/review`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ decision, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to record review decision.');
    return data;
  },
};
