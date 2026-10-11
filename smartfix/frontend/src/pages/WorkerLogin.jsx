import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import './WorkerLogin.css';

const WorkerLogin = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutInfo, setLockoutInfo] = useState(null); // { lockUntil, remainingMinutes }
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);

  // Clear errors when typing
  useEffect(() => {
    setErrorMessage('');
  }, [identifier, password]);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutInfo || !lockoutInfo.lockUntil) return;

    const expiryTime = new Date(lockoutInfo.lockUntil).getTime();
    const updateCountdown = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.ceil((expiryTime - now) / 1000));
      setLockoutSecondsLeft(diffSec);
      if (diffSec <= 0) {
        setLockoutInfo(null);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [lockoutInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMessage(t('worker.login.fill_all', 'Please enter your registered email/phone and password.'));
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const res = await apiService.workerLogin(identifier.trim(), password);

      if (res.success && res.token && res.worker) {
        // Persist session tokens for worker
        localStorage.setItem('smartfix_worker_token', res.token);
        localStorage.setItem('smartfix_worker', JSON.stringify(res.worker));
        localStorage.setItem('smartfix_token', res.token);
        localStorage.setItem('smartfix_user', JSON.stringify(res.worker));
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.worker));

        const status = (res.worker.verificationStatus || '').toLowerCase();

        if (status === 'approved') {
          navigate('/worker/dashboard');
        } else if (status === 'rejected') {
          navigate('/worker/rejected');
        } else if (status === 'suspended') {
          setErrorMessage(t('worker.login.suspended', 'Account suspended, contact support.'));
        } else {
          // 'pending_verification' or default
          navigate('/worker/pending');
        }
      } else {
        setErrorMessage(res.message || t('worker.login.invalid_credentials', 'Invalid credentials'));
      }
    } catch (err) {
      const data = err.data || {};
      if (data.locked) {
        setLockoutInfo({
          lockUntil: data.lockUntil,
          remainingMinutes: data.remainingMinutes || 15,
        });
        setErrorMessage(
          data.message ||
            t('worker.login.locked_out', 'Account locked for 15 minutes due to 5 consecutive failed login attempts.')
        );
      } else if (data.suspended) {
        setErrorMessage(t('worker.login.suspended', 'Account suspended, contact support'));
      } else {
        setErrorMessage(err.message || t('worker.login.invalid_credentials', 'Invalid credentials'));
      }
    } finally {
      setLoading(false);
    }
  };

  const formatRemainingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="worker-login-container">
      <div className="worker-login-card">
        {/* Header / Portal Identifier */}
        <div className="worker-portal-badge">
          <span className="badge-icon">🛠️</span>
          <span>{t('worker.portal_title', 'SmartFix Partner Portal')}</span>
          <span className="badge-lang">
            {i18n.language === 'ta' ? 'பணியாளர் தளம்' : 'Provider Hub'}
          </span>
        </div>

        <div className="worker-login-header">
          <h2>{t('worker.login.welcome_back', 'Service Provider Sign In')}</h2>
          <p>
            {t(
              'worker.login.subtitle',
              'Access your certified technician dashboard, jobs, and earnings.'
            )}
          </p>
        </div>

        {/* Lockout Notification Banner */}
        {lockoutInfo && lockoutSecondsLeft > 0 && (
          <div className="worker-lockout-banner" role="alert">
            <div className="lockout-icon">⏳</div>
            <div className="lockout-text">
              <strong>{t('worker.login.account_locked_title', 'Security Lockout Active')}</strong>
              <p>
                {t(
                  'worker.login.account_locked_desc',
                  'Too many failed attempts. Try again in:'
                )}{' '}
                <span className="lockout-timer">{formatRemainingTime(lockoutSecondsLeft)}</span>
              </p>
            </div>
          </div>
        )}

        {/* General Error Banner */}
        {errorMessage && !lockoutInfo && (
          <div className="worker-error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="worker-login-form" noValidate>
          <div className="form-group mb-3">
            <label htmlFor="identifier">
              {t('worker.login.identifier_label', 'Email or Mobile Number (+91)')}
            </label>
            <div className="input-with-icon">
              <span className="field-icon">👤</span>
              <input
                id="identifier"
                type="text"
                className="form-control"
                placeholder={t('worker.login.identifier_placeholder', 'name@example.com or 9876543210')}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading || (lockoutInfo && lockoutSecondsLeft > 0)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group mb-3">
            <div className="label-row d-flex justify-content-between align-items-center">
              <label htmlFor="password">
                {t('worker.login.password_label', 'Password')}
              </label>
              <Link to="/worker/forgot-password" className="forgot-password-link">
                {t('worker.login.forgot_password', 'Forgot Password?')}
              </Link>
            </div>
            <div className="input-with-icon password-group">
              <span className="field-icon">🔒</span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || (lockoutInfo && lockoutSecondsLeft > 0)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-worker-submit w-100"
            disabled={loading || (lockoutInfo && lockoutSecondsLeft > 0)}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {t('worker.login.signing_in', 'Authenticating...')}
              </>
            ) : (
              t('worker.login.sign_in_btn', 'Sign In to Provider Portal')
            )}
          </button>
        </form>

        {/* Verification Status Routing Explainer */}
        <div className="worker-status-note">
          <small>
            ℹ️{' '}
            {t(
              'worker.login.routing_note',
              'Pending workers will be routed to the KYC tracker. Approved partners access the live dispatch console.'
            )}
          </small>
        </div>

        {/* Footer / Signup Link */}
        <div className="worker-login-footer">
          <span>{t('worker.login.no_account', "Don't have a Partner account?")}</span>{' '}
          <Link to="/worker/signup" className="register-now-link">
            {t('worker.login.join_as_pro', 'Register as Service Partner')}
          </Link>
        </div>

        <div className="customer-portal-switch">
          <Link to="/login">
            ← {t('worker.login.back_to_customer', 'Customer Sign In')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WorkerLogin;
