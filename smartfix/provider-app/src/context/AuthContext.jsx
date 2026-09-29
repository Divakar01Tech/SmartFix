import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import socket from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hb_provider_token');
    const stored = localStorage.getItem('hb_provider_user');
    if (token && stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        socket.emit('join-user', parsed.id);
      } catch (e) {}
    }
    setLoading(false);
  }, []);

  const login = async (phone, password) => {
    const res = await authAPI.login({ phone, password, role: 'handyman' });
    const { token, user: userData } = res.data;
    localStorage.setItem('hb_provider_token', token);
    localStorage.setItem('hb_provider_user', JSON.stringify(userData));
    setUser(userData);
    socket.emit('join-user', userData.id);
    return userData;
  };

  const register = async (data) => {
    const res = await authAPI.register({ ...data, role: 'handyman' });
    const { token, user: userData } = res.data;
    localStorage.setItem('hb_provider_token', token);
    localStorage.setItem('hb_provider_user', JSON.stringify(userData));
    setUser(userData);
    socket.emit('join-user', userData.id);
    return userData;
  };

  const loginWithOtp = async (phone, otp) => {
    const res = await authAPI.verifyOtp({ phone, purpose: 'login', otp });
    const { token, user: userData } = res.data;
    localStorage.setItem('hb_provider_token', token);
    localStorage.setItem('hb_provider_user', JSON.stringify(userData));
    setUser(userData);
    socket.emit('join-user', userData.id);
    return userData;
  };

  const sendOtp = async (phone, purpose = 'login') => {
    const res = await authAPI.sendOtp({ phone, purpose, role: 'handyman' });
    return res.data;
  };

  const verifyOtp = async (phone, purpose, otp) => {
    const res = await authAPI.verifyOtp({ phone, purpose, otp });
    return res.data;
  };

  const resetPassword = async (phone, otp, newPassword) => {
    const res = await authAPI.resetPassword({ phone, otp, newPassword });
    const { token, user: userData } = res.data;
    if (token && userData) {
      localStorage.setItem('hb_provider_token', token);
      localStorage.setItem('hb_provider_user', JSON.stringify(userData));
      setUser(userData);
      socket.emit('join-user', userData.id);
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('hb_provider_token');
    localStorage.removeItem('hb_provider_user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithOtp, register, sendOtp, verifyOtp, resetPassword, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
