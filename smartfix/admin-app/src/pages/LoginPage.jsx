import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOtpFlow } from '../hooks/useOtpFlow';
import { usePhoneAuth } from '../hooks/usePhoneAuth';
import OtpInput from '../components/OtpInput';
import { Shield, Lock, Phone, ArrowRight, KeyRound, RotateCcw, CheckCircle2, Zap } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
  const { login, loginWithOtp, resetPassword } = useAuth();
  const navigate = useNavigate();
  
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'otp'
  const [form, setForm] = useState({ phone: '7604975206', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  // OTP flow hook
  const otpFlow = useOtpFlow(form.phone, 'login');

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotPhone, setForgotPhone] = useState('7604975206');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const forgotOtpFlow = useOtpFlow('7604975206', 'reset_password');

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPhone = form.phone.replace(/\D/g, '');
    if (!cleanPhone.endsWith('7604975206')) {
      setError('Access Denied: Only authorized mobile number 7604975206 can authenticate as Administrator.');
      return;
    }

    setLoading(true);
    try {
      await login(form.phone, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invalid credentials or access restriction');
    } finally {
      setLoading(false);
    }
  };

  const handleSendLoginOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessInfo('');

    const cleanPhone = form.phone.replace(/\D/g, '');
    if (!cleanPhone.endsWith('7604975206')) {
      setError('Access Denied: Only authorized mobile number 7604975206 can authenticate as Administrator.');
      return;
    }

    const sent = await otpFlow.sendOtp(form.phone, 'login');
    if (sent) {
      setSuccessInfo('Admin verification OTP code sent via Fast2SMS to +91 7604975206.');
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
    <div className="admin-login-page">
      <div className="login-glow" />
      <div className="login-box">
        <div className="login-icon"><Shield size={32} /></div>
        <h1>Admin Console</h1>
        <p>Restricted platform access. Authorized single administrator (7604975206) only.</p>

        {/* Dev Quota Notice Badge */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fbbf24',
          padding: '8px 12px', borderRadius: '10px', fontSize: '0.78rem', marginBottom: '14px',
          display: 'flex', gap: '8px', alignItems: 'center'
        }}>
          <Zap size={14} color="#fbbf24" style={{ flexShrink: 0 }} />
          <span><strong>Firebase Testing Phase:</strong> Free plan limit is 10 SMS/day. Use test numbers or Password Login.</span>
        </div>

        <div id="recaptcha-container"></div>

        {/* Dual Mode Switcher */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', background: 'rgba(255, 255, 255, 0.05)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <button
            type="button"
            style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
              background: loginMethod === 'password' ? 'var(--primary, #3b82f6)' : 'transparent',
              color: '#ffffff',
            }}
            onClick={() => { setLoginMethod('password'); setError(''); }}
          >
            Password Login
          </button>
          <button
            type="button"
            style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer',
              background: loginMethod === 'otp' ? 'var(--primary, #3b82f6)' : 'transparent',
              color: '#ffffff',
            }}
            onClick={() => { setLoginMethod('otp'); setError(''); otpFlow.resetFlow(); }}
          >
            📱 OTP Login
          </button>
        </div>

        {loginMethod === 'password' ? (
          <form onSubmit={handlePasswordLogin} className="login-form">
            <div className="form-group">
              <label className="form-label">Authorized Admin Phone</label>
              <div className="input-wrap">
                <Phone size={16} className="input-icon" />
                <input type="text" className="form-input" placeholder="7604975206"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="form-label" style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                  onClick={() => { setShowForgotModal(true); setForgotStep(1); setForgotPhone(form.phone); forgotOtpFlow.resetFlow(); setError(''); }}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="input-wrap">
                <Lock size={16} className="input-icon" />
                <input type="password" className="form-input" placeholder="Enter admin password"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? 'Authenticating...' : <><Shield size={16} /> Access Console <ArrowRight size={16} /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={otpFlow.step === 1 ? handleSendLoginOtp : handleVerifyLoginOtp} className="login-form">
            {otpFlow.step === 1 ? (
              <>
                <div className="form-group">
                  <label className="form-label">Authorized Admin Phone</label>
                  <div className="input-wrap">
                    <Phone size={16} className="input-icon" />
                    <input type="text" className="form-input" placeholder="7604975206"
                      value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required autoFocus />
                  </div>
                </div>

                {otpFlow.error && <div className="error-box">{otpFlow.error}</div>}

                <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={otpFlow.loading}>
                  {otpFlow.loading ? 'Sending OTP...' : <><Phone size={16} /> Send Admin OTP Code 📲</>}
                </button>
              </>
            ) : (
              <>
                {successInfo && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <CheckCircle2 size={16} /> <span>{successInfo}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ textAlign: 'center', display: 'block', color: '#e2e8f0' }}>Enter 6-Digit Admin OTP Code</label>
                  <OtpInput value={otpFlow.otp} onChange={otpFlow.setOtp} error={!!error || !!otpFlow.error} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', fontSize: '0.85rem' }}>
                  {otpFlow.canResend ? (
                    <button type="button" onClick={handleSendLoginOtp} style={{ background: 'none', border: 'none', color: '#60a5fa', fontWeight: '600', cursor: 'pointer', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <RotateCcw size={13} /> Resend OTP
                    </button>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Resend in <strong>{otpFlow.timer}s</strong></span>
                  )}
                  <button type="button" onClick={() => otpFlow.resetFlow()} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>Change Phone</button>
                </div>

                {(error || otpFlow.error) && <div className="error-box">{error || otpFlow.error}</div>}

                <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || otpFlow.loading}>
                  {loading ? 'Verifying...' : <><Shield size={16} /> Verify OTP & Access Console 🚀</>}
                </button>
              </>
            )}
          </form>
        )}

        <div className="login-footer">
          <span>HandyBook Administration Panel</span>
          <span>Authorized: 7604975206</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', borderRadius: '20px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeyRound size={20} color="#60a5fa" /> Reset Admin Password
              </h3>
              <button type="button" onClick={() => setShowForgotModal(false)} style={{ background: '#334155', color: '#f8fafc', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            {forgotStep === 1 && (
              <form onSubmit={handleSendForgotOtp}>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '14px', lineHeight: '1.4' }}>
                  Enter authorized admin mobile phone number to receive a Reset OTP code.
                </p>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ color: '#cbd5e1' }}>Admin Phone</label>
                  <input type="tel" className="form-input" placeholder="7604975206" value={forgotPhone} onChange={(e) => setForgotPhone(e.target.value)} required />
                </div>
                {forgotOtpFlow.error && <div className="error-box" style={{ marginBottom: '14px' }}>{forgotOtpFlow.error}</div>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" style={{ background: '#334155', color: '#cbd5e1' }} onClick={() => setShowForgotModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={forgotOtpFlow.loading}>{forgotOtpFlow.loading ? 'Sending...' : 'Send Reset OTP 📲'}</button>
                </div>
              </form>
            )}

            {forgotStep === 2 && (
              <form onSubmit={handleVerifyForgotOtp}>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '14px', lineHeight: '1.4' }}>
                  Enter the 6-digit Reset OTP code sent to +91 {forgotPhone}.
                </p>
                <OtpInput value={forgotOtp} onChange={setForgotOtp} error={!!forgotOtpFlow.error} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', fontSize: '0.85rem' }}>
                  {forgotOtpFlow.canResend ? (
                    <button type="button" onClick={handleSendForgotOtp} style={{ background: 'none', border: 'none', color: '#60a5fa', fontWeight: '600', cursor: 'pointer' }}>Resend OTP</button>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Resend in <strong>{forgotOtpFlow.timer}s</strong></span>
                  )}
                </div>
                {forgotOtpFlow.error && <div className="error-box" style={{ marginBottom: '14px' }}>{forgotOtpFlow.error}</div>}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" style={{ background: '#334155', color: '#cbd5e1' }} onClick={() => setForgotStep(1)}>Back</button>
                  <button type="submit" className="btn btn-primary" disabled={forgotOtpFlow.loading}>{forgotOtpFlow.loading ? 'Verifying...' : 'Verify OTP 🚀'}</button>
                </div>
              </form>
            )}

            {forgotStep === 3 && (
              <form onSubmit={handleResetPasswordSubmit}>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '14px', lineHeight: '1.4' }}>
                  Verification successful! Set new Admin account password.
                </p>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ color: '#cbd5e1' }}>New Password</label>
                  <input type="password" className="form-input" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ color: '#cbd5e1' }}>Confirm New Password</label>
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
