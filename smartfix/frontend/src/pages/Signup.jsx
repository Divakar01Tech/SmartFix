import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Signup.css';

const Signup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setToken, setUser } = useAuth();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Step 2 state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(300); // 5 mins = 300s
  const [resendCooldown, setResendCooldown] = useState(60);
  const [attempts, setAttempts] = useState(5);
  const otpRefs = useRef([]);

  // Step 3 state
  const [signupToken, setSignupToken] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [stateName, setStateName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  useEffect(() => {
    let timer;
    if (step === 2 && resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, resendCooldown]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setError(t('signup.emailRequired', 'Email is required.'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiService.sendEmailOtp(email);
      setStep(2);
      setCountdown(300);
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
    } catch (err) {
      setError(err.message || t('signup.emailError', 'Failed to send OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next box
    if (value && index < 5) {
      otpRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setError(t('signup.invalidOtpLength', 'Please enter a 6-digit OTP.'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiService.verifyEmailOtp(email, otpValue);
      setSignupToken(res.signupToken);
      setStep(3);
    } catch (err) {
      setError(err.message || t('signup.otpVerifyError', 'Invalid OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = () => {
    handleSendOtp({ preventDefault: () => {} });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validations
    if (password !== confirmPassword) {
      setError(t('signup.passwordMismatch', 'Passwords do not match.'));
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError(t('signup.passwordWeak', 'Password must be at least 8 characters with letters and numbers.'));
      return;
    }
    if (address.length < 10) {
      setError(t('signup.addressShort', 'Address must be at least 10 characters long.'));
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError(t('signup.invalidPhone', 'Please enter a valid 10-digit mobile number.'));
      return;
    }
    if (!district || !stateName) {
      setError(t('signup.locationRequired', 'District and State are required.'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiService.emailRegister(
        { phone, password, confirmPassword, address, district, state: stateName },
        signupToken
      );
      
      // Save auth token and user
      localStorage.setItem('token', res.token);
      setToken(res.token);
      setUser(res.user);
      
      // Redirect to dashboard
      navigate('/customer-dashboard');
    } catch (err) {
      if (err.response?.status === 401) {
        // Token expired
        setError(t('signup.sessionExpired', 'Session expired. Please start over.'));
        setStep(1);
        setSignupToken('');
      } else {
        setError(err.message || t('signup.registerError', 'Registration failed.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="signup-container py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-6 col-lg-5">
            <div className="card shadow-sm border-0 rounded-4 signup-card">
              <div className="card-body p-4 p-md-5">
                <h2 className="text-center mb-4 fw-bold text-primary">
                  {t('signup.title', 'Join SmartFix')}
                </h2>
                
                {error && <div className="alert alert-danger p-2 mb-4 fs-6">{error}</div>}

                {/* STEP 1: Email */}
                {step === 1 && (
                  <form onSubmit={handleSendOtp}>
                    <p className="text-muted text-center mb-4">
                      {t('signup.emailPrompt', 'Enter your email to get started.')}
                    </p>
                    <div className="mb-4">
                      <label className="form-label fw-semibold">{t('signup.email', 'Email Address')}</label>
                      <input 
                        type="email" 
                        className="form-control form-control-lg" 
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg w-100" disabled={loading}>
                      {loading ? (
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      ) : null}
                      {t('signup.sendOtp', 'Send OTP')}
                    </button>
                    <div className="text-center mt-4">
                      <small className="text-muted">
                        {t('signup.haveAccount', 'Already have an account?')} <a href="/login" className="text-decoration-none fw-semibold">{t('signup.login', 'Log in')}</a>
                      </small>
                    </div>
                  </form>
                )}

                {/* STEP 2: OTP */}
                {step === 2 && (
                  <form onSubmit={handleVerifyOtp}>
                    <p className="text-center mb-1 fw-medium">
                      {t('signup.otpSentTo', 'OTP sent to')} <strong>{email}</strong>
                    </p>
                    <div className="text-center mb-4">
                      <button type="button" className="btn btn-link btn-sm text-decoration-none" onClick={() => setStep(1)}>
                        {t('signup.changeEmail', 'Change email')}
                      </button>
                    </div>

                    <div className="d-flex justify-content-between mb-4">
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => (otpRefs.current[index] = el)}
                          type="text"
                          maxLength="1"
                          className="form-control text-center fs-4 mx-1 otp-input"
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          disabled={loading}
                        />
                      ))}
                    </div>

                    <div className="text-center mb-4">
                      {countdown > 0 ? (
                        <small className="text-danger fw-semibold">{t('signup.expiresIn', 'Expires in')}: {formatTime(countdown)}</small>
                      ) : (
                        <small className="text-danger fw-semibold">{t('signup.expired', 'OTP Expired')}</small>
                      )}
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg w-100 mb-3" disabled={loading || countdown === 0}>
                      {loading ? (
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      ) : null}
                      {t('signup.verify', 'Verify')}
                    </button>

                    <div className="text-center">
                      <button 
                        type="button" 
                        className="btn btn-light w-100" 
                        disabled={resendCooldown > 0 || loading}
                        onClick={handleResendOtp}
                      >
                        {resendCooldown > 0 
                          ? `${t('signup.resendIn', 'Resend in')} ${resendCooldown}s` 
                          : t('signup.resendOtp', 'Resend OTP')}
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP 3: Profile Details */}
                {step === 3 && (
                  <form onSubmit={handleProfileSubmit}>
                    <div className="text-center mb-4">
                      <h4 className="fw-bold">{t('signup.completeProfile', 'Complete your profile')}</h4>
                      <small className="text-success fw-semibold"><i className="bi bi-check-circle-fill me-1"></i> {t('signup.emailVerified', 'Email Verified')}</small>
                      <br />
                      <small className="text-muted" style={{fontSize: '0.8rem'}}>
                        <i className="bi bi-shield-lock me-1"></i> {t('signup.privacyNote', 'Your details are private and will not be shown to other users.')}
                      </small>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-medium">{t('signup.phone', 'Phone Number')}</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-muted">+91</span>
                        <input 
                          type="tel" 
                          className="form-control" 
                          placeholder="10-digit mobile number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                          maxLength="10"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-medium">{t('signup.password', 'Password')}</label>
                      <div className="input-group">
                        <input 
                          type={showPassword ? 'text' : 'password'} 
                          className="form-control" 
                          placeholder="Min 8 chars, letters & numbers"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading}
                        />
                        <button 
                          className="btn btn-outline-secondary" 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex="-1"
                        >
                          <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                        </button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-medium">{t('signup.confirmPassword', 'Confirm Password')}</label>
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        className={`form-control ${confirmPassword && (password === confirmPassword ? 'is-valid' : 'is-invalid')}`} 
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-medium">{t('signup.address', 'Full Address')}</label>
                      <textarea 
                        className="form-control" 
                        rows="2" 
                        placeholder="Door no, Street, Area..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required
                        disabled={loading}
                      ></textarea>
                    </div>

                    <div className="row mb-4">
                      <div className="col-6">
                        <label className="form-label fw-medium">{t('signup.district', 'District')}</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="E.g. Chennai"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label fw-medium">{t('signup.state', 'State')}</label>
                        <input 
                          type="text" 
                          className="form-control" 
                          placeholder="E.g. Tamil Nadu"
                          value={stateName}
                          onChange={(e) => setStateName(e.target.value)}
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg w-100" disabled={loading || !phone || !password || !address || !district || !stateName || password !== confirmPassword}>
                      {loading ? (
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      ) : null}
                      {t('signup.completeRegistration', 'Complete Registration')}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
