import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hb_admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hb_admin_token');
    const stored = localStorage.getItem('hb_admin_user');
    if (token && stored) {
      try { setUser(JSON.parse(stored)); } catch (e) {}
    }
    setLoading(false);
  }, []);

  const login = async (phone, password) => {
    const res = await api.post('/auth/login', { phone, password, role: 'admin' });
    const { token, user: userData } = res.data;
    localStorage.setItem('hb_admin_token', token);
    localStorage.setItem('hb_admin_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const loginWithOtp = async (phone, otp) => {
    const res = await api.post('/otp/verify', { phone, purpose: 'login', otp });
    const { token, user: userData } = res.data;
    localStorage.setItem('hb_admin_token', token);
    localStorage.setItem('hb_admin_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const sendOtp = async (phone, purpose = 'login') => {
    const res = await api.post('/otp/send', { phone, purpose, role: 'admin' });
    return res.data;
  };

  const verifyOtp = async (phone, purpose, otp) => {
    const res = await api.post('/otp/verify', { phone, purpose, otp });
    return res.data;
  };

  const resetPassword = async (phone, otp, newPassword) => {
    const res = await api.post('/auth/reset-password', { phone, otp, newPassword });
    const { token, user: userData } = res.data;
    if (token && userData) {
      localStorage.setItem('hb_admin_token', token);
      localStorage.setItem('hb_admin_user', JSON.stringify(userData));
      setUser(userData);
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('hb_admin_token');
    localStorage.removeItem('hb_admin_user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithOtp, sendOtp, verifyOtp, resetPassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export { api };
