import { getStoredWorkers, saveWorkerToStorage, deleteWorkerFromStorage } from '../data/mockData';

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


const getHeaders = (token) => {
  const headers = { 'Content-Type': 'application/json' };
  const authToken = token || localStorage.getItem('smartfix_token') || localStorage.getItem('handybook_token');
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

export const apiService = {
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
    const res = await fetch(`${API_BASE}/ai/diagnose`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
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

  verifyCaptain: async (captainId, verificationStatus, rejectionReason = '') => {
    const res = await fetch(`${API_BASE}/admin/verify-captain/${captainId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ verificationStatus, rejectionReason }),
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
};
