import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import OtpInput from '../components/OtpInput';
import {
  ShieldAlert,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  WifiOff,
  Clock,
  ArrowLeft,
  KeyRound,
  CheckCircle,
} from 'lucide-react';
import './AdminLogin.css';

export default function AdminLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { adminLogin, adminVerifyOtp } = useAuth();

  // Step 1: 'credentials', Step 2: 'otp'
  const [step, setStep] = useState(1);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');

  // Challenge Token & State from Step 1
  const [adminOtpToken, setAdminOtpToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');

  // UI & Loading States
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Security Lockout State (30 minutes on 5 failed attempts)
  const [lockoutInfo, setLockoutInfo] = useState(null); // { lockUntil, remainingMinutes }
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  // Step 2 Timers (10 minutes = 600s)
  const [otpTimer, setOtpTimer] = useState(600);
  const [resendTimer, setResendTimer] = useState(60); // 60s cooldown

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

  // Step 2 OTP countdown timers
  useEffect(() => {
    if (step !== 2) return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => Math.max(0, prev - 1));
      setResendTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Field blur validation
  const handleEmailBlur = () => {
    if (!email) {
      setFieldErrors((prev) => ({ ...prev, email: 'Admin email is required.' }));
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldErrors((prev) => ({ ...prev, email: 'Enter a valid email address.' }));
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

  // Step 1: Submit Credentials
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    const errors = {};
    if (!email) {
      errors.email = 'Admin email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address.';
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
      const res = await adminLogin(email, password);

      if (res.step === 'otp_required' && res.adminOtpToken) {
        setAdminOtpToken(res.adminOtpToken);
        setMaskedEmail(res.emailMasked || email.replace(/(^.{2})(.*)(@.*$)/, '$1***$3'));
        setStep(2);
        setOtpTimer(res.expiresInSeconds || 600);
        setResendTimer(60);
      } else {
        setGeneralError('Unexpected response from administration service. Try again.');
      }
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

  // Step 2: Submit OTP
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!otp || otp.length !== 6) {
      setGeneralError('Enter all 6 digits of the authentication code.');
      return;
    }

    setLoading(true);

    try {
      await adminVerifyOtp(otp, adminOtpToken);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setGeneralError(err.message || 'Authentication code invalid or expired. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Resend Code
  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    setGeneralError('');

    try {
      const res = await adminLogin(email, password);
      if (res.adminOtpToken) {
        setAdminOtpToken(res.adminOtpToken);
        setOtp('');
        setOtpTimer(res.expiresInSeconds || 600);
        setResendTimer(60);
      }
    } catch (err) {
      setGeneralError(err.message || 'Unable to dispatch a new verification code. Try again shortly.');
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
            {step === 1
              ? t('auth.admin_login_title', 'Admin Control Portal')
              : t('auth.admin_step2_title', 'Two-Factor Verification')}
          </h1>
          <p className="admin-card-subtitle">
            {step === 1
              ? t('auth.admin_subtitle', 'Restricted access for SmartFix administrative personnel only')
              : t('auth.admin_step2_desc', 'Enter the 6-digit code sent to your registered admin email.')}
          </p>
        </header>

        {/* General Error Banner */}
        {generalError && !lockoutInfo && (
          <div className="admin-alert error" role="alert" aria-live="polite">
            <AlertCircle size={16} className="alert-icon" />
            <span>{generalError}</span>
          </div>
        )}

        {/* STEP 1: CREDENTIALS FORM */}
        {step === 1 && (
          <form onSubmit={handleCredentialsSubmit} noValidate>
            <div className="admin-form-group">
              <label htmlFor="admin-email">
                {t('auth.email_label', 'Admin email address')}
              </label>
              <div className="admin-input-wrapper">
                <span className="admin-input-icon"><Mail size={16} /></span>
                <input
                  id="admin-email"
                  type="email"
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
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>{t('auth.admin_step1_btn', 'Authenticate Credentials')}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: EMAIL OTP VERIFICATION */}
        {step === 2 && (
          <form onSubmit={handleOtpSubmit} className="admin-otp-section" noValidate>
            <p className="admin-otp-instruction">
              Authentication code dispatched to <strong>{maskedEmail}</strong>. Code valid for 5 minutes.
            </p>

            <OtpInput
              value={otp}
              onChange={(val) => {
                setOtp(val);
                if (generalError) setGeneralError('');
              }}
              disabled={loading}
              theme="dark"
              autoFocus
            />

            <div className="admin-otp-meta">
              <span className="admin-otp-timer">
                <Clock size={14} />
                <span>Expires in <strong>{formatTime(otpTimer)}</strong></span>
              </span>

              <button
                type="button"
                className="admin-resend-btn"
                onClick={handleResendOtp}
                disabled={resendTimer > 0 || loading}
              >
                {resendTimer > 0
                  ? `Resend in ${resendTimer}s`
                  : t('auth.resend_otp', 'Resend code')}
              </button>
            </div>

            <button
              type="submit"
              className="admin-btn-primary"
              disabled={loading || otp.length !== 6}
            >
              {loading ? (
                <>
                  <span className="admin-spinner" aria-hidden="true"></span>
                  <span>Authenticating session...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  <span>{t('auth.admin_verify_btn', 'Verify & Enter Admin Console')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="admin-back-btn"
              onClick={() => {
                setStep(1);
                setOtp('');
                setGeneralError('');
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to credentials</span>
            </button>
          </form>
        )}

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
