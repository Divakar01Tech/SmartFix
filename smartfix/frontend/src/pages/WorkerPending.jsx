import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import './WorkerPending.css';

const WorkerPending = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [worker, setWorker] = useState(() => {
    try {
      const stored = localStorage.getItem('smartfix_worker');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState('');

  const checkStatus = async () => {
    setRefreshing(true);
    setNotification('');
    try {
      const fresh = await apiService.workerGetMe();
      if (fresh) {
        setWorker(fresh);
        localStorage.setItem('smartfix_worker', JSON.stringify(fresh));

        const status = (fresh.verificationStatus || '').toLowerCase();
        if (status === 'approved') {
          navigate('/worker/dashboard');
          return;
        } else if (status === 'rejected') {
          navigate('/worker/rejected');
          return;
        } else if (status === 'suspended') {
          setNotification(t('worker.pending.suspended_msg', 'Your account has been suspended. Please contact support.'));
        } else {
          setNotification(t('worker.pending.still_pending', 'Your profile is currently in the verification queue. Please check back shortly.'));
        }
      }
    } catch (err) {
      setNotification(err.message || 'Unable to refresh status. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleLogout = async () => {
    await apiService.workerLogout();
    localStorage.removeItem('smartfix_worker_token');
    localStorage.removeItem('smartfix_worker');
    localStorage.removeItem('smartfix_token');
    localStorage.removeItem('smartfix_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/worker/login');
  };

  const categories = worker?.categories || [];

  return (
    <div className="worker-pending-container">
      <div className="worker-pending-card">
        {/* Top Header */}
        <div className="pending-badge-row">
          <span className="badge-pulse">⏳</span>
          <span className="badge-text">{t('worker.pending.badge', 'Verification in Progress')}</span>
        </div>

        <h1 className="pending-title">{t('worker.pending.title', 'Application Under Review')}</h1>
        <p className="pending-desc">
          {t(
            'worker.pending.desc',
            'Thank you for applying to join SmartFix. Our administrative team is reviewing your KYC documentation and AI interview results.'
          )}
        </p>

        {/* Worker Summary Banner */}
        <div className="worker-info-banner">
          <div className="info-item">
            <span className="info-label">{t('worker.pending.technician', 'Provider Name')}:</span>
            <span className="info-value">{worker?.fullName || worker?.name || 'Technician'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('worker.pending.email', 'Email')}:</span>
            <span className="info-value">{worker?.email || '—'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('worker.pending.district', 'District / Location')}:</span>
            <span className="info-value">{worker?.district || 'Sivagangai'}, {worker?.state || 'Tamil Nadu'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">{t('worker.pending.categories', 'Services')}:</span>
            <span className="info-value category-pills">
              {categories.length > 0 ? (
                categories.map((c, i) => (
                  <span key={i} className="cat-pill">{c}</span>
                ))
              ) : (
                <span>General Services</span>
              )}
            </span>
          </div>
        </div>

        {/* 4 Steps Verification Tracker */}
        <div className="verification-tracker">
          <h3 className="tracker-heading">{t('worker.pending.tracker_title', 'Onboarding Steps Completed')}</h3>

          <div className="tracker-list">
            {/* Step 1 */}
            <div className="tracker-step done">
              <div className="step-icon">✅</div>
              <div className="step-content">
                <h4>{t('worker.pending.step1_title', '1. Email Verification')}</h4>
                <p>{t('worker.pending.step1_desc', 'One-time passcode (OTP) verified successfully.')}</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="tracker-step done">
              <div className="step-icon">✅</div>
              <div className="step-content">
                <h4>{t('worker.pending.step2_title', '2. Basic Profile & Location')}</h4>
                <p>{t('worker.pending.step2_desc', 'Contact info, address, and service categories configured.')}</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="tracker-step done">
              <div className="step-icon">✅</div>
              <div className="step-content">
                <h4>{t('worker.pending.step3_title', '3. Government KYC Upload')}</h4>
                <p>
                  {t(
                    'worker.pending.step3_desc',
                    'Aadhaar card (front & back) and secondary ID securely stored for compliance review.'
                  )}
                </p>
                {worker?.kyc?.aadhaarLast4 && (
                  <span className="tracker-meta">
                    🔒 Aadhaar: XXXX-XXXX-{worker.kyc.aadhaarLast4}
                  </span>
                )}
              </div>
            </div>

            {/* Step 4 */}
            <div className="tracker-step done">
              <div className="step-icon">✅</div>
              <div className="step-content">
                <h4>{t('worker.pending.step4_title', '4. AI Skill Assessment Interview')}</h4>
                <p>
                  {t(
                    'worker.pending.step4_desc',
                    'Technical proficiency evaluated on safety, diagnostic logic, and communication.'
                  )}
                </p>
                {worker?.interview?.aiVerdict && (
                  <span className={`ai-verdict-tag ${worker.interview.aiVerdict}`}>
                    AI Recommendation: {worker.interview.aiVerdict.toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Step 5: Final Review */}
            <div className="tracker-step current">
              <div className="step-icon">🔍</div>
              <div className="step-content">
                <h4>{t('worker.pending.step5_title', '5. SmartFix Admin Review (Final Decision)')}</h4>
                <p>
                  {t(
                    'worker.pending.step5_desc',
                    'Our verification team is cross-checking your credentials. You will receive an email upon approval.'
                  )}
                </p>
                <span className="sla-badge">⏱️ {t('worker.pending.sla', 'Estimated time: 24 - 48 Hours')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security / Non-Dispatch Alert */}
        <div className="security-notice">
          <span className="notice-icon">🛡️</span>
          <div>
            <strong>{t('worker.pending.gated_title', 'Dispatch Console Locked')}</strong>
            <p>
              {t(
                'worker.pending.gated_desc',
                'In accordance with SmartFix safety policies, customer bookings, live GPS tracking, and payout features remain locked until an Admin approves your profile.'
              )}
            </p>
          </div>
        </div>

        {notification && (
          <div className="pending-notification" role="status">
            <span>ℹ️</span> {notification}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pending-actions">
          <button
            onClick={checkStatus}
            disabled={refreshing}
            className="btn btn-refresh-status"
          >
            {refreshing ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {t('worker.pending.checking', 'Checking Status...')}
              </>
            ) : (
              `🔄 ${t('worker.pending.refresh_btn', 'Refresh Verification Status')}`
            )}
          </button>

          <button onClick={handleLogout} className="btn btn-worker-logout">
            🚪 {t('worker.pending.logout_btn', 'Sign Out')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkerPending;
