import { api } from '../context/AuthContext';

// Analytics
export const getAnalytics = () => api.get('/admin/analytics').catch(() => ({ data: { analytics: {} } }));

// Users & Worker Verification Queue
export const getUsers = () => api.get('/admin/users').catch(() => ({ data: { users: [] } }));
export const updateUser = (id, data) => api.put(`/admin/users/${id}`, data);
export const getPendingCaptains = (params) => api.get('/admin/pending-captains', { params }).catch(() => ({ data: { captains: [] } }));
export const verifyCaptain = (id, data) => api.patch(`/admin/verify-captain/${id}`, data);


// Bookings
export const getAllBookings = (params) => api.get('/bookings/all', { params }).catch(() => ({ data: { bookings: [] } }));

// Payments
export const getAllPayments = () => api.get('/payments/all').catch(() => ({ data: { payments: [] } }));

// Wallets
export const getAllWallets = () => api.get('/wallet/admin/all').catch(() => ({ data: { wallets: [] } }));

// Commission
export const getCommissionConfig = () => api.get('/commission').catch(() => ({ data: { config: { commissionRate: 10, cashbackRate: 5, slaTimeMinutes: 60 } } }));
export const updateCommissionConfig = (data) => api.put('/commission', data);
