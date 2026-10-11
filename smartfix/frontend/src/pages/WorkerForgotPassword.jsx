import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import './WorkerForgotPassword.css';

const WorkerForgotPassword = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Step 1: 'enter_email', Step 2: 'enter_otp', Step 3: 'new_password', Step 4: 'success'
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otpBoxes, setOtpBoxes] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // OTP Timers
  const [otpExpiryTimer, setOtpExpiryTimer] = useState(300); // 5 mins
  const [resendCooldown, setResendCooldown] = useState(60); // 60s
  const otpInputRefs = useRef([]);

  useEffect(() => {
    let interval = null;
    if (step === 2) {
      interval = setInterval(() => {
        setOtpExpiryTimer((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step]);

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage(t('worker.forgot.valid_email', 'Please enter a valid registered email address.'));
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await apiService.workerForgotPassSendOtp(email.trim());
      if (res.success) {
        setStep(2);
        setOtpExpiryTimer(300);
        setResendCooldown(60);
        setSuccessNotice(t('worker.forgot.otp_sent', 'Verification code sent to your email. Valid for 5 minutes.'));
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to send verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle 6-box OTP input
  const handleOtpBoxChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newBoxes = [...otpBoxes];
    newBoxes[index] = value.slice(-1);
    setOtpBoxes(newBoxes);

    // Auto-focus next box
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpBoxes[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otp = otpBoxes.join('');
    if (otp.length !== 6) {
      setErrorMessage(t('worker.forgot.enter_6_digits', 'Please enter all 6 digits of the OTP code.'));
      return;
    }

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await apiService.workerForgotPassVerifyOtp(email.trim(), otp);
      if (res.success && res.resetToken) {
        setResetToken(res.resetToken);
        setStep(3);
        setSuccessNotice(t('worker.forgot.otp_verified', 'OTP verified. Please enter your new password.'));
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setErrorMessage('');
    try {
      await apiService.workerForgotPassSendOtp(email.trim());
      setOtpExpiryTimer(300);
      setResendCooldown(60);
      setSuccessNotice('A new code has been sent to your email.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Password validation: min 8 chars, 1 letter + 1 number
    if (newPassword.length < 8) {
      setErrorMessage(t('worker.forgot.pass_length', 'Password must be at least 8 characters long.'));
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setErrorMessage(t('worker.forgot.pass_combo', 'Password must contain at least one letter and one number.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage(t('worker.forgot.pass_mismatch', 'Passwords do not match.'));
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.workerForgotPassReset(
        { newPassword, confirmPassword },
        resetToken
      );

      if (res.success) {
        setStep(4);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="worker-forgot-container">
      <div className="worker-forgot-card">
        {/* Header Badge */}
        <div className="portal-badge">
          <span>🛠️ SmartFix Partner Portal</span>
        </div>

        <div className="forgot-header">
          <h2>{t('worker.forgot.title', 'Reset Provider Password')}</h2>
          <p>
            {step === 1 && t('worker.forgot.step1_sub', 'Enter your registered partner email to receive a verification OTP.')}
            {step === 2 && t('worker.forgot.step2_sub', `Enter the 6-digit code sent to ${email}`)}
            {step === 3 && t('worker.forgot.step3_sub', 'Choose a strong new password (minimum 8 characters).')}
            {step === 4 && t('worker.forgot.step4_sub', 'Your password has been securely reset.')}
          </p>
        </div>

        {errorMessage && (
          <div className="forgot-alert error" role="alert">
            <span>⚠️</span> {errorMessage}
          </div>
        )}

        {successNotice && step !== 4 && (
          <div className="forgot-alert info" role="status">
            <span>ℹ️</span> {successNotice}
          </div>
        )}

        {/* STEP 1: ENTER EMAIL */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="forgot-form">
            <div className="form-group mb-4">
              <label htmlFor="workerEmail">{t('worker.forgot.email_label', 'Registered Email Address')}</label>
              <div className="input-group-custom">
                <span className="input-icon">✉️</span>
                <input
                  id="workerEmail"
                  type="email"
                  className="form-control"
                  placeholder="technician@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-warning w-100 py-3 font-weight-bold" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  {t('worker.forgot.sending_code', 'Sending Code...')}
                </>
              ) : (
                `📨 ${t('worker.forgot.send_code_btn', 'Send Verification Code')}`
              )}
            </button>
          </form>
        )}

        {/* STEP 2: ENTER OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="forgot-form">
            <div className="otp-boxes-container">
              {otpBoxes.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  className="otp-box"
                  value={digit}
                  onChange={(e) => handleOtpBoxChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  disabled={loading}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <div className="otp-timer-row">
              <span className="timer-text">
                ⏱️ {t('worker.forgot.expires_in', 'Expires in')}: <strong>{formatTimer(otpExpiryTimer)}</strong>
              </span>

              <button
                type="button"
                className="btn-resend-link"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
              >
                {resendCooldown > 0
                  ? `${t('worker.forgot.resend_in', 'Resend in')} ${resendCooldown}s`
                  : t('worker.forgot.resend_now', 'Resend OTP')}
              </button>
            </div>

            <button type="submit" className="btn btn-warning w-100 py-3 font-weight-bold" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  {t('worker.forgot.verifying', 'Verifying...')}
                </>
              ) : (
                `🔐 ${t('worker.forgot.verify_otp_btn', 'Verify & Set Password')}`
              )}
            </button>
          </form>
        )}

        {/* STEP 3: NEW PASSWORD */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="forgot-form">
            <div className="form-group mb-3">
              <label>{t('worker.forgot.new_password', 'New Password')}</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder={t('worker.forgot.pass_req', 'At least 8 chars, 1 letter, 1 number')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="btn-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="form-group mb-4">
              <label>{t('worker.forgot.confirm_password', 'Confirm New Password')}</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder={t('worker.forgot.retype_pass', 'Retype new password')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <button type="submit" className="btn btn-warning w-100 py-3 font-weight-bold" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  {t('worker.forgot.saving', 'Updating Password...')}
                </>
              ) : (
                `💾 ${t('worker.forgot.save_btn', 'Save New Password')}`
              )}
            </button>
          </form>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 4 && (
          <div className="reset-success-box">
            <div className="success-icon">🎉</div>
            <h3>{t('worker.forgot.success_heading', 'Password Reset Successful')}</h3>
            <p>
              {t(
                'worker.forgot.success_desc',
                'Your credentials have been securely updated. You can now log into your provider console with your new password.'
              )}
            </p>
            <button
              onClick={() => navigate('/worker/login')}
              className="btn btn-warning w-100 py-3 font-weight-bold mt-3"
            >
              {t('worker.forgot.go_to_login', 'Sign In to Provider Portal')} →
            </button>
          </div>
        )}

        {/* Back Link */}
        <div className="forgot-footer">
          <Link to="/worker/login" className="back-link">
            ← {t('worker.forgot.back_to_login', 'Back to Provider Login')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WorkerForgotPassword;
