import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  WifiOff,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import './AdminLogin.css';

export default function AdminLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { adminLogin, adminUser, adminToken } = useAuth();

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI & Loading States
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Security Lockout State (30 minutes on 5 failed attempts)
  const [lockoutInfo, setLockoutInfo] = useState(null); // { lockUntil, remainingMinutes }
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  // If already authenticated as admin, redirect to admin console
  useEffect(() => {
    if (adminUser && adminToken) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [adminUser, adminToken, navigate]);

  // Offline detection listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockoutInfo || !lockoutInfo.lockUntil) return;
    const expiry = new Date(lockoutInfo.lockUntil).getTime();

    const tick = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.ceil((expiry - now) / 1000));
      setLockoutSecondsLeft(diffSec);
      if (diffSec <= 0) {
        setLockoutInfo(null);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutInfo]);

  // Field blur validation
  const handleEmailBlur = () => {
    if (!email.trim()) {
      setFieldErrors((prev) => ({ ...prev, email: 'Admin email or phone is required.' }));
    } else {
      setFieldErrors((prev) => ({ ...prev, email: '' }));
    }
  };

  const handlePasswordBlur = () => {
    if (!password) {
      setFieldErrors((prev) => ({ ...prev, password: 'Password is required.' }));
    } else {
      setFieldErrors((prev) => ({ ...prev, password: '' }));
    }
  };

  // Submit Credentials (Single-step direct login)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    const errors = {};
    if (!email.trim()) {
      errors.email = 'Admin email is required.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      await adminLogin(email, password);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      if (err.locked) {
        setLockoutInfo({
          lockUntil: new Date(Date.now() + (err.remainingMinutes || 30) * 60 * 1000),
          remainingMinutes: err.remainingMinutes || 30,
        });
        setGeneralError(
          `Administrator access locked for ${err.remainingMinutes || 30} minutes due to 5 consecutive failed attempts.`
        );
      } else {
        setGeneralError(err.message || 'Invalid administrator credentials. Verify your email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Format countdown string
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="admin-login-wrapper">
      <main className="admin-login-card" role="main" aria-labelledby="admin-title">
        {/* Offline Banner */}
        {isOffline && (
          <div className="admin-offline-banner" role="status">
            <WifiOff size={15} />
            <span>{t('auth.offline_notice', 'Network connection unavailable. Reconnecting...')}</span>
          </div>
        )}

        {/* Security Lockout Banner */}
        {lockoutInfo && lockoutSecondsLeft > 0 && (
          <div className="admin-lockout-banner" role="alert" aria-live="assertive">
            <span className="lockout-icon" aria-hidden="true">🔒</span>
            <div>
              <h4>Security Lockout Active</h4>
              <p>
                Five consecutive failed attempts detected. Administrator access is restricted for security.
              </p>
              <div className="admin-lockout-timer" aria-label={`Time remaining ${formatTime(lockoutSecondsLeft)}`}>
                Time remaining: {formatTime(lockoutSecondsLeft)}
              </div>
            </div>
          </div>
        )}

        {/* Header with Security Badge */}
        <header className="admin-card-header">
          <div className="admin-security-badge">
            <span className="badge-icon"><ShieldAlert size={14} /></span>
            <span>SmartFix Central Authority</span>
          </div>
          <h1 id="admin-title" className="admin-card-title">
            {t('auth.admin_login_title', 'Admin Control Portal')}
          </h1>
          <p className="admin-card-subtitle">
            {t('auth.admin_subtitle', 'Restricted access for SmartFix administrative personnel only')}
          </p>
        </header>

        {/* General Error Banner */}
        {generalError && !lockoutInfo && (
          <div className="admin-alert error" role="alert" aria-live="polite">
            <AlertCircle size={16} className="alert-icon" />
            <span>{generalError}</span>
          </div>
        )}

        {/* CREDENTIALS FORM */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="admin-form-group">
            <label htmlFor="admin-email">
              {t('auth.email_label', 'Admin email address')}
            </label>
            <div className="admin-input-wrapper">
              <span className="admin-input-icon"><Mail size={16} /></span>
              <input
                id="admin-email"
                type="text"
                className={`admin-input ${fieldErrors.email ? 'has-error' : ''}`}
                placeholder="admin@smartfix.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
                }}
                onBlur={handleEmailBlur}
                disabled={loading || (lockoutInfo && lockoutSecondsLeft > 0)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
            {fieldErrors.email && (
              <span className="admin-field-error" role="alert">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="admin-form-group">
            <label htmlFor="admin-password">
              {t('auth.password_label', 'Password')}
            </label>
            <div className="admin-input-wrapper">
              <span className="admin-input-icon"><Lock size={16} /></span>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className={`admin-input ${fieldErrors.password ? 'has-error' : ''}`}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                onBlur={handlePasswordBlur}
                disabled={loading || (lockoutInfo && lockoutSecondsLeft > 0)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="admin-input-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && (
              <span className="admin-field-error" role="alert">
                {fieldErrors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="admin-btn-primary"
            disabled={loading || (lockoutInfo && lockoutSecondsLeft > 0)}
          >
            {loading ? (
              <>
                <span className="admin-spinner" aria-hidden="true"></span>
                <span>Authenticating session...</span>
              </>
            ) : (
              <>
                <KeyRound size={16} />
                <span>Sign In to Admin Console</span>
              </>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <Link to="/" className="admin-back-btn">
              <ArrowLeft size={14} />
              <span>Back to SmartFix Home</span>
            </Link>
          </div>
        </form>

        <footer className="admin-card-footer">
          <p className="admin-footer-text">
            <span className="pulse-dot"></span>
            256-bit Encrypted Admin Session • IP Logged & Audited
          </p>
        </footer>
      </main>
    </div>
  );
}
