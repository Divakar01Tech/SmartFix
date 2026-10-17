import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { Lock, Mail, Phone, Eye, EyeOff, AlertCircle, CheckCircle, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';
import './CustomerLogin.css';

export default function CustomerLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { customerLogin, setAuthSession, googleLogin } = useAuth();

  // Tabs: 'password' | 'otp'
  const [activeTab, setActiveTab] = useState('password');

  // Credentials State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [roleMismatch, setRoleMismatch] = useState(null);

  // Lockout State
  const [lockoutRemainingSecs, setLockoutRemainingSecs] = useState(0);

  // Email OTP Login State
  const [otpEmail, setOtpEmail] = useState('');
  const [otpStep, setOtpStep] = useState(1); // 1 = enter email, 2 = enter otp
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(600); // 10 minutes expiry
  const [resendTimer, setResendTimer] = useState(60);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemainingSecs <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemainingSecs((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemainingSecs]);

  // OTP expiry timer
  useEffect(() => {
    if (otpStep !== 2 || otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpStep, otpTimer]);

  // Resend OTP countdown
  useEffect(() => {
    if (otpStep !== 2 || resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpStep, resendTimer]);

  const redirectAfterLogin = () => {
    const from = location.state?.from?.pathname || '/customer/home';
    navigate(from, { replace: true });
  };

  // Submit Password Login
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMsg(t('auth_missing_fields', 'Please enter your email or phone and password'));
      return;
    }
    setErrorMsg('');
    setRoleMismatch(null);
    setLoading(true);

    try {
      await customerLogin(identifier.trim(), password);
      redirectAfterLogin();
    } catch (err) {
      if (err.locked) {
        const mins = err.remainingMinutes || 15;
        setLockoutRemainingSecs(mins * 60);
        setErrorMsg(
          err.message ||
            t('account_locked_msg', 'Account temporarily locked due to 5 consecutive failed attempts. Please try again in 15 minutes.')
        );
      } else if (err.roleMismatch) {
        const isWorker = err.message?.toLowerCase().includes('provider') || err.message?.toLowerCase().includes('technician');
        setRoleMismatch({
          message: err.message,
          link: isWorker ? '/worker/login' : '/admin/login',
          linkText: isWorker ? t('go_to_worker_portal', 'Go to Technician Portal') : t('go_to_admin_portal', 'Go to Admin Portal'),
        });
      } else {
        setErrorMsg(err.message || t('invalid_credentials', 'Invalid credentials'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send OTP to Email for Login
  const handleSendLoginOtp = async (e) => {
    e.preventDefault();
    if (!otpEmail.trim()) {
      setErrorMsg(t('enter_valid_email', 'Please enter a valid email address'));
      return;
    }
    setErrorMsg('');
    setRoleMismatch(null);
    setOtpLoading(true);

    try {
      await apiService.customerSendLoginOtp(otpEmail.trim().toLowerCase());
      setOtpStep(2);
      setOtpTimer(600);
      setResendTimer(60);
    } catch (err) {
      if (err.roleMismatch) {
        const isWorker = err.registeredRole === 'worker' || err.registeredRole === 'handyman' || err.message?.toLowerCase().includes('technician') || err.message?.toLowerCase().includes('professional');
        setRoleMismatch({
          message: err.message,
          link: isWorker ? '/worker/login' : '/admin/login',
          linkText: isWorker ? t('go_to_worker_portal', 'Go to Technician Portal') : t('go_to_admin_portal', 'Go to Admin Portal'),
        });
      } else {
        setErrorMsg(err.message || t('otp_send_failed', 'Failed to send verification code.'));
      }
    } finally {
      setOtpLoading(false);
    }
  };

  // Step 2: Verify Login OTP
  const handleVerifyLoginOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setErrorMsg(t('enter_6_digit_otp', 'Please enter the 6-digit verification code'));
      return;
    }
    setErrorMsg('');
    setOtpLoading(true);

    try {
      const data = await apiService.customerVerifyLoginOtp(otpEmail.trim().toLowerCase(), otpCode.trim());
      setAuthSession(data.user, data.token, 'customer');
      redirectAfterLogin();
    } catch (err) {
      setErrorMsg(err.message || t('otp_verify_failed', 'Invalid or expired verification code'));
    } finally {
      setOtpLoading(false);
    }
  };

  // Handle Google OAuth Success
  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) return;
    setLoading(true);
    setErrorMsg('');
    try {
      await googleLogin(credentialResponse.credential, 'customer');
      redirectAfterLogin();
    } catch (err) {
      setErrorMsg(err.message || t('google_auth_failed', 'Google login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="customer-auth-container">
      <div className="customer-auth-card">
        {/* Header */}
        <div className="customer-auth-header">
          <Link to="/" className="customer-auth-brand">
            <ShieldCheck size={28} className="text-primary" />
            <span>SmartFix</span>
          </Link>
          <h2 className="h4 fw-bold text-dark mb-1">
            {t('customer_login_title', 'Customer Portal')}
          </h2>
          <p className="text-muted small mb-0">
            {t('customer_login_sub', 'Access your home service bookings & live tracking')}
          </p>
        </div>

        <div className="customer-auth-body">
          {/* Lockout Warning */}
          {lockoutRemainingSecs > 0 && (
            <div className="lockout-alert">
              <AlertCircle size={22} className="flex-shrink-0 text-danger" />
              <div>
                <strong className="d-block">{t('account_locked_title', 'Account Temporarily Locked')}</strong>
                <p className="small mb-1">
                  {t('account_locked_sub', '5 failed login attempts recorded. Please wait for security cooldown.')}
                </p>
                <div className="badge bg-danger">
                  {t('retry_in', 'Retry in')}: {formatCountdown(lockoutRemainingSecs)}
                </div>
              </div>
            </div>
          )}

          {/* Role Mismatch Warning */}
          {roleMismatch && lockoutRemainingSecs <= 0 && (
            <div className="alert alert-warning py-2 px-3 small d-flex flex-column gap-2 mb-3">
              <div className="d-flex align-items-center gap-2">
                <AlertCircle size={18} className="flex-shrink-0 text-warning" />
                <span className="fw-medium">{roleMismatch.message}</span>
              </div>
              <Link to={roleMismatch.link} className="btn btn-sm btn-outline-dark fw-bold align-self-start mt-1">
                {roleMismatch.linkText} →
              </Link>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && lockoutRemainingSecs <= 0 && !roleMismatch && (
            <div className="alert alert-danger py-2 px-3 small d-flex flex-column gap-2 mb-3">
              <div className="d-flex align-items-center gap-2">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
              {errorMsg.toLowerCase().includes('otp') && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary fw-bold align-self-start mt-1"
                  onClick={() => {
                    setActiveTab('otp');
                    if (identifier && identifier.includes('@')) {
                      setOtpEmail(identifier.trim());
                    }
                    setErrorMsg('');
                  }}
                >
                  Switch to Email OTP Login →
                </button>
              )}
            </div>
          )}

          {/* Navigation Pills */}
          <div className="customer-nav-pills">
            <button
              type="button"
              className={`nav-link ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('password');
                setErrorMsg('');
                setRoleMismatch(null);
              }}
            >
              {t('password_login_tab', 'Password Login')}
            </button>
            <button
              type="button"
              className={`nav-link ${activeTab === 'otp' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('otp');
                setErrorMsg('');
                setRoleMismatch(null);
              }}
            >
              {t('otp_login_tab', 'Email OTP Login')}
            </button>
          </div>

          {/* Tab 1: Password Login */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordLogin}>
              <div className="input-group-modern">
                <Mail size={18} className="input-icon-left" />
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('email_or_phone_placeholder', 'Email or +91 Phone Number')}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMsg) setErrorMsg('');
                    if (roleMismatch) setRoleMismatch(null);
                  }}
                  disabled={lockoutRemainingSecs > 0 || loading}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="input-group-modern position-relative">
                <Lock size={18} className="input-icon-left" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control pe-5"
                  placeholder={t('password_placeholder', 'Enter your password')}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                    if (roleMismatch) setRoleMismatch(null);
                  }}
                  disabled={lockoutRemainingSecs > 0 || loading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="d-flex justify-content-end mb-3">
                <Link
                  to="/customer/forgot-password"
                  className="small text-primary text-decoration-none fw-semibold"
                >
                  {t('forgot_password', 'Forgot password?')}
                </Link>
              </div>

              <button
                type="submit"
                className="btn-customer-primary mb-3"
                disabled={lockoutRemainingSecs > 0 || loading}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                ) : null}
                {t('login_btn', 'Login to Account')}
              </button>
            </form>
          )}

          {/* Tab 2: Email OTP Login */}
          {activeTab === 'otp' && (
            <div>
              {otpStep === 1 ? (
                <form onSubmit={handleSendLoginOtp}>
                  <p className="text-muted small mb-3">
                    {t('login_otp_instruction', 'Enter your registered customer email to receive a secure 6-digit login code.')}
                  </p>
                  <div className="input-group-modern">
                    <Mail size={18} className="input-icon-left" />
                    <input
                      type="email"
                      className="form-control"
                      placeholder="customer@example.com"
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                      disabled={otpLoading}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-customer-primary"
                    disabled={otpLoading || !otpEmail.trim()}
                  >
                    {otpLoading ? (
                      <span className="spinner-border spinner-border-sm me-2" />
                    ) : null}
                    {t('send_login_code', 'Send Login Code')}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyLoginOtp}>
                  <div className="text-center mb-3">
                    <p className="small text-muted mb-1">
                      {t('code_sent_to', 'A 6-digit security code was sent to:')}
                    </p>
                    <span className="badge bg-light text-dark border px-3 py-1 font-monospace">
                      {otpEmail}
                    </span>
                  </div>

                  <div className="input-group-modern">
                    <Lock size={18} className="input-icon-left" />
                    <input
                      type="text"
                      maxLength={6}
                      className="form-control text-center fw-bold fs-5 tracking-wider"
                      placeholder="••••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      disabled={otpLoading || otpTimer <= 0}
                      autoFocus
                    />
                  </div>

                  <div className="d-flex justify-content-between align-items-center small mb-3">
                    <span className="text-muted">
                      {t('expires_in', 'Expires in')}: <strong>{formatCountdown(otpTimer)}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn btn-link p-0 small text-decoration-none"
                      onClick={handleSendLoginOtp}
                      disabled={resendTimer > 0 || otpLoading}
                    >
                      {resendTimer > 0
                        ? `${t('resend_in', 'Resend in')} ${resendTimer}s`
                        : t('resend_code', 'Resend Code')}
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="btn-customer-primary mb-2"
                    disabled={otpLoading || otpCode.length !== 6 || otpTimer <= 0}
                  >
                    {otpLoading ? (
                      <span className="spinner-border spinner-border-sm me-2" />
                    ) : null}
                    {t('verify_and_login', 'Verify & Sign In')}
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm w-100"
                    onClick={() => {
                      setOtpStep(1);
                      setOtpCode('');
                      setErrorMsg('');
                    }}
                  >
                    {t('change_email', 'Change Email')}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Social Sign In Divider */}
          <div className="d-flex align-items-center my-3">
            <hr className="flex-grow-1 my-0 text-muted" />
            <span className="px-2 small text-muted text-uppercase fw-semibold" style={{ fontSize: '0.75rem' }}>
              {t('or_continue_with', 'OR CONTINUE WITH')}
            </span>
            <hr className="flex-grow-1 my-0 text-muted" />
          </div>

          {/* Google OAuth Login */}
          <div className="d-flex justify-content-center mb-3">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setErrorMsg(t('google_failed', 'Google login unavailable'))}
              useOneTap={false}
              shape="pill"
              text="signin_with"
            />
          </div>

          {/* Footer Navigation */}
          <div className="text-center pt-2 border-top">
            <p className="small text-muted mb-1">
              {t('dont_have_account', "Don't have a customer account?")}{' '}
              <Link to="/customer/register" className="text-primary fw-bold text-decoration-none">
                {t('register_here', 'Register Here')}
              </Link>
            </p>
            <p className="small text-muted mb-0">
              {t('are_you_worker', 'Are you a Service Professional?')}{' '}
              <Link to="/worker/login" className="text-secondary fw-semibold text-decoration-none">
                {t('worker_portal_link', 'Technician Portal →')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
