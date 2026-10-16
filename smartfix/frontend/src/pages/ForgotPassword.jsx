import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { ShieldCheck, Mail, Lock, KeyRound, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import './CustomerLogin.css';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Step 1: Send OTP | Step 2: Verify OTP | Step 3: Set New Password | Step 4: Done
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 5-min OTP Timer
  const [timer, setTimer] = useState(300);
  const [resendTimer, setResendTimer] = useState(60);

  useEffect(() => {
    if (step !== 2 || timer <= 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, timer]);

  useEffect(() => {
    if (step !== 2 || resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg(t('enter_valid_email', 'Please enter your registered email address'));
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      await apiService.customerSendForgotOtp(email.trim().toLowerCase());
      setStep(2);
      setTimer(300);
      setResendTimer(60);
    } catch (err) {
      setErrorMsg(err.message || t('otp_send_failed', 'Failed to send password reset code'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setErrorMsg(t('enter_6_digit_otp', 'Please enter the 6-digit verification code'));
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      const data = await apiService.customerVerifyForgotOtp(email.trim().toLowerCase(), otp.trim());
      setResetToken(data.resetToken);
      setStep(3);
    } catch (err) {
      setErrorMsg(err.message || t('otp_verify_failed', 'Invalid or expired verification code'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg(t('pass_min_length', 'Password must be at least 8 characters long'));
      return;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      setErrorMsg(t('pass_complexity', 'Password must contain at least 1 letter and 1 number'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('pass_mismatch', 'Passwords do not match'));
      return;
    }
    setErrorMsg('');
    setLoading(true);

    try {
      await apiService.customerResetPassword(resetToken, newPassword);
      setStep(4);
      setSuccessMsg(t('password_reset_success', 'Password reset successfully! You can now log in.'));
    } catch (err) {
      setErrorMsg(err.message || t('password_reset_failed', 'Failed to reset password. Please try again.'));
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
        <div className="customer-auth-header">
          <Link to="/customer/login" className="customer-auth-brand">
            <ShieldCheck size={28} className="text-primary" />
            <span>SmartFix</span>
          </Link>
          <h2 className="h4 fw-bold text-dark mb-1">
            {t('forgot_pass_title', 'Reset Password')}
          </h2>
          <p className="text-muted small mb-0">
            {t('forgot_pass_sub', 'Securely recover your customer account')}
          </p>
        </div>

        <div className="customer-auth-body">
          {errorMsg && (
            <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Enter Email */}
          {step === 1 && (
            <form onSubmit={handleSendOtp}>
              <p className="text-muted small mb-3">
                {t(
                  'forgot_step1_desc',
                  'Enter the email address associated with your SmartFix customer account to receive a 6-digit recovery code.'
                )}
              </p>
              <div className="input-group-modern">
                <Mail size={18} className="input-icon-left" />
                <input
                  type="email"
                  className="form-control"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                />
              </div>

              <button type="submit" className="btn-customer-primary mb-3" disabled={loading || !email.trim()}>
                {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                {t('send_reset_code', 'Send Recovery Code')}
              </button>

              <div className="text-center">
                <Link to="/customer/login" className="small text-muted text-decoration-none d-inline-flex align-items-center gap-1">
                  <ArrowLeft size={16} />
                  <span>{t('back_to_login', 'Back to Login')}</span>
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Verify OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp}>
              <div className="text-center mb-3">
                <p className="small text-muted mb-1">
                  {t('recovery_code_sent_to', 'A 6-digit password recovery code was sent to:')}
                </p>
                <span className="badge bg-light text-dark border px-3 py-1 font-monospace">
                  {email}
                </span>
              </div>

              <div className="input-group-modern">
                <KeyRound size={18} className="input-icon-left" />
                <input
                  type="text"
                  maxLength={6}
                  className="form-control text-center fw-bold fs-5 tracking-wider"
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={loading || timer <= 0}
                  autoFocus
                />
              </div>

              <div className="d-flex justify-content-between align-items-center small mb-3">
                <span className="text-muted">
                  {t('expires_in', 'Expires in')}: <strong>{formatCountdown(timer)}</strong>
                </span>
                <button
                  type="button"
                  className="btn btn-link p-0 small text-decoration-none"
                  onClick={handleSendOtp}
                  disabled={resendTimer > 0 || loading}
                >
                  {resendTimer > 0
                    ? `${t('resend_in', 'Resend in')} ${resendTimer}s`
                    : t('resend_code', 'Resend Code')}
                </button>
              </div>

              <button
                type="submit"
                className="btn-customer-primary mb-2"
                disabled={loading || otp.length !== 6 || timer <= 0}
              >
                {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                {t('verify_code_btn', 'Verify Code')}
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary btn-sm w-100"
                onClick={() => {
                  setStep(1);
                  setOtp('');
                  setErrorMsg('');
                }}
              >
                {t('change_email', 'Change Email')}
              </button>
            </form>
          )}

          {/* STEP 3: Enter New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword}>
              <p className="text-muted small mb-3">
                {t('create_new_password_desc', 'Enter a strong new password for your account (minimum 6 characters).')}
              </p>

              <div className="input-group-modern position-relative">
                <Lock size={18} className="input-icon-left" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-control pe-5"
                  placeholder={t('new_password_placeholder', 'New Password (min 6 characters)')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none px-3"
                  onClick={() => setShowPass(!showPass)}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="input-group-modern">
                <Lock size={18} className="input-icon-left" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-control"
                  placeholder={t('confirm_new_password_placeholder', 'Confirm New Password')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-customer-primary mb-3"
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                {t('save_new_password_btn', 'Update Password')}
              </button>
            </form>
          )}

          {/* STEP 4: Success */}
          {step === 4 && (
            <div className="text-center py-3">
              <div className="mb-3">
                <CheckCircle2 size={54} className="text-success" />
              </div>
              <h3 className="h5 fw-bold text-dark mb-2">
                {t('password_updated_title', 'Password Successfully Reset!')}
              </h3>
              <p className="text-muted small mb-4">
                {t('password_updated_sub', 'Your account credentials have been updated securely.')}
              </p>
              <button
                type="button"
                className="btn-customer-primary"
                onClick={() => navigate('/customer/login', { replace: true })}
              >
                {t('go_to_login_btn', 'Proceed to Login')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
