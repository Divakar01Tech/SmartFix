import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { HOME_SERVICES } from '../data/servicesData';
import { Phone, Lock, User, Wrench, MapPin, ShieldCheck, KeyRound, RotateCcw, CheckCircle2, Globe } from 'lucide-react';
import OtpInput from '../components/OtpInput';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { user, login, register, sendOtp, verifyOtp, resetPassword } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [authMethod, setAuthMethod] = useState('otp'); // 'otp' | 'password'
  const [role, setRole] = useState('customer'); // 'customer' | 'handyman'
  const [otpStep, setOtpStep] = useState(1); // 1 = enter phone, 2 = enter OTP code
  const [otpCode, setOtpCode] = useState('');
  const [timer, setTimer] = useState(30);
  const [timerActive, setTimerActive] = useState(false);

  // Handyman sub-service selection state
  const [selectedSubServices, setSelectedSubServices] = useState([]);

  // Auto-redirect logged in users to their respective dashboards
  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (user?.role === 'handyman') {
      navigate('/handyman-dashboard', { replace: true });
    } else if (user?.role === 'customer') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter phone, 2 = enter OTP + new password
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    trade: 'Plumbing',
    location: 'Sivagangai Town',
    ratePerHour: '350',
    preferredLanguage: language || 'en',
    aadhaarNumber: '',
    idProofType: 'driving_license',
    idProofNumber: '',
  });

  // Get sub-services for currently selected trade
  const getSubServicesForTrade = (tradeName) => {
    const cat = HOME_SERVICES.find((c) => c.name === tradeName);
    return cat ? cat.subServices : [];
  };

  // Toggle a sub-service checkbox
  const handleSubServiceToggle = (sub) => {
    setSelectedSubServices((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  // Reset sub-services when trade changes
  const handleTradeChange = (e) => {
    handleChange(e);
    setSelectedSubServices([]);
  };

  // Countdown timer for resend OTP (60 seconds)
  useEffect(() => {
    let interval = null;
    if (timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    } else if (timer === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timer]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const validatePhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10 || (cleaned.length === 12 && cleaned.startsWith('91'));
  };

  const redirectByRole = (userRole) => {
    if (userRole === 'admin') {
      navigate('/admin');
    } else if (userRole === 'handyman') {
      navigate('/handyman-dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  // 1. Send OTP Request via Twilio Verify API
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessInfo('');

    if (!validatePhone(form.phone)) {
      setError('Enter a valid 10-digit Indian phone number (e.g. 9876543210)');
      return;
    }

    try {
      setSubmitting(true);
      const res = await sendOtp(form.phone, role, mode === 'signup' ? 'register' : 'login');
      setOtpStep(2);
      setTimer(60);
      setTimerActive(true);
      const formattedNumber = form.phone.startsWith('+') ? form.phone : `+91 ${form.phone.replace(/\D/g, '')}`;
      setSuccessInfo(res.message || `A 6-digit verification code has been sent via SMS to ${formattedNumber}.`);
    } catch (err) {
      setError(err.message || 'Failed to send OTP. Try again.');
    } finally {
      setSubmitting(false);
    }
  };


  // 2. Verify OTP Request
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessInfo('');

    if (!otpCode || otpCode.trim().length < 4) {
      setError('Please enter the 6-digit OTP code sent to your phone.');
      return;
    }

    try {
      setSubmitting(true);
      if (mode === 'signup') {
        // Step 2 for Signup: Verify OTP first via AuthContext (correct API URL + stores phoneVerifyToken)
        await verifyOtp({ phone: form.phone, purpose: 'register', otp: otpCode.trim() });
        setOtpStep(3);
        setSuccessInfo('✅ Mobile OTP Verified! Now set your account Password below to finish registration.');
      } else {
        // Step 2 for Login: Verify OTP and log in
        const payload = {
          phone: form.phone,
          otp: otpCode.trim(),
          role,
          name: form.name,
          trade: form.trade,
          location: form.location,
          ratePerHour: Number(form.ratePerHour) || 350,
          preferredLanguage: form.preferredLanguage,
        };
        const user = await verifyOtp(payload);
        if (user?.preferredLanguage) setLanguage(user.preferredLanguage);
        redirectByRole(user.role);
      }
    } catch (err) {
      setError(err.message || 'OTP verification failed. Check the code and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Complete Signup with Password Creation
  const handleCompleteSignupWithPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.password || form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please check and try again.');
      return;
    }

    try {
      setSubmitting(true);

      if (role === 'handyman' && selectedSubServices.length === 0) {
        setError('Please select at least one sub-service you offer.');
        setSubmitting(false);
        return;
      }

      if (role === 'handyman' && !/^\d{12}$/.test(form.aadhaarNumber.trim())) {
        setError('Please enter a valid 12-digit Aadhaar number (mandatory for worker accounts).');
        setSubmitting(false);
        return;
      }

      const payload = {
        name: form.name || (role === 'handyman' ? 'Service Partner' : 'SmartFix Customer'),
        phone: form.phone,
        password: form.password,
        role,
        preferredLanguage: form.preferredLanguage,
        ...(role === 'handyman' && {
          trade: form.trade,
          subServices: selectedSubServices,
          location: form.location || 'Unknown Location, Tamil Nadu',
          ratePerHour: Number(form.ratePerHour) || 350,
          aadhaarNumber: form.aadhaarNumber.trim(),
          idProofType: form.idProofType,
          idProofNumber: form.idProofNumber.trim(),
        }),
      };

      const user = await register(payload);
      if (user?.preferredLanguage) setLanguage(user.preferredLanguage);
      redirectByRole(user.role);
    } catch (err) {
      setError(err.message || 'Registration failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Password Authentication (Legacy fallback)
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validatePhone(form.phone)) {
      setError('Enter a valid 10-digit Indian phone number (e.g. 9876543210)');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setSubmitting(true);

      if (mode === 'login') {
        const user = await login(form.phone, form.password, role);
        if (user?.preferredLanguage) setLanguage(user.preferredLanguage);
        redirectByRole(user.role);
      } else {
        if (form.password !== form.confirmPassword) {
          setError('Passwords do not match');
          setSubmitting(false);
          return;
        }

        if (!form.name.trim()) {
          setError('Full name is required');
          setSubmitting(false);
          return;
        }

        if (role === 'handyman' && selectedSubServices.length === 0) {
          setError('Please select at least one sub-service you offer.');
          setSubmitting(false);
          return;
        }

        if (role === 'handyman' && !/^\d{12}$/.test(form.aadhaarNumber.trim())) {
          setError('Please enter a valid 12-digit Aadhaar number (mandatory for worker accounts).');
          setSubmitting(false);
          return;
        }

        const payload = {
          name: form.name,
          phone: form.phone,
          password: form.password,
          role,
          preferredLanguage: form.preferredLanguage,
          ...(role === 'handyman' && {
            trade: form.trade,
            subServices: selectedSubServices,
            location: form.location || 'Sivagangai, Tamil Nadu',
            ratePerHour: Number(form.ratePerHour) || 350,
            aadhaarNumber: form.aadhaarNumber.trim(),
            idProofType: form.idProofType,
            idProofNumber: form.idProofNumber.trim(),
          }),
        };

        const user = await register(payload);
        if (user?.preferredLanguage) setLanguage(user.preferredLanguage);
        redirectByRole(user.role);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Send Forgot Password OTP
  const handleSendForgotOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!validatePhone(forgotPhone)) {
      setError('Enter a valid 10-digit Indian phone number (e.g. 9876543210)');
      return;
    }

    try {
      setSubmitting(true);
      await sendOtp(forgotPhone, role);
      setForgotStep(2);
      setSuccessInfo(`A 6-digit reset code has been sent to +91 ${forgotPhone}.`);
    } catch (err) {
      setError(err.message || 'Failed to send Reset OTP. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Submit Password Reset
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!forgotOtp || forgotOtp.trim().length < 4) {
      setError('Please enter the 6-digit Reset OTP code.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const user = await resetPassword(forgotPhone, forgotOtp.trim(), newPassword);
      setShowForgotPassword(false);
      redirectByRole(user.role);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Check OTP and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Top Header */}
        <div className="auth-header">
          <div className="auth-icon-badge">
            <ShieldCheck size={32} color="#2563eb" />
          </div>
          <h1>{mode === 'login' ? 'Welcome to SmartFix' : 'Join SmartFix Network'}</h1>
          <p>
            {authMethod === 'otp'
              ? 'Instant Real-Time Mobile OTP Login & Registration'
              : 'Login or create account using Phone & Password'}
          </p>
        </div>

        {/* Auth Method Switcher Tabs */}
        <div className="auth-method-switcher">
          <button
            type="button"
            className={`method-btn ${authMethod === 'otp' ? 'active' : ''}`}
            onClick={() => {
              setAuthMethod('otp');
              setOtpStep(1);
              setError('');
              setSuccessInfo('');
            }}
          >
            <Phone size={14} /> Mobile OTP Login
          </button>
          <button
            type="button"
            className={`method-btn ${authMethod === 'password' ? 'active' : ''}`}
            onClick={() => {
              setAuthMethod('password');
              setError('');
              setSuccessInfo('');
            }}
          >
            <KeyRound size={14} /> Password Login
          </button>
        </div>

        {/* Role Toggle: Customer vs Handyman */}
        <div className="role-toggle">
          <button
            type="button"
            className={role === 'customer' ? 'active' : ''}
            onClick={() => setRole('customer')}
          >
            👤 Customer Account
          </button>
          <button
            type="button"
            className={role === 'handyman' ? 'active' : ''}
            onClick={() => setRole('handyman')}
          >
            🛠️ Handyman Pro
          </button>
        </div>

        {/* OTP Authentication Flow */}
        {authMethod === 'otp' ? (
          <div className="otp-auth-container">
            {otpStep === 1 ? (
              <form onSubmit={handleSendOtp} className="login-form">
                {mode === 'signup' && (
                  <div className="form-group">
                    <label><User size={15} /> Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Enter your full name"
                      required={mode === 'signup'}
                    />
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="form-group">
                    <label><Globe size={15} /> {t('select_language')}</label>
                    <select
                      name="preferredLanguage"
                      value={form.preferredLanguage}
                      onChange={(e) => {
                        handleChange(e);
                        setLanguage(e.target.value);
                      }}
                    >
                      <option value="en">English (Default)</option>
                      <option value="ta">தமிழ் (Tamil)</option>
                    </select>
                  </div>
                )}

                {mode === 'signup' && role === 'handyman' && (
                  <div className="handyman-fields-box">
                    <div className="form-group">
                      <label><Wrench size={15} /> Select Primary Trade</label>
                      <select name="trade" value={form.trade} onChange={handleTradeChange}>
                        {HOME_SERVICES.map((cat) => (
                          <option key={cat.id} value={cat.name}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px' }}>
                        <Wrench size={14} style={{ marginRight: '6px' }} />
                        Sub-Services Offered <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>* select all you offer</span>
                      </label>
                      <div className="subservice-checkbox-grid">
                        {getSubServicesForTrade(form.trade).map((sub) => (
                          <label key={sub} className={`subservice-checkbox-item ${selectedSubServices.includes(sub) ? 'checked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={selectedSubServices.includes(sub)}
                              onChange={() => handleSubServiceToggle(sub)}
                            />
                            <span>{sub}</span>
                          </label>
                        ))}
                      </div>
                      {selectedSubServices.length > 0 && (
                        <p style={{ fontSize: '0.78rem', color: '#059669', marginTop: '6px', marginBottom: 0 }}>
                          ✅ {selectedSubServices.length} sub-service{selectedSubServices.length > 1 ? 's' : ''} selected
                        </p>
                      )}
                    </div>

                    <div className="form-row-2">
                      <div className="form-group">
                        <label><MapPin size={15} /> Primary Location / Taluk</label>
                        <input
                          type="text"
                          name="location"
                          value={form.location}
                          onChange={handleChange}
                          placeholder="e.g. Sivagangai Town / Karaikudi"
                        />
                      </div>
                      <div className="form-group">
                        <label>Hourly Rate (₹/hr)</label>
                        <input
                          type="number"
                          name="ratePerHour"
                          value={form.ratePerHour}
                          onChange={handleChange}
                          placeholder="350"
                          min="100"
                        />
                      </div>
                    </div>

                    <div className="kyc-section-box">
                      <div className="kyc-section-label"><ShieldCheck size={14} /> KYC Verification (Mandatory)</div>
                      <div className="form-group">
                        <label>Aadhaar Card Number <span style={{ color: '#dc2626' }}>*</span></label>
                        <input
                          type="text"
                          name="aadhaarNumber"
                          value={form.aadhaarNumber}
                          onChange={handleChange}
                          placeholder="12-digit Aadhaar number"
                          maxLength={12}
                          required={role === 'handyman'}
                        />
                      </div>
                      <div className="form-row-2">
                        <div className="form-group">
                          <label>ID Proof Type</label>
                          <select name="idProofType" value={form.idProofType} onChange={handleChange}>
                            <option value="driving_license">Driving License</option>
                            <option value="voter_id">Voter ID</option>
                            <option value="pan_card">PAN Card</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>ID Proof Number</label>
                          <input
                            type="text"
                            name="idProofNumber"
                            value={form.idProofNumber}
                            onChange={handleChange}
                            placeholder="e.g. TN1234567890"
                          />
                        </div>
                      </div>
                      <p style={{ fontSize: '0.77rem', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
                        📋 Your account will be in <strong>Pending Verification</strong> until the Admin approves your KYC documents.
                      </p>
                    </div>
                  </div>
                )}

                {/* Mobile Phone Number Input Field (Always Required) */}
                <div className="form-group">
                  <label><Phone size={15} /> Mobile Number (+91)</label>
                  <div className="phone-input-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '12px', fontWeight: '700', color: '#475569' }}>
                      🇮🇳 +91
                    </span>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="Enter 10-digit mobile number (e.g. 9876543210)"
                      maxLength={10}
                      required
                      autoFocus
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                {error && <div className="login-error-alert">{error}</div>}

                <button type="submit" className="login-submit-btn" disabled={submitting}>
                  {submitting ? 'Sending Verification OTP...' : 'Send 6-Digit Verification OTP 📲'}
                </button>
              </form>
            ) : otpStep === 2 ? (
              <form onSubmit={handleVerifyOtp} className="login-form">
                {successInfo && (
                  <div className="otp-demo-alert">
                    <CheckCircle2 size={18} color="#059669" />
                    <div>
                      <strong>SMS OTP Sent Successfully!</strong>
                      <p>{successInfo}</p>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label><KeyRound size={15} /> Enter 6-Digit OTP Code</label>
                  <OtpInput value={otpCode} onChange={setOtpCode} error={!!error} />
                </div>

                <div className="otp-timer-bar">
                  {timerActive ? (
                    <span>Resend OTP in <strong>{timer}s</strong></span>
                  ) : (
                    <button type="button" className="resend-otp-btn" onClick={handleSendOtp}>
                      <RotateCcw size={13} /> Resend OTP Code
                    </button>
                  )}
                  <button type="button" className="change-phone-btn" onClick={() => setOtpStep(1)}>
                    Edit Phone Number
                  </button>
                </div>

                {error && <div className="login-error-alert">{error}</div>}

                <button type="submit" className="login-submit-btn" disabled={submitting}>
                  {submitting ? 'Verifying Code...' : (mode === 'signup' ? 'Verify OTP & Set Password 🚀' : 'Verify OTP & Log In 🚀')}
                </button>
              </form>
            ) : (
              /* Signup Step 3: Password Creation Form */
              <form onSubmit={handleCompleteSignupWithPassword} className="login-form">
                {successInfo && (
                  <div className="otp-demo-alert" style={{ background: '#ecfdf5', borderColor: '#6ee7b7', color: '#065f46' }}>
                    <CheckCircle2 size={18} color="#059669" />
                    <div>
                      <strong>Mobile Verified!</strong>
                      <p>{successInfo}</p>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label><Lock size={15} /> Create Password (min 6 chars)</label>
                  <input
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label><Lock size={15} /> Confirm Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                {error && <div className="login-error-alert">{error}</div>}

                <button type="submit" className="login-submit-btn" disabled={submitting}>
                  {submitting ? 'Creating Account...' : 'Complete Account Registration 🎉'}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Password Authentication Form */
          <form onSubmit={handlePasswordSubmit} className="login-form">
            {mode === 'signup' && (
              <div className="form-group">
                <label><User size={15} /> Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label><Phone size={15} /> Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g. 9876543210 or +919876543210"
                required
              />
            </div>

            <div className="form-group">
              <div className="label-with-action">
                <label><Lock size={15} /> Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="forgot-password-link-btn"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setForgotStep(1);
                      setForgotPhone(form.phone);
                      setError('');
                    }}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter password (min 6 characters)"
                required
              />
            </div>

            {mode === 'signup' && (
              <div className="form-group">
                <label><Lock size={15} /> Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  required
                />
              </div>
            )}

            {mode === 'signup' && role === 'handyman' && (
              <div className="handyman-fields-box">
                <div className="form-group">
                  <label><Wrench size={15} /> Select Primary Trade</label>
                  <select name="trade" value={form.trade} onChange={handleTradeChange}>
                    {HOME_SERVICES.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '8px' }}>
                    <Wrench size={14} style={{ marginRight: '6px' }} />
                    Sub-Services Offered <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>* select all you offer</span>
                  </label>
                  <div className="subservice-checkbox-grid">
                    {getSubServicesForTrade(form.trade).map((sub) => (
                      <label key={sub} className={`subservice-checkbox-item ${selectedSubServices.includes(sub) ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selectedSubServices.includes(sub)}
                          onChange={() => handleSubServiceToggle(sub)}
                        />
                        <span>{sub}</span>
                      </label>
                    ))}
                  </div>
                  {selectedSubServices.length > 0 && (
                    <p style={{ fontSize: '0.78rem', color: '#059669', marginTop: '6px', marginBottom: 0 }}>
                      ✅ {selectedSubServices.length} sub-service{selectedSubServices.length > 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label><MapPin size={15} /> Primary Location / Taluk</label>
                    <input
                      type="text"
                      name="location"
                      value={form.location}
                      onChange={handleChange}
                      placeholder="e.g. Sivagangai Town / Karaikudi"
                    />
                  </div>
                  <div className="form-group">
                    <label>Hourly Rate (₹/hr)</label>
                    <input
                      type="number"
                      name="ratePerHour"
                      value={form.ratePerHour}
                      onChange={handleChange}
                      placeholder="350"
                      min="100"
                    />
                  </div>
                </div>

                <div className="kyc-section-box">
                  <div className="kyc-section-label"><ShieldCheck size={14} /> KYC Verification (Mandatory)</div>
                  <div className="form-group">
                    <label>Aadhaar Card Number <span style={{ color: '#dc2626' }}>*</span></label>
                    <input
                      type="text"
                      name="aadhaarNumber"
                      value={form.aadhaarNumber}
                      onChange={handleChange}
                      placeholder="12-digit Aadhaar number"
                      maxLength={12}
                    />
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>ID Proof Type</label>
                      <select name="idProofType" value={form.idProofType} onChange={handleChange}>
                        <option value="driving_license">Driving License</option>
                        <option value="voter_id">Voter ID</option>
                        <option value="pan_card">PAN Card</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>ID Proof Number</label>
                      <input
                        type="text"
                        name="idProofNumber"
                        value={form.idProofNumber}
                        onChange={handleChange}
                        placeholder="e.g. TN1234567890"
                      />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.77rem', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>
                    📋 Your account will be in <strong>Pending Verification</strong> until the Admin approves your KYC documents.
                  </p>
                </div>
              </div>
            )}

            {error && <div className="login-error-alert">{error}</div>}

            <button type="submit" className="login-submit-btn" disabled={submitting}>
              {submitting
                ? 'Authenticating...'
                : mode === 'login'
                ? `Login as ${role === 'handyman' ? 'Handyman' : 'Customer'}`
                : `Create ${role === 'handyman' ? 'Handyman' : 'Customer'} Account`}
            </button>
          </form>
        )}

        {/* Footer Toggle Switch */}
        <div className="auth-footer-switcher">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button type="button" className="link-switch-btn" onClick={() => setMode('signup')}>
                Sign up now
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button type="button" className="link-switch-btn" onClick={() => setMode('login')}>
                Log in here
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="payment-modal-overlay" onClick={() => setShowForgotPassword(false)}>
          <div
            className="payment-modal-content forgot-modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '92%', padding: '24px' }}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={22} color="#2563eb" /> Reset Forgot Password
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleSendForgotOtp}>
                <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '16px', lineHeight: '1.5' }}>
                  Enter your registered phone number to receive a 6-digit Reset OTP.
                </p>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label><Phone size={15} /> Registered Phone Number</label>
                  <input
                    type="tel"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    placeholder="Enter 10-digit phone number"
                    required
                  />
                </div>

                {error && <div className="login-error-alert" style={{ marginBottom: '16px' }}>{error}</div>}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#ffffff', fontWeight: '600', cursor: 'pointer' }}
                  >
                    {submitting ? 'Sending OTP...' : 'Send Reset OTP 📲'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit}>
                <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '16px', lineHeight: '1.5' }}>
                  Enter the 6-digit OTP code sent to <strong>{forgotPhone}</strong> and set your new password.
                </p>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label><KeyRound size={15} /> 6-Digit Reset OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value)}
                    placeholder="Enter code (e.g. 123456)"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label><Lock size={15} /> New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 chars)"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label><Lock size={15} /> Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                  />
                </div>

                {error && <div className="login-error-alert" style={{ marginBottom: '16px' }}>{error}</div>}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#059669', color: '#ffffff', fontWeight: '600', cursor: 'pointer' }}
                  >
                    {submitting ? 'Updating...' : 'Reset Password & Login 🚀'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
