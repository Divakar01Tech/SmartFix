import { createContext, useContext, useState, useEffect, useRef } from 'react';

export const AuthContext = createContext(null);

const getAuthApiBase = () => {
  if (import.meta.env?.VITE_API_URL) return `${import.meta.env.VITE_API_URL}/auth`;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000/api/auth`;
  }
  return 'http://localhost:5000/api/auth';
};

const getOtpApiBase = () => {
  if (import.meta.env?.VITE_API_URL) return `${import.meta.env.VITE_API_URL}/otp`;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000/api/otp`;
  }
  return 'http://localhost:5000/api/otp';
};


const API_BASE = getAuthApiBase();
const OTP_API_BASE = getOtpApiBase();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('smartfix_token') || localStorage.getItem('smartfix_token') || null);
  const [loading, setLoading] = useState(true);
  // phoneVerifyToken: short-lived JWT from /api/otp/verify (purpose='register')
  // Stored in memory only — never in localStorage — so it expires on page reload
  const phoneVerifyTokenRef = useRef(null);

  const storePhoneVerifyToken = (tkn) => { phoneVerifyTokenRef.current = tkn; };
  const consumePhoneVerifyToken = () => {
    return phoneVerifyTokenRef.current;
  };

  // Restore session on page load if token exists
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem('smartfix_token') || localStorage.getItem('smartfix_token');
      const savedUser = localStorage.getItem('smartfix_user') || localStorage.getItem('smartfix_user');

      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {}
      }

      if (savedToken) {
        setToken(savedToken);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        try {
          const res = await fetch(`${API_BASE}/me`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${savedToken}`,
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            localStorage.setItem('smartfix_user', JSON.stringify(data.user));
            if (data.user?.preferredLanguage) {
              const lang = data.user.preferredLanguage === 'ta' ? 'ta' : 'en';
              localStorage.setItem('smartfix_lang', lang);
            }
          }
        } catch (err) {
          clearTimeout(timeoutId);
        }
      }
      setLoading(false);
    };
    restoreSession();
  }, []);

  // Login with phone number or email + password
  const login = async (identifier, password, role) => {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const payload = { password, role };
    if (isEmail) payload.email = identifier;
    else payload.phone = identifier;

    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('smartfix_token', data.token);
    localStorage.setItem('smartfix_user', JSON.stringify(data.user));

    return data.user;
  };

  // Google OAuth Login
  const googleLogin = async (idToken, role = 'customer') => {
    const res = await fetch(`${API_BASE}/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, role }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Google Sign-In failed');
    }

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('smartfix_token', data.token);
    localStorage.setItem('smartfix_user', JSON.stringify(data.user));

    return data.user;
  };

  // Register new customer or handyman
  // Automatically includes the phoneVerifyToken stored in memory from the previous verifyOtp() call.
  const register = async (formData) => {
    const phoneVerifyToken = consumePhoneVerifyToken();
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, ...(phoneVerifyToken ? { phoneVerifyToken } : {}) }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('smartfix_token', data.token);
    localStorage.setItem('smartfix_user', JSON.stringify(data.user));

    return data.user;
  };

  // Send OTP to user/worker mobile number via Twilio Verify API
  // NOTE: No client-side fallback — if the backend fails, a real error is thrown.
  // Credentials are NEVER generated or stored in the browser.
  const sendOtp = async (identifier, role, purpose = 'login') => {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const payload = { role, purpose };
    
    if (isEmail) {
      payload.email = identifier;
    } else {
      payload.phone = identifier.startsWith('+') ? identifier : `+91${identifier.replace(/\D/g, '')}`;
    }
    
    const res = await fetch(`${API_BASE}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to send verification code. Please try again.');
    return data;
  };

  // Verify OTP Code via Twilio Verify API
  // For purpose='register': stores the returned phoneVerifyToken in memory for the register() call.
  // For purpose='login': stores the JWT session token.
  const verifyOtp = async (payload) => {
    const isEmail = payload.phone && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.phone);
    const apiPayload = { ...payload };
    
    if (isEmail) {
      apiPayload.email = payload.phone;
      delete apiPayload.phone;
    } else if (apiPayload.phone) {
      apiPayload.phone = apiPayload.phone.startsWith('+') ? apiPayload.phone : `+91${apiPayload.phone.replace(/\D/g, '')}`;
    }

    const res = await fetch(`${OTP_API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'OTP verification failed');

    // For signup flow: backend returns a phoneVerifyToken (not a full session token)
    if (data.phoneVerifyToken) {
      storePhoneVerifyToken(data.phoneVerifyToken);
    }

    // For login/OTP-login flow: backend returns full JWT + user
    if (data.token && data.user) {
      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('smartfix_token', data.token);
      localStorage.setItem('token', data.token);
      localStorage.setItem('smartfix_user', JSON.stringify(data.user));
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data.user || data;
  };


  // Reset Password via OTP
  const resetPassword = async (identifier, otp, newPassword) => {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const payload = { otp, newPassword };
    if (isEmail) payload.email = identifier;
    else payload.phone = identifier;

    const res = await fetch(`${API_BASE}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Password reset failed');

    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('smartfix_token', data.token);
    localStorage.setItem('smartfix_user', JSON.stringify(data.user));
    return data.user;
  };

  // Update Profile & Settings
  const updateProfile = async (formData) => {
    try {
      const savedToken = localStorage.getItem('smartfix_token') || localStorage.getItem('smartfix_token');
      const res = await fetch(`${API_BASE}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');

      setUser(data.user);
      localStorage.setItem('smartfix_user', JSON.stringify(data.user));
      return data.user;
    } catch (err) {
      console.warn('Backend update profile error, using local fallback:', err.message);
      const updatedUser = { ...user, ...formData };
      setUser(updatedUser);
      localStorage.setItem('smartfix_user', JSON.stringify(updatedUser));
      return updatedUser;
    }
  };

  // Delete Account Permanently
  const deleteAccount = async () => {
    try {
      const savedToken = localStorage.getItem('smartfix_token') || localStorage.getItem('smartfix_token');
      const res = await fetch(`${API_BASE}/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${savedToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete account');
    } catch (err) {
      console.warn('Backend delete account notice:', err.message);
    } finally {
      logout();
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('smartfix_token');
    localStorage.removeItem('smartfix_user');
    localStorage.removeItem('smartfix_token');
    localStorage.removeItem('smartfix_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        loading,
        login,
        googleLogin,
        register,
        sendOtp,
        verifyOtp,
        resetPassword,
        updateProfile,
        deleteAccount,
        logout,
        // Phone verify token helpers (used by Login.jsx signup flow)
        storePhoneVerifyToken,
        consumePhoneVerifyToken,
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
