import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  getPortalToken,
  getPortalUser,
  setPortalAuth,
  clearPortalAuth,
  parseJwt,
  normalizeRole,
  STORAGE_KEYS,
} from '../utils/authStorage';
import { reconnectSocketForRole } from '../services/socket';

export const AuthContext = createContext(null);

export const getApiBase = () => {
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
};

const API_BASE = `${getApiBase()}/auth`;

export const AuthProvider = ({ children }) => {
  // 1. Separate state for each portal role
  const [customerUser, setCustomerUser] = useState(() => getPortalUser('customer'));
  const [customerToken, setCustomerToken] = useState(() => getPortalToken('customer'));

  const [workerUser, setWorkerUser] = useState(() => getPortalUser('worker'));
  const [workerToken, setWorkerToken] = useState(() => getPortalToken('worker'));

  const [adminUser, setAdminUser] = useState(() => getPortalUser('admin'));
  const [adminToken, setAdminToken] = useState(() => getPortalToken('admin'));

  const [loading, setLoading] = useState(true);

  // Helper: detect which portal is active based on current window location
  const getActiveRole = useCallback(() => {
    if (typeof window === 'undefined') return 'customer';
    const path = window.location?.pathname || '';
    if (path.startsWith('/worker')) return 'worker';
    if (path.startsWith('/admin')) return 'admin';
    return 'customer';
  }, []);

  // Validate session on load/refresh for the active portal
  useEffect(() => {
    const activeRole = getActiveRole();
    const token = getPortalToken(activeRole);

    if (!token) {
      setLoading(false);
      return;
    }

    const decoded = parseJwt(token);
    if (!decoded || normalizeRole(decoded.role) !== activeRole) {
      // Role mismatch or expired token in storage -> clear
      clearPortalAuth(activeRole);
      if (activeRole === 'customer') {
        setCustomerUser(null);
        setCustomerToken(null);
      } else if (activeRole === 'worker') {
        setWorkerUser(null);
        setWorkerToken(null);
      } else if (activeRole === 'admin') {
        setAdminUser(null);
        setAdminToken(null);
      }
      setLoading(false);
      return;
    }

    // Validate with GET /api/auth/me
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    fetch(`${API_BASE}/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timeoutId);
        if (res.ok) {
          return res.json();
        }
        throw new Error('Token rejected by server');
      })
      .then((data) => {
        const returnedRole = normalizeRole(data.user?.role || data.role);
        if (returnedRole === activeRole) {
          const freshUser = data.user || decoded;
          setPortalAuth(activeRole, token, freshUser);
          if (activeRole === 'customer') {
            setCustomerUser(freshUser);
            setCustomerToken(token);
          } else if (activeRole === 'worker') {
            setWorkerUser(freshUser);
            setWorkerToken(token);
          } else if (activeRole === 'admin') {
            setAdminUser(freshUser);
            setAdminToken(token);
          }
        } else {
          // Returned role does not match current portal -> clear that portal's token
          clearPortalAuth(activeRole);
          if (activeRole === 'customer') {
            setCustomerUser(null);
            setCustomerToken(null);
          } else if (activeRole === 'worker') {
            setWorkerUser(null);
            setWorkerToken(null);
          } else if (activeRole === 'admin') {
            setAdminUser(null);
            setAdminToken(null);
          }
        }
      })
      .catch(() => {
        // Network error: preserve decoded JWT if valid
      })
      .finally(() => {
        setLoading(false);
      });
  }, [getActiveRole]);

  // Context user & token resolving to current active portal context
  const activeRole = getActiveRole();
  const user = useMemo(() => {
    if (activeRole === 'worker') return workerUser;
    if (activeRole === 'admin') return adminUser;
    return customerUser;
  }, [activeRole, customerUser, workerUser, adminUser]);

  const token = useMemo(() => {
    if (activeRole === 'worker') return workerToken;
    if (activeRole === 'admin') return adminToken;
    return customerToken;
  }, [activeRole, customerToken, workerToken, adminToken]);

  // 1. Customer Login (Email or Phone + Password)
  const customerLogin = async (identifier, password) => {
    const res = await fetch(`${getApiBase()}/customer/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      const err = new Error(data.message || 'Invalid credentials');
      err.locked = data.locked;
      err.remainingMinutes = data.remainingMinutes;
      err.roleMismatch = data.roleMismatch;
      err.noPasswordSet = data.noPasswordSet;
      err.status = res.status;
      throw err;
    }

    const authUser = data.user;
    setPortalAuth('customer', data.token, authUser);
    setCustomerUser(authUser);
    setCustomerToken(data.token);
    reconnectSocketForRole('customer');
    return authUser;
  };

  // 2. Worker Login (Email + Password)
  const workerLogin = async (email, password) => {
    const res = await fetch(`${getApiBase()}/worker/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });

    const data = await res.json();

    if (!res.ok) {
      const err = new Error(data.message || 'Invalid credentials');
      err.locked = data.locked;
      err.remainingMinutes = data.remainingMinutes;
      err.roleMismatch = data.roleMismatch;
      err.status = res.status;
      throw err;
    }

    const authUser = data.worker || data.user;
    setPortalAuth('worker', data.token, authUser);
    setWorkerUser(authUser);
    setWorkerToken(data.token);
    reconnectSocketForRole('worker');
    return authUser;
  };

  // 3. General Login (routes to customer or worker based on target role)
  const login = async (email, password, role = 'customer') => {
    const norm = normalizeRole(role);
    if (norm === 'worker') {
      return workerLogin(email, password);
    }
    return customerLogin(email, password);
  };

  // 4. Google Login (with role isolation)
  const googleLogin = async (credential, targetRole = 'customer') => {
    const norm = normalizeRole(targetRole);
    const res = await fetch(`${API_BASE}/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, role: norm }),
    });

    const data = await res.json();

    if (!res.ok) {
      const err = new Error(data.message || 'Google authentication failed');
      err.roleMismatch = data.roleMismatch;
      err.status = res.status;
      throw err;
    }

    const authUser = data.user || data.worker;
    setPortalAuth(norm, data.token, authUser);
    if (norm === 'worker') {
      setWorkerUser(authUser);
      setWorkerToken(data.token);
    } else {
      setCustomerUser(authUser);
      setCustomerToken(data.token);
    }
    reconnectSocketForRole(norm);
    return data;
  };

  // 5. Admin Step 1 Login
  const adminLogin = async (email, password) => {
    const res = await fetch(`${getApiBase()}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const err = new Error(data.message || 'Invalid administrator credentials');
      err.locked = data.locked;
      err.remainingMinutes = data.remainingMinutes;
      err.status = res.status;
      throw err;
    }

    return data;
  };

  // 6. Admin Step 2 OTP Verification
  const adminVerifyOtp = async (otp, adminOtpToken) => {
    const res = await fetch(`${getApiBase()}/admin/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminOtpToken}`,
      },
      body: JSON.stringify({ otp, adminOtpToken }),
    });

    const data = await res.json();

    if (!res.ok) {
      const err = new Error(data.message || 'Verification code failed');
      err.status = res.status;
      throw err;
    }

    const authUser = data.user;
    setPortalAuth('admin', data.token, authUser);
    localStorage.setItem('smartfix_token', data.token);
    setAdminUser(authUser);
    setAdminToken(data.token);
    reconnectSocketForRole('admin');
    return authUser;
  };

  // 7. Set Auth Session manually
  const setAuthSession = (authUser, sessionToken, role = null) => {
    const targetRole = role ? normalizeRole(role) : normalizeRole(authUser?.role);
    setPortalAuth(targetRole, sessionToken, authUser);
    if (targetRole === 'customer') {
      setCustomerUser(authUser);
      setCustomerToken(sessionToken);
    } else if (targetRole === 'worker') {
      setWorkerUser(authUser);
      setWorkerToken(sessionToken);
    } else if (targetRole === 'admin') {
      setAdminUser(authUser);
      setAdminToken(sessionToken);
    }
    reconnectSocketForRole(targetRole);
  };

  // 8. Complete Google Profile
  const completeProfile = async (profileData) => {
    const activeToken = getPortalToken('customer');
    const res = await fetch(`${API_BASE}/complete-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify(profileData),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to complete profile');

    setPortalAuth('customer', activeToken, data.user);
    setCustomerUser(data.user);
    return data.user;
  };

  // 9. Forgot Password API flows
  const forgotPasswordSendOtp = async (email) => {
    const res = await fetch(`${API_BASE}/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to request reset code');
    return data;
  };

  const forgotPasswordVerifyOtp = async (email, otp) => {
    const res = await fetch(`${API_BASE}/forgot-password/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Invalid or expired code');
    return data;
  };

  const forgotPasswordReset = async (resetToken, newPassword) => {
    const res = await fetch(`${API_BASE}/forgot-password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reset password');
    return data;
  };

  // 10. Update Profile (updates active portal's profile)
  const updateProfile = async (formData) => {
    const currentRole = getActiveRole();
    const activeToken = getPortalToken(currentRole);

    const res = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update profile');

    setPortalAuth(currentRole, activeToken, data.user);
    if (currentRole === 'customer') setCustomerUser(data.user);
    else if (currentRole === 'worker') setWorkerUser(data.user);
    else if (currentRole === 'admin') setAdminUser(data.user);

    return data.user;
  };

  // 11. Role-specific Logout: Clears ONLY that portal's credentials
  const logoutRole = (role) => {
    const norm = normalizeRole(role);
    clearPortalAuth(norm);
    if (norm === 'customer') {
      setCustomerUser(null);
      setCustomerToken(null);
    } else if (norm === 'worker') {
      setWorkerUser(null);
      setWorkerToken(null);
    } else if (norm === 'admin') {
      setAdminUser(null);
      setAdminToken(null);
    }
  };

  const logout = (explicitRole = null) => {
    const target = explicitRole ? normalizeRole(explicitRole) : getActiveRole();
    logoutRole(target);
  };

  const logoutCustomer = () => {
    logoutRole('customer');
    window.location.href = '/customer/login';
  };

  const logoutWorker = () => {
    logoutRole('worker');
    window.location.href = '/worker/login';
  };

  const logoutAdmin = () => {
    logoutRole('admin');
    localStorage.removeItem('smartfix_token');
    window.location.href = '/admin/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        loading,
        customerUser,
        customerToken,
        workerUser,
        workerToken,
        adminUser,
        adminToken,
        login,
        customerLogin,
        workerLogin,
        googleLogin,
        adminLogin,
        adminVerifyOtp,
        setAuthSession,
        completeProfile,
        forgotPasswordSendOtp,
        forgotPasswordVerifyOtp,
        forgotPasswordReset,
        updateProfile,
        logout,
        logoutCustomer,
        logoutWorker,
        logoutAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
