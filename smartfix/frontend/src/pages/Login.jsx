import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiService } from '../services/api';
import OtpInput from '../components/OtpInput';
import {
  Wrench,
  ShieldCheck,
  MapPin,
  CreditCard,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  X,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
  Globe,
  WifiOff,
} from 'lucide-react';
import './Login.css';

const TN_DISTRICTS = [
  'Sivagangai',
  'Madurai',
  'Chennai',
  'Coimbatore',
  'Tiruchirappalli',
  'Salem',
  'Tirunelveli',
  'Dindigul',
  'Thanjavur',
  'Virudhunagar',
  'Ramanathapuram',
  'Theni',
  'Kanyakumari',
  'Erode',
  'Vellore',
];

export default function Login({ initialPortal, initialMode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    user,
    customerUser,
    customerToken,
    workerUser,
    workerToken,
    adminUser,
    adminToken,
    login,
    setAuthSession,
    googleLogin,
    completeProfile,
    forgotPasswordSendOtp,
    forgotPasswordVerifyOtp,
    forgotPasswordReset,
  } = useAuth();
  const location = useLocation();
  const { language, setLanguage } = useLanguage();

  // Query parameter support: ?portal=worker or ?mode=signup
  const queryParams = new URLSearchParams(location.search);
  const portalParam = queryParams.get('portal');
  const modeParam = queryParams.get('mode');

  // Role: 'customer' or 'worker'
  const [role, setRole] = useState(
    initialPortal || (portalParam === 'worker' ? 'worker' : 'customer')
  );

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validation & Error States
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [roleMismatchError, setRoleMismatchError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Lockout State
  const [lockoutInfo, setLockoutInfo] = useState(null); // { lockUntil, remainingMinutes }
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  // Offline detection
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Modals
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(
    modeParam === 'signup' || initialMode === 'signup'
  );
  const [showGoogleProfileModal, setShowGoogleProfileModal] = useState(false);

  // Forgot Password Flow State (step 1 = email, 2 = otp, 3 = new pass, 4 = success)
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotConfirmPass, setForgotConfirmPass] = useState('');
  const [forgotTimer, setForgotTimer] = useState(300); // 5 min
  const [forgotResendTimer, setForgotResendTimer] = useState(60);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  // Signup Flow State (step 1 = email, 2 = otp, 3 = profile)
  const [signupStep, setSignupStep] = useState(1);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupOtp, setSignupOtp] = useState('');
  const signupOtpRef = useRef('');
  const [showSignupPass, setShowSignupPass] = useState(false);
  const [showSignupConfirmPass, setShowSignupConfirmPass] = useState(false);
  const [signupToken, setSignupToken] = useState('');
  const [signupForm, setSignupForm] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: '',
    district: 'Sivagangai',
    state: 'Tamil Nadu',
  });
  const [signupTimer, setSignupTimer] = useState(300);
  const [signupResendTimer, setSignupResendTimer] = useState(60);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');

  // Google Profile Completion State
  const [googleProfileForm, setGoogleProfileForm] = useState({
    phone: '',
    address: '',
    district: 'Sivagangai',
    state: 'Tamil Nadu',
    password: '',
  });
  const [googleProfileLoading, setGoogleProfileLoading] = useState(false);
  const [googleProfileError, setGoogleProfileError] = useState('');

  // Offline listener
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
      if (diffSec <= 0) setLockoutInfo(null);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutInfo]);

  // Forgot password OTP countdown
  useEffect(() => {
    if (forgotStep !== 2) return;
    const interval = setInterval(() => {
      setForgotTimer((prev) => Math.max(0, prev - 1));
      setForgotResendTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [forgotStep]);

  // Signup OTP countdown
  useEffect(() => {
    if (signupStep !== 2) return;
    const interval = setInterval(() => {
      setSignupTimer((prev) => Math.max(0, prev - 1));
      setSignupResendTimer((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [signupStep]);

  // Redirect only if authenticated FOR THIS SPECIFIC ROLE/PORTAL
  useEffect(() => {
    if (role === 'worker' && workerUser && workerToken) {
      const status = (workerUser.verificationStatus || '').toLowerCase();
      if (status === 'approved' || status === 'verified') {
        navigate('/worker/dashboard', { replace: true });
      } else if (status === 'rejected') {
        navigate('/worker/rejected', { replace: true });
      } else {
        navigate('/worker/pending', { replace: true });
      }
    } else if (role === 'customer' && customerUser && customerToken) {
      navigate('/customer/home', { replace: true });
    } else if (role === 'admin' && adminUser && adminToken) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [role, workerUser, workerToken, customerUser, customerToken, adminUser, adminToken, navigate]);

  // Validate Email
  const validateEmailFormat = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleEmailBlur = () => {
    if (!email) {
      setErrors((prev) => ({ ...prev, email: 'Email address is required.' }));
    } else if (!validateEmailFormat(email)) {
      setErrors((prev) => ({ ...prev, email: 'Please enter a valid email address.' }));
    } else {
      setErrors((prev) => ({ ...prev, email: '' }));
    }
  };

  const handlePasswordBlur = () => {
    if (!password) {
      setErrors((prev) => ({ ...prev, password: 'Password is required.' }));
    } else {
      setErrors((prev) => ({ ...prev, password: '' }));
    }
  };

  // Helper: Post-login redirect
  const handleRedirectAfterLogin = (authUser, isWorker = false) => {
    if (isWorker) {
      const status = (authUser.verificationStatus || '').toLowerCase();
      if (status === 'approved' || status === 'verified') {
        navigate('/worker/dashboard');
      } else if (status === 'rejected') {
        navigate('/worker/rejected');
      } else {
        navigate('/worker/pending');
      }
    } else {
      navigate('/customer/home');
    }
  };

  // 1. Submit Email + Password
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setRoleMismatchError('');

    const newErrors = {};
    if (!email) newErrors.email = 'Email address is required.';
    else if (!validateEmailFormat(email)) newErrors.email = 'Please enter a valid email address.';

    if (!password) newErrors.password = 'Password is required.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    try {
      const authUser = await login(email, password, role);
      handleRedirectAfterLogin(authUser, role === 'worker');
    } catch (err) {
      if (err.locked) {
        setLockoutInfo({
          lockUntil: new Date(Date.now() + (err.remainingMinutes || 15) * 60 * 1000),
          remainingMinutes: err.remainingMinutes || 15,
        });
        setGeneralError(
          `Account temporarily locked for ${err.remainingMinutes || 15} minutes due to 5 consecutive failed attempts.`
        );
      } else if (err.roleMismatch) {
        setRoleMismatchError(err.message);
      } else {
        setGeneralError(err.message || 'Invalid credentials. Please verify your email and password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Google Sign-In Success Handler
  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleLoading(true);
    setGeneralError('');
    setRoleMismatchError('');

    try {
      const res = await googleLogin(credentialResponse.credential, role);

      if (res.needsProfileCompletion && role === 'customer') {
        setShowGoogleProfileModal(true);
        return;
      }

      if (role === 'worker') {
        if (res.isNewUser) {
          navigate('/worker/signup');
        } else {
          handleRedirectAfterLogin(res.user || res.worker, true);
        }
      } else {
        navigate('/customer/home');
      }
    } catch (err) {
      if (err.roleMismatch) {
        setRoleMismatchError(err.message);
      } else {
        setGeneralError(err.message || 'Google sign-in could not be completed.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // 3. Complete Profile Submit (Google New User)
  const handleGoogleProfileSubmit = async (e) => {
    e.preventDefault();
    setGoogleProfileError('');

    const { phone, address, district, state, password: newPass } = googleProfileForm;
    const cleanPhone = phone.replace(/\D/g, '');

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setGoogleProfileError('Please enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }

    if (!address.trim() || address.trim().length < 5) {
      setGoogleProfileError('Please enter your complete street address.');
      return;
    }

    if (newPass && (newPass.length < 8 || !/(?=.*[A-Za-z])(?=.*\d)/.test(newPass))) {
      setGoogleProfileError('Optional password must have at least 8 characters with letters and numbers.');
      return;
    }

    setGoogleProfileLoading(true);
    try {
      await completeProfile({
        phone: cleanPhone,
        address: address.trim(),
        district,
        state,
        password: newPass || undefined,
      });
      setShowGoogleProfileModal(false);
      navigate('/customer/home');
    } catch (err) {
      setGoogleProfileError(err.message || 'Failed to save profile.');
    } finally {
      setGoogleProfileLoading(false);
    }
  };

  // 4. Forgot Password Steps
  const handleForgotSendOtp = async (e) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail || !validateEmailFormat(forgotEmail)) {
      setForgotError('Please enter a valid registered email address.');
      return;
    }
    setForgotLoading(true);
    try {
      await forgotPasswordSendOtp(forgotEmail);
      setForgotStep(2);
      setForgotTimer(300);
      setForgotResendTimer(60);
    } catch (err) {
      setForgotError(err.message || 'Failed to send verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotVerifyOtp = async (e, directOtp) => {
    if (e?.preventDefault) e.preventDefault();
    setForgotError('');
    const code = (typeof directOtp === 'string' ? directOtp : (typeof e === 'string' ? e : forgotOtp)).trim();
    if (!code || code.length < 6) {
      setForgotError('Please enter the complete 6-digit verification code.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await forgotPasswordVerifyOtp(forgotEmail.trim().toLowerCase(), code);
      setForgotResetToken(res.resetToken);
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.message || 'Invalid or expired verification code.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');

    if (forgotNewPass.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(forgotNewPass)) {
      setForgotError('Password must contain at least 1 letter and 1 number.');
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setForgotError('Password confirmation does not match.');
      return;
    }

    setForgotLoading(true);
    try {
      await forgotPasswordReset(forgotResetToken, forgotNewPass);
      setForgotStep(4);
    } catch (err) {
      setForgotError(err.message || 'Failed to update password.');
    } finally {
      setForgotLoading(false);
    }
  };

  // 5. Customer Signup Steps
  const handleSignupSendOtp = async (e) => {
    e.preventDefault();
    setSignupError('');
    if (!signupEmail || !validateEmailFormat(signupEmail)) {
      setSignupError('Please enter a valid email address.');
      return;
    }
    setSignupLoading(true);
    try {
      await apiService.sendEmailOtp(signupEmail.trim().toLowerCase());
      setSignupStep(2);
      setSignupTimer(300);
      setSignupResendTimer(60);
    } catch (err) {
      setSignupError(err.message || 'Failed to send verification code.');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleSignupVerifyOtp = async (e, directOtp) => {
    if (e?.preventDefault) e.preventDefault();
    if (signupLoading) return;

    let code = '';
    if (typeof directOtp === 'string' && directOtp.trim().length > 0) {
      code = directOtp.trim();
    } else if (typeof e === 'string' && e.trim().length > 0) {
      code = e.trim();
    } else {
      code = (signupOtpRef.current || signupOtp || '').trim();
    }

    code = code.replace(/\D/g, '');

    if (!code || code.length < 6) {
      setSignupError('Please enter all 6 digits of the verification code.');
      return;
    }

    setSignupError('');
    setSignupLoading(true);
    try {
      const res = await apiService.verifyEmailOtp(signupEmail.trim().toLowerCase(), code);
      if (res?.signupToken) {
        setSignupToken(res.signupToken);
        setSignupStep(3);
        setSignupError('');
      } else {
        throw new Error(res?.message || 'Verification token missing. Please try again.');
      }
    } catch (err) {
      setSignupError(err.message || 'Invalid or expired verification code.');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleSignupComplete = async (e) => {
    e.preventDefault();
    setSignupError('');

    const { name, phone, password: p, confirmPassword: cp, address, district, state } = signupForm;
    const cleanPhone = phone.replace(/\D/g, '');

    if (!name.trim()) {
      setSignupError('Full name is required.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setSignupError('Enter a valid 10-digit Indian mobile number starting with 6-9.');
      return;
    }
    if (p.length < 8 || !/(?=.*[A-Za-z])(?=.*\d)/.test(p)) {
      setSignupError('Password must be at least 8 characters with letters and numbers.');
      return;
    }
    if (p !== cp) {
      setSignupError('Passwords do not match.');
      return;
    }
    if (!address.trim() || address.trim().length < 10) {
      setSignupError('Address must be at least 10 characters long.');
      return;
    }

    setSignupLoading(true);
    try {
      const payload = {
        name: name.trim(),
        phone: cleanPhone,
        password: p,
        address: address.trim(),
        district,
        state,
        role: 'customer',
      };
      const res = await apiService.emailRegister(payload, signupToken);
      setShowSignupModal(false);
      setAuthSession(res.user, res.token);
      navigate('/customer/dashboard');
    } catch (err) {
      setSignupError(err.message || 'Registration failed.');
    } finally {
      setSignupLoading(false);
    }
  };

  // Password Strength Calculator
  const getPasswordStrength = (pass) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score; // 0 to 4
  };

  return (
    <div className="auth-viewport">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="auth-offline-banner">
          <WifiOff size={16} />
          <span>You appear to be offline. Please check your internet connection.</span>
        </div>
      )}

      <div className="auth-split-wrapper">
        {/* ==================================================================
            LEFT 45%: Brand Trust Panel (Collapses on mobile)
            ================================================================== */}
        <section className="auth-brand-panel" aria-label="Brand Introduction">
          <div className="brand-header-row">
            <Link to="/" className="brand-logo-link">
              <div className="brand-logo-badge">
                <Wrench size={22} />
              </div>
              <span className="brand-logo-text">SmartFix</span>
            </Link>

            <button
              type="button"
              className="brand-lang-toggle"
              onClick={() => setLanguage(language === 'ta' ? 'en' : 'ta')}
              aria-label="Toggle language"
            >
              <Globe size={14} />
              <span>{language === 'ta' ? 'English' : 'தமிழ்'}</span>
            </button>
          </div>

          <div className="brand-content">
            <h1 className="brand-headline">
              {t('auth.brand_headline', 'Verified home services across Tamil Nadu')}
            </h1>
            <p className="brand-subheadline">
              {t(
                'auth.brand_subheadline',
                'Connect with top-rated plumbers, electricians, and technicians in Sivagangai, Madurai, and throughout Tamil Nadu.'
              )}
            </p>

            <div className="brand-trust-list">
              <div className="brand-trust-item">
                <div className="brand-trust-icon">
                  <ShieldCheck size={18} />
                </div>
                <div className="brand-trust-text">
                  <strong>{t('auth.trust_point_1', 'KYC-verified skilled technicians')}</strong>
                  <br />
                  Background and Aadhaar-verified trade experts.
                </div>
              </div>

              <div className="brand-trust-item">
                <div className="brand-trust-icon">
                  <MapPin size={18} />
                </div>
                <div className="brand-trust-text">
                  <strong>{t('auth.trust_point_2', 'Live GPS tracking & arrival ETA')}</strong>
                  <br />
                  Real-time turn-by-turn technician updates to your door.
                </div>
              </div>

              <div className="brand-trust-item">
                <div className="brand-trust-icon">
                  <CreditCard size={18} />
                </div>
                <div className="brand-trust-text">
                  <strong>{t('auth.trust_point_3', 'Safe digital payments & zero hidden fees')}</strong>
                  <br />
                  Transparent hourly rates and instant Razorpay processing.
                </div>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <span>© {new Date().getFullYear()} SmartFix Home Services India Pvt. Ltd.</span>
          </div>
        </section>

        {/* ==================================================================
            RIGHT 55%: Centered Login Card (max-width 420px)
            ================================================================== */}
        <section className="auth-form-panel">
          <div className="auth-card">
            {/* Header */}
            <div className="auth-card-header">
              <h2 className="auth-card-title">{t('auth.welcome_back', 'Welcome back')}</h2>
              <p className="auth-card-subtitle">
                {role === 'customer'
                  ? 'Sign in to manage bookings and request verified local services.'
                  : 'Sign in to access provider jobs, live duty toggle, and payouts.'}
              </p>
            </div>

            {/* Segmented Control: Customer | Service Provider */}
            <div className="auth-segmented-control" role="tablist" aria-label="Portal Selection">
              <button
                type="button"
                role="tab"
                aria-selected={role === 'customer'}
                className={`segmented-btn ${role === 'customer' ? 'active customer' : ''}`}
                onClick={() => {
                  setRole('customer');
                  setRoleMismatchError('');
                  setGeneralError('');
                }}
              >
                <UserIcon size={16} />
                <span>{t('auth.customer', 'Customer')}</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={role === 'worker'}
                className={`segmented-btn ${role === 'worker' ? 'active worker' : ''}`}
                onClick={() => {
                  setRole('worker');
                  setRoleMismatchError('');
                  setGeneralError('');
                }}
              >
                <Wrench size={16} />
                <span>{t('auth.worker', 'Service provider')}</span>
              </button>
            </div>

            {/* Lockout Warning Banner */}
            {lockoutInfo && (
              <div className="auth-alert auth-alert-danger" role="alert">
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Account temporarily locked</strong>
                  <div>
                    Too many failed login attempts. Please wait{' '}
                    <span style={{ fontWeight: 700 }}>
                      {Math.floor(lockoutSecondsLeft / 60)}:
                      {String(lockoutSecondsLeft % 60).padStart(2, '0')}
                    </span>{' '}
                    or reset your password.
                  </div>
                </div>
              </div>
            )}

            {/* Role Mismatch Warning Banner */}
            {roleMismatchError && (
              <div className="auth-alert auth-alert-warning" role="alert">
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div>{roleMismatchError}</div>
              </div>
            )}

            {/* General Error Banner */}
            {generalError && !lockoutInfo && !roleMismatchError && (
              <div className="auth-alert auth-alert-danger" role="alert">
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <div>{generalError}</div>
              </div>
            )}

            {/* Official Google Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setGeneralError('Google sign-in could not be completed. Please try again.')}
                theme="outline"
                size="large"
                shape="rectangular"
                width="100%"
                text="continue_with"
                disabled={submitting || googleLoading || !!lockoutInfo}
              />
            </div>

            {/* Divider */}
            <div className="auth-divider">
              <span className="auth-divider-text">{t('auth.or_sign_in_email', 'or sign in with email')}</span>
            </div>

            {/* Email + Password Form */}
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {/* Email Field */}
              <div className="auth-form-group">
                <label htmlFor="login-email" className="auth-label">
                  {t('auth.email_label', 'Email address')}
                </label>
                <div className="auth-input-wrapper">
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    className={`auth-input ${role === 'worker' ? 'worker' : ''} ${
                      errors.email ? 'is-invalid' : ''
                    }`}
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                    }}
                    onBlur={handleEmailBlur}
                    disabled={submitting || !!lockoutInfo}
                  />
                </div>
                {errors.email && (
                  <span className="auth-error-text" role="alert">
                    <AlertCircle size={12} /> {errors.email}
                  </span>
                )}
              </div>

              {/* Password Field */}
              <div className="auth-form-group">
                <div className="auth-label-row">
                  <label htmlFor="login-password" className="auth-label">
                    {t('auth.password_label', 'Password')}
                  </label>
                  <button
                    type="button"
                    className={`btn-link-action ${role === 'worker' ? 'worker' : ''}`}
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotStep(1);
                      setShowForgotPassword(true);
                    }}
                  >
                    {t('auth.forgot_password', 'Forgot password?')}
                  </button>
                </div>
                <div className="auth-input-wrapper">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`auth-input ${role === 'worker' ? 'worker' : ''} ${
                      errors.password ? 'is-invalid' : ''
                    }`}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    onBlur={handlePasswordBlur}
                    disabled={submitting || !!lockoutInfo}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <span className="auth-error-text" role="alert">
                    <AlertCircle size={12} /> {errors.password}
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={`btn-primary-auth ${role}`}
                disabled={submitting || googleLoading || !!lockoutInfo}
              >
                {submitting ? (
                  <span>Signing in...</span>
                ) : (
                  <span>{t('auth.sign_in', 'Sign in')}</span>
                )}
              </button>
            </form>

            {/* Footer Links & ISO Security Note */}
            <div className="auth-card-footer">
              <div className="auth-footer-prompt">
                {role === 'customer' ? (
                  <>
                    <span>New to SmartFix? </span>
                    <button
                      type="button"
                      className="btn-link-action"
                      style={{ fontWeight: 600 }}
                      onClick={() => {
                        signupOtpRef.current = '';
                        setSignupOtp('');
                        setSignupError('');
                        setSignupStep(1);
                        setShowSignupModal(true);
                      }}
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    <span>Want to offer services? </span>
                    <Link to="/worker/signup" className="auth-footer-link worker">
                      {t('auth.apply_as_provider', 'Apply as a provider')}
                    </Link>
                  </>
                )}
              </div>

              <div className="auth-security-badge">
                <Lock size={12} />
                <span>{t('auth.security_note', '256-bit SSL encrypted • ISO certified security')}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ==================================================================
          MODAL: Forgot Password (Email OTP -> Reset Token -> New Password)
          ================================================================== */}
      {showForgotPassword && (
        <div className="auth-modal-backdrop" role="dialog" aria-modal="true">
          <div className="auth-modal-card">
            <button
              type="button"
              className="auth-modal-close"
              onClick={() => setShowForgotPassword(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {forgotStep === 1 && (
              <div>
                <h3 className="auth-card-title">Reset password</h3>
                <p className="auth-card-subtitle" style={{ marginBottom: '20px' }}>
                  Enter your registered email address and we will send you a 6-digit verification code.
                </p>

                {forgotError && (
                  <div className="auth-alert auth-alert-danger">
                    <AlertCircle size={16} /> <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleForgotSendOtp}>
                  <div className="auth-form-group">
                    <label className="auth-label">Email address</label>
                    <input
                      type="email"
                      className="auth-input"
                      placeholder="name@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary-auth customer"
                    style={{ marginTop: '20px' }}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Sending code...' : 'Send verification code'}
                  </button>
                </form>
              </div>
            )}

            {forgotStep === 2 && (
              <div>
                <h3 className="auth-card-title">Verify code</h3>
                <p className="auth-card-subtitle">
                  We sent a 6-digit code to <strong>{forgotEmail}</strong>.
                </p>

                {forgotError && (
                  <div className="auth-alert auth-alert-danger">
                    <AlertCircle size={16} /> <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={(e) => handleForgotVerifyOtp(e, forgotOtp)}>
                  <OtpInput
                    value={forgotOtp}
                    onChange={(val) => {
                      setForgotOtp(val);
                      if (forgotError) setForgotError('');
                      if (val.length === 6) {
                        handleForgotVerifyOtp(null, val);
                      }
                    }}
                    disabled={forgotLoading}
                    autoFocus
                  />

                  <button
                    type="submit"
                    className="btn-primary-auth customer"
                    style={{ marginTop: '16px', width: '100%' }}
                    disabled={forgotLoading || forgotOtp.length < 6}
                  >
                    {forgotLoading ? 'Verifying code...' : 'Verify code'}
                  </button>
                </form>

                <div className="otp-meta-row" style={{ marginTop: '14px' }}>
                  <span>
                    Expires in {Math.floor(forgotTimer / 60)}:
                    {String(forgotTimer % 60).padStart(2, '0')}
                  </span>
                  {forgotResendTimer > 0 ? (
                    <span>Resend in {forgotResendTimer}s</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-link-action"
                      onClick={handleForgotSendOtp}
                      disabled={forgotLoading}
                    >
                      Resend code
                    </button>
                  )}
                </div>

                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn-link-action"
                    onClick={() => {
                      setForgotOtp('');
                      setForgotError('');
                      setForgotStep(1);
                    }}
                  >
                    Change email
                  </button>
                </div>
              </div>
            )}

            {forgotStep === 3 && (
              <div>
                <h3 className="auth-card-title">Set new password</h3>
                <p className="auth-card-subtitle" style={{ marginBottom: '16px' }}>
                  Choose a secure password for your account.
                </p>

                {forgotError && (
                  <div className="auth-alert auth-alert-danger">
                    <AlertCircle size={16} /> <span>{forgotError}</span>
                  </div>
                )}

                <form onSubmit={handleForgotResetPassword}>
                  <div className="auth-form-group">
                    <label className="auth-label">New password</label>
                    <input
                      type="password"
                      className="auth-input"
                      placeholder="At least 8 characters"
                      value={forgotNewPass}
                      onChange={(e) => setForgotNewPass(e.target.value)}
                      required
                    />

                    {/* Password Strength Meter */}
                    <div className="password-strength-bar">
                      <div
                        className={`strength-segment ${
                          getPasswordStrength(forgotNewPass) >= 1 ? 'active-weak' : ''
                        }`}
                      />
                      <div
                        className={`strength-segment ${
                          getPasswordStrength(forgotNewPass) >= 2 ? 'active-fair' : ''
                        }`}
                      />
                      <div
                        className={`strength-segment ${
                          getPasswordStrength(forgotNewPass) >= 3 ? 'active-good' : ''
                        }`}
                      />
                    </div>

                    <div className="password-checklist">
                      <span
                        className={`checklist-item ${
                          forgotNewPass.length >= 8 ? 'valid' : ''
                        }`}
                      >
                        <CheckCircle size={12} /> Minimum 8 characters
                      </span>
                      <span
                        className={`checklist-item ${
                          /(?=.*[A-Za-z])(?=.*\d)/.test(forgotNewPass) ? 'valid' : ''
                        }`}
                      >
                        <CheckCircle size={12} /> Contains at least 1 letter and 1 number
                      </span>
                    </div>
                  </div>

                  <div className="auth-form-group" style={{ marginTop: '14px' }}>
                    <label className="auth-label">Confirm password</label>
                    <input
                      type="password"
                      className="auth-input"
                      placeholder="Re-enter new password"
                      value={forgotConfirmPass}
                      onChange={(e) => setForgotConfirmPass(e.target.value)}
                      required
                    />
                    {forgotConfirmPass && forgotNewPass !== forgotConfirmPass && (
                      <span className="auth-error-text">
                        <AlertCircle size={12} /> Passwords do not match.
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="btn-primary-auth customer"
                    style={{ marginTop: '20px' }}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Updating password...' : 'Update password'}
                  </button>
                </form>
              </div>
            )}

            {forgotStep === 4 && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle size={44} color="#16a34a" style={{ margin: '0 auto 16px' }} />
                <h3 className="auth-card-title">Password updated</h3>
                <p className="auth-card-subtitle" style={{ marginBottom: '24px' }}>
                  Your password has been changed successfully. You can now sign in with your new password.
                </p>
                <button
                  type="button"
                  className="btn-primary-auth customer"
                  onClick={() => setShowForgotPassword(false)}
                >
                  Return to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================
          MODAL: Customer Signup (Email OTP -> Profile Form)
          ================================================================== */}
      {showSignupModal && (
        <div className="auth-modal-backdrop" role="dialog" aria-modal="true">
          <div className="auth-modal-card">
            <button
              type="button"
              className="auth-modal-close"
              onClick={() => setShowSignupModal(false)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {signupStep === 1 && (
              <div>
                <h3 className="auth-card-title">Create customer account</h3>
                <p className="auth-card-subtitle" style={{ marginBottom: '20px' }}>
                  Enter your email address to receive a 6-digit verification code.
                </p>

                {signupError && (
                  <div className="auth-alert auth-alert-danger">
                    <AlertCircle size={16} /> <span>{signupError}</span>
                  </div>
                )}

                <form onSubmit={handleSignupSendOtp}>
                  <div className="auth-form-group">
                    <label className="auth-label">Email address</label>
                    <input
                      type="email"
                      className="auth-input"
                      placeholder="name@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary-auth customer"
                    style={{ marginTop: '20px' }}
                    disabled={signupLoading}
                  >
                    {signupLoading ? 'Sending code...' : 'Continue with email'}
                  </button>
                </form>
              </div>
            )}

            {signupStep === 2 && (
              <div>
                <h3 className="auth-card-title">Verify your email</h3>
                <p className="auth-card-subtitle">
                  We sent a 6-digit code to <strong>{signupEmail}</strong>.
                </p>

                {signupError && (
                  <div className="auth-alert auth-alert-danger">
                    <AlertCircle size={16} /> <span>{signupError}</span>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSignupVerifyOtp(e, signupOtpRef.current || signupOtp);
                  }}
                >
                  <OtpInput
                    value={signupOtp}
                    onChange={(val) => {
                      signupOtpRef.current = val;
                      setSignupOtp(val);
                      if (signupError) setSignupError('');
                    }}
                    onComplete={(fullCode) => {
                      signupOtpRef.current = fullCode;
                      setSignupOtp(fullCode);
                      if (signupError) setSignupError('');
                      handleSignupVerifyOtp(null, fullCode);
                    }}
                    disabled={signupLoading}
                    autoFocus
                  />

                  <button
                    type="submit"
                    className="btn-primary-auth customer"
                    style={{
                      marginTop: '16px',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 20px',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                    disabled={signupLoading || (signupOtp.length < 6 && (signupOtpRef.current?.length || 0) < 6)}
                  >
                    {signupLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '1rem', height: '1rem' }} />
                        <span>Verifying code...</span>
                      </>
                    ) : (
                      'Verify code'
                    )}
                  </button>
                </form>

                <div className="otp-meta-row" style={{ marginTop: '14px' }}>
                  <span>
                    Expires in {Math.floor(signupTimer / 60)}:
                    {String(signupTimer % 60).padStart(2, '0')}
                  </span>
                  {signupResendTimer > 0 ? (
                    <span>Resend in {signupResendTimer}s</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-link-action"
                      onClick={handleSignupSendOtp}
                      disabled={signupLoading}
                    >
                      Resend code
                    </button>
                  )}
                </div>

                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <button
                    type="button"
                    className="btn-link-action"
                    onClick={() => {
                      signupOtpRef.current = '';
                      setSignupOtp('');
                      setSignupError('');
                      setSignupStep(1);
                    }}
                  >
                    Change email
                  </button>
                </div>
              </div>
            )}

            {signupStep === 3 && (
              <div>
                <h3 className="auth-card-title">Complete your profile</h3>
                <p className="auth-card-subtitle" style={{ marginBottom: '16px' }}>
                  Provide your contact and address details to book local services.
                </p>

                {signupError && (
                  <div className="auth-alert auth-alert-danger">
                    <AlertCircle size={16} /> <span>{signupError}</span>
                  </div>
                )}

                <form onSubmit={handleSignupComplete}>
                  <div className="auth-form-group">
                    <label className="auth-label">Full name</label>
                    <input
                      type="text"
                      className="auth-input"
                      placeholder="Your name"
                      value={signupForm.name}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="auth-form-group" style={{ marginTop: '12px' }}>
                    <label className="auth-label">Mobile number</label>
                    <div className="auth-input-wrapper">
                      <input
                        type="tel"
                        className="auth-input"
                        placeholder="9876543210 (10 digits)"
                        value={signupForm.phone}
                        onChange={(e) =>
                          setSignupForm({ ...signupForm, phone: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-form-group" style={{ marginTop: '12px' }}>
                    <label className="auth-label">Password</label>
                    <div className="auth-input-wrapper">
                      <input
                        type={showSignupPass ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="Min 8 chars, 1 letter + 1 number"
                        value={signupForm.password}
                        onChange={(e) =>
                          setSignupForm({ ...signupForm, password: e.target.value })
                        }
                        required
                      />
                      <button
                        type="button"
                        className="auth-eye-btn"
                        onClick={() => setShowSignupPass(!showSignupPass)}
                        aria-label="Toggle password visibility"
                      >
                        {showSignupPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="auth-form-group" style={{ marginTop: '12px' }}>
                    <label className="auth-label">Confirm password</label>
                    <div className="auth-input-wrapper">
                      <input
                        type={showSignupConfirmPass ? 'text' : 'password'}
                        className="auth-input"
                        placeholder="Re-type password"
                        value={signupForm.confirmPassword}
                        onChange={(e) =>
                          setSignupForm({ ...signupForm, confirmPassword: e.target.value })
                        }
                        required
                      />
                      <button
                        type="button"
                        className="auth-eye-btn"
                        onClick={() => setShowSignupConfirmPass(!showSignupConfirmPass)}
                        aria-label="Toggle confirm password visibility"
                      >
                        {showSignupConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="auth-form-group" style={{ marginTop: '12px' }}>
                    <label className="auth-label">Address / Street</label>
                    <input
                      type="text"
                      className="auth-input"
                      placeholder="House number, street name"
                      value={signupForm.address}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, address: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '10px',
                      marginTop: '12px',
                    }}
                  >
                    <div className="auth-form-group">
                      <label className="auth-label">District</label>
                      <select
                        className="auth-input"
                        value={signupForm.district}
                        onChange={(e) =>
                          setSignupForm({ ...signupForm, district: e.target.value })
                        }
                      >
                        {TN_DISTRICTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="auth-form-group">
                      <label className="auth-label">State</label>
                      <input
                        type="text"
                        className="auth-input"
                        value={signupForm.state}
                        readOnly
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary-auth customer"
                    style={{ marginTop: '20px' }}
                    disabled={signupLoading}
                  >
                    {signupLoading ? 'Creating account...' : 'Create account'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================
          MODAL: Complete Profile for Google Users
          ================================================================== */}
      {showGoogleProfileModal && (
        <div className="auth-modal-backdrop" role="dialog" aria-modal="true">
          <div className="auth-modal-card">
            <h3 className="auth-card-title">Complete your profile</h3>
            <p className="auth-card-subtitle" style={{ marginBottom: '16px' }}>
              Your Google account is verified. Add your contact phone and address to start booking verified technicians.
            </p>

            {googleProfileError && (
              <div className="auth-alert auth-alert-danger">
                <AlertCircle size={16} /> <span>{googleProfileError}</span>
              </div>
            )}

            <form onSubmit={handleGoogleProfileSubmit}>
              <div className="auth-form-group">
                <label className="auth-label">Mobile number</label>
                <input
                  type="tel"
                  className="auth-input"
                  placeholder="9876543210 (10 digits)"
                  value={googleProfileForm.phone}
                  onChange={(e) =>
                    setGoogleProfileForm({ ...googleProfileForm, phone: e.target.value })
                  }
                  required
                />
              </div>

              <div className="auth-form-group" style={{ marginTop: '12px' }}>
                <label className="auth-label">Street address</label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="House number, street name"
                  value={googleProfileForm.address}
                  onChange={(e) =>
                    setGoogleProfileForm({ ...googleProfileForm, address: e.target.value })
                  }
                  required
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginTop: '12px',
                }}
              >
                <div className="auth-form-group">
                  <label className="auth-label">District</label>
                  <select
                    className="auth-input"
                    value={googleProfileForm.district}
                    onChange={(e) =>
                      setGoogleProfileForm({ ...googleProfileForm, district: e.target.value })
                    }
                  >
                    {TN_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="auth-form-group">
                  <label className="auth-label">State</label>
                  <input
                    type="text"
                    className="auth-input"
                    value={googleProfileForm.state}
                    readOnly
                  />
                </div>
              </div>

              <div className="auth-form-group" style={{ marginTop: '12px' }}>
                <label className="auth-label">Set account password (optional)</label>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Optional password for email login"
                  value={googleProfileForm.password}
                  onChange={(e) =>
                    setGoogleProfileForm({ ...googleProfileForm, password: e.target.value })
                  }
                />
              </div>

              <button
                type="submit"
                className="btn-primary-auth customer"
                style={{ marginTop: '20px' }}
                disabled={googleProfileLoading}
              >
                {googleProfileLoading ? 'Saving...' : 'Save & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
