import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOtpFlow } from '../hooks/useOtpFlow';
import { usePhoneAuth } from '../hooks/usePhoneAuth';
import OtpInput from '../components/OtpInput';
import { Phone, Lock, Eye, EyeOff, Zap, ArrowRight, Wrench, ChevronDown, FileCheck, KeyRound, RotateCcw, CheckCircle2, ShieldCheck } from 'lucide-react';
import './LoginPage.css';

const TRADES = [
  'Plumbing', 'Electrical Repairs', 'AC Service & Repair',
  'Refrigerator Repair', 'Washing Machine Repair',
  'Water Purifier Service', 'Carpentry', 'Painting', 'Cleaning', 'Other',
];

const ID_TYPES = [
  { value: 'driving_license', label: 'Driving License' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'pan_card', label: 'PAN Card' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithOtp, register, resetPassword } = useAuth();
  
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'otp'
  
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    trade: 'Plumbing',
    ratePerHour: '',
    aadhaarNumber: '',
    aadhaarDocUrl: '',
    idProofType: 'driving_license',
    idProofNumber: '',
    idProofDocUrl: '',
  });

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  // Hooks for OTP flows
  const otpFlow = useOtpFlow(form.phone, 'login');
  const [registerStep, setRegisterStep] = useState(1); // 1 = Details, 2 = Verify OTP

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const forgotOtpFlow = useOtpFlow('', 'reset_password');

  // Password Login Handler
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.phone, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  // OTP Login Handlers
  const handleSendLoginOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessInfo('');
    const sent = await otpFlow.sendOtp(form.phone, 'login');
    if (sent) {
      setSuccessInfo('If this number is registered, an OTP code has been sent via SMS.');
    }
  };

  const handleVerifyLoginOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await loginWithOtp(form.phone, otpFlow.otp);
      if (user) {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Provider Registration KYC + OTP Handlers
  const handleStartRegisterOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessInfo('');

    const cleanAadhaar = form.aadhaarNumber.replace(/\D/g, '');
    if (cleanAadhaar.length !== 12) {
      setError('Aadhaar Card number must be exactly 12 digits.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    const sent = await otpFlow.sendOtp(form.phone, 'register');
    if (sent) {
      setRegisterStep(2);
      setSuccessInfo(`Verification OTP sent to +91 ${form.phone}. Verify phone to complete registration.`);
    }
  };

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const verifyRes = await otpFlow.verifyOtp(otpFlow.otp, 'register');
      if (!verifyRes || !verifyRes.verified) {
        setError('OTP verification failed. Please try again.');
        setLoading(false);
        return;
      }

      await register({
        ...form,
        aadhaarNumber: form.aadhaarNumber.replace(/\D/g, ''),
        ratePerHour: Number(form.ratePerHour) || 350,
      });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password Handlers
  const handleSendForgotOtp = async (e) => {
    e.preventDefault();
    setError('');
    const sent = await forgotOtpFlow.sendOtp(forgotPhone, 'reset_password');
    if (sent) {
      setForgotStep(2);
    }
  };

  const handleVerifyForgotOtp = async (e) => {
    e.preventDefault();
    setError('');
    const res = await forgotOtpFlow.verifyOtp(forgotOtp, 'reset_password');
    if (res && res.verified) {
      setForgotStep(3);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(forgotPhone, forgotOtp, newPassword);
      setShowForgotModal(false);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left Panel */}
      <div className="login-left">
        <div className="login-hero">
          <div className="hero-badge"><Wrench size={14} /><span>Provider Portal</span></div>
          <h1>Start Earning<br />with HandyBook</h1>
          <p>Join our verified professional network. Fast2SMS OTP & KYC verification ensure trust & quality jobs.</p>
          <div className="hero-stats">
            {[
              { value: '₹25K+', label: 'Avg Monthly Earnings' },
              { value: '4.8★', label: 'Provider Rating' },
              { value: 'KYC & OTP Verified', label: '100% Secure Platform' },
            ].map((s) => (
              <div key={s.label} className="hero-stat">
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="login-right">
        <div className="login-card" style={{ maxWidth: mode === 'register' ? '480px' : '420px' }}>
          <div className="login-logo"><Zap size={22} fill="#0D0D1A" /></div>
          <h2>{mode === 'login' ? 'Provider Sign In' : 'Provider Sign Up & KYC'}</h2>
          <p className="subtitle">{mode === 'login' ? 'Sign in with Password or Firebase OTP' : 'Complete KYC and OTP verification to start'}</p>

          {/* Dev Quota Notice Badge */}
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
            padding: '8px 12px', borderRadius: '10px', fontSize: '0.78rem', marginBottom: '14px',
            display: 'flex', gap: '8px', alignItems: 'center'
          }}>
            <Zap size={14} color="#d97706" style={{ flexShrink: 0 }} />
            <span><strong>Firebase Testing Phase:</strong> Free plan limit is 10 SMS/day. Use test phone numbers or Password Login for testing.</span>
          </div>

          <div id="recaptcha-container"></div>

          <div className="mode-tabs">
            <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); setRegisterStep(1); }}>Sign In</button>
            <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(''); otpFlow.resetFlow(); setRegisterStep(1); }}>Register & Verification</button>
          </div>

          {mode === 'login' ? (
            <div>
              {/* Dual Option Switcher */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                <button
                  type="button"
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
                    background: loginMethod === 'password' ? '#ffffff' : 'transparent',
                    color: loginMethod === 'password' ? '#2563eb' : '#64748b',
                    boxShadow: loginMethod === 'password' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                  onClick={() => { setLoginMethod('password'); setError(''); }}
                >
                  Password Login
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
                    background: loginMethod === 'otp' ? '#ffffff' : 'transparent',
                    color: loginMethod === 'otp' ? '#2563eb' : '#64748b',
                    boxShadow: loginMethod === 'otp' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                  onClick={() => { setLoginMethod('otp'); setError(''); otpFlow.resetFlow(); }}
                >
                  📱 Login with OTP
                </button>
              </div>

              {loginMethod === 'password' ? (
                <form onSubmit={handlePasswordLogin}>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input type="tel" className="form-input" placeholder="+91 9876543210"
                      value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Password</label>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}
                        onClick={() => { setShowForgotModal(true); setForgotStep(1); setForgotPhone(form.phone); forgotOtpFlow.resetFlow(); setError(''); }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'} className="form-input" placeholder="••••••••"
                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                      <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {error && <div className="error-box">{error}</div>}

                  <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                    {loading ? 'Signing In...' : <>Sign In <ArrowRight size={18} /></>}
                  </button>
                </form>
              ) : (
                <form onSubmit={otpFlow.step === 1 ? handleSendLoginOtp : handleVerifyLoginOtp}>
                  {otpFlow.step === 1 ? (
                    <>
                      <div className="form-group">
                        <label className="form-label">Registered Phone Number</label>
                        <input type="tel" className="form-input" placeholder="+91 9876543210"
                          value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required autoFocus />
                      </div>
                      {otpFlow.error && <div className="error-box">{otpFlow.error}</div>}
                      <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={otpFlow.loading}>
                        {otpFlow.loading ? 'Sending Fast2SMS OTP...' : 'Send 6-Digit Login OTP 📲'}
                      </button>
                    </>
                  ) : (
                    <>
                      {successInfo && (
                        <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <CheckCircle2 size={16} /> <span>{successInfo}</span>
                        </div>
                      )}

                      <div className="form-group">
                        <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Enter 6-Digit OTP Code sent to +91 {form.phone}</label>
                        <OtpInput value={otpFlow.otp} onChange={otpFlow.setOtp} error={!!error || !!otpFlow.error} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '0.85rem' }}>
                        {otpFlow.canResend ? (
                          <button type="button" onClick={handleSendLoginOtp} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <RotateCcw size={13} /> Resend OTP
                          </button>
                        ) : (
                          <span style={{ color: '#64748b' }}>Resend in <strong>{otpFlow.timer}s</strong></span>
                        )}
                        <button type="button" onClick={() => otpFlow.resetFlow()} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>Change Phone</button>
                      </div>

                      {(error || otpFlow.error) && <div className="error-box">{error || otpFlow.error}</div>}

                      <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || otpFlow.loading}>
                        {loading ? 'Verifying...' : 'Verify OTP & Log In 🚀'}
                      </button>
                    </>
                  )}
                </form>
              )}
            </div>
          ) : (
            /* Provider Registration Flow */
            <form onSubmit={registerStep === 1 ? handleStartRegisterOtp : handleCompleteRegistration}>
              {registerStep === 1 ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input type="text" className="form-input" placeholder="Enter your full legal name"
                      value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number (+91)</label>
                    <input type="tel" className="form-input" placeholder="+91 9876543210"
                      value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPass ? 'text' : 'password'} className="form-input" placeholder="••••••••"
                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
                      <button type="button" className="eye-btn" onClick={() => setShowPass(!showPass)}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Trade / Category</label>
                      <div style={{ position: 'relative' }}>
                        <select className="form-input" value={form.trade} onChange={e => setForm({ ...form, trade: e.target.value })}>
                          {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Hourly Rate (₹)</label>
                      <input type="number" className="form-input" placeholder="e.g. 350"
                        value={form.ratePerHour} onChange={e => setForm({ ...form, ratePerHour: e.target.value })} required />
                    </div>
                  </div>

                  {/* KYC Section */}
                  <div className="kyc-section-header mb-16 mt-8">
                    <FileCheck size={16} color="var(--primary)" />
                    <span>Mandatory Identity Verification (KYC)</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Aadhaar Card Number (12 Digits)</label>
                    <input type="text" className="form-input" maxLength={12} placeholder="12-digit Aadhaar Number"
                      value={form.aadhaarNumber} onChange={e => setForm({ ...form, aadhaarNumber: e.target.value })} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Aadhaar Card Document Image / Link</label>
                    <input type="text" className="form-input" placeholder="URL or document link to Aadhaar card image"
                      value={form.aadhaarDocUrl} onChange={e => setForm({ ...form, aadhaarDocUrl: e.target.value })} />
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Secondary ID Type</label>
                      <div style={{ position: 'relative' }}>
                        <select className="form-input" value={form.idProofType} onChange={e => setForm({ ...form, idProofType: e.target.value })}>
                          {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">ID Proof Number</label>
                      <input type="text" className="form-input" placeholder="License / Voter / PAN No."
                        value={form.idProofNumber} onChange={e => setForm({ ...form, idProofNumber: e.target.value })} required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Secondary ID Document Link</label>
                    <input type="text" className="form-input" placeholder="URL or document link to ID image"
                      value={form.idProofDocUrl} onChange={e => setForm({ ...form, idProofDocUrl: e.target.value })} />
                  </div>

                  {(error || otpFlow.error) && <div className="error-box">{error || otpFlow.error}</div>}

                  <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={otpFlow.loading}>
                    {otpFlow.loading ? 'Sending OTP...' : <>Proceed to Phone Verification 📲 <ArrowRight size={18} /></>}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '12px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '16px' }}>
                    <ShieldCheck size={16} inline style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    Verification OTP code sent to <strong>+91 {form.phone}</strong>. Verify phone number to complete Provider KYC & Account Creation.
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Enter 6-Digit Verification OTP</label>
                    <OtpInput value={otpFlow.otp} onChange={otpFlow.setOtp} error={!!error || !!otpFlow.error} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '0.85rem' }}>
                    {otpFlow.canResend ? (
                      <button type="button" onClick={handleStartRegisterOtp} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <RotateCcw size={13} /> Resend OTP
                      </button>
                    ) : (
                      <span style={{ color: '#64748b' }}>Resend in <strong>{otpFlow.timer}s</strong></span>
                    )}
                    <button type="button" onClick={() => setRegisterStep(1)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>Edit Registration Info</button>
                  </div>

                  {(error || otpFlow.error) && <div className="error-box">{error || otpFlow.error}</div>}

                  <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                    {loading ? 'Verifying & Submitting KYC...' : 'Verify OTP & Submit Provider Application 🚀'}
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} color="#2563eb" /> Reset Password
              </h3>
              <button type="button" onClick={() => setShowForgotModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            {forgotStep === 1 && (
              <form onSubmit={handleSendForgotOtp}>
                <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '14px', lineHeight: '1.4' }}>
                  Step 1: Enter your registered mobile phone number to receive a Reset OTP code.
                </p>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Phone Number</label>
                  <input type="tel" className="form-input" placeholder="+91 9876543210" value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value)} required />
                </div>
                {forgotOtpFlow.error && <div className="error-box" style={{ marginBottom: '14px' }}>{forgotOtpFlow.error}</div>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={() => setShowForgotModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={forgotOtpFlow.loading}>{forgotOtpFlow.loading ? 'Sending...' : 'Send Reset OTP 📲'}</button>
                </div>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleVerifyForgotOtp}>
                <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '14px', lineHeight: '1.4' }}>
                  Step 2: Enter the 6-digit OTP code sent to +91 {forgotPhone}.
                </p>
                <OtpInput value={forgotOtp} onChange={setForgotOtp} error={!!forgotOtpFlow.error} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', fontSize: '0.85rem' }}>
                  {forgotOtpFlow.canResend ? (
                    <button type="button" onClick={handleSendForgotOtp} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer' }}>Resend OTP</button>
                  ) : (
                    <span style={{ color: '#64748b' }}>Resend in <strong>{forgotOtpFlow.timer}s</strong></span>
                  )}
                </div>
                {forgotOtpFlow.error && <div className="error-box" style={{ marginBottom: '14px' }}>{forgotOtpFlow.error}</div>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={() => setForgotStep(1)}>Back</button>
                  <button type="submit" className="btn btn-primary" disabled={forgotOtpFlow.loading}>{forgotOtpFlow.loading ? 'Verifying...' : 'Verify OTP 🚀'}</button>
                </div>
              </form>
            )}

            {forgotStep === 3 && (
              <form onSubmit={handleResetPasswordSubmit}>
                <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '14px', lineHeight: '1.4' }}>
                  Step 3: Verification successful! Set your new account password.
                </p>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">New Password</label>
                  <input type="password" className="form-input" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" className="form-input" placeholder="Re-enter password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required />
                </div>
                {error && <div className="error-box" style={{ marginBottom: '14px' }}>{error}</div>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Updating...' : 'Update Password & Login 🔑'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
