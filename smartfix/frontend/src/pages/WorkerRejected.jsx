import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { getPortalUser, setPortalAuth, clearPortalAuth } from '../utils/authStorage';
import './WorkerRejected.css';

const WorkerRejected = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [worker, setWorker] = useState(() => {
    try {
      return getPortalUser('worker') || null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'retake_interview'
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Interview state for retake
  const [interviewSession, setInterviewSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [interviewLoading, setInterviewLoading] = useState(false);

  // Load fresh status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const fresh = await apiService.workerGetMe();
        if (fresh) {
          setWorker(fresh);
          setPortalAuth('worker', null, fresh);
          const st = (fresh.verificationStatus || '').toLowerCase();
          if (st === 'approved' || st === 'verified' || fresh.isApproved === true) {
            navigate('/worker/dashboard');
          } else if (st === 'pending_verification' || st === 'pending') {
            navigate('/worker/pending');
          }
        }
      } catch (e) {}
    };
    fetchStatus();
  }, [navigate]);

  // Start Interview Retake
  const startRetakeInterview = async () => {
    setInterviewLoading(true);
    setErrorMessage('');
    const primaryCat = (worker?.categories && worker.categories[0]) || 'General Maintenance';
    const lang = i18n.language === 'ta' ? 'ta' : 'en';

    try {
      const res = await apiService.workerInterviewStart(primaryCat, lang);
      if (res.success) {
        setInterviewSession(res);
        setMessages([
          {
            sender: 'ai',
            text: res.openingQuestion || t('worker.interview.welcome', 'Welcome! Let us begin your technical skill evaluation.'),
          },
        ]);
        setActiveTab('retake_interview');
      } else {
        setErrorMessage(res.message || 'Unable to initialize interview.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to start interview.');
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleSendInterviewAnswer = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || !interviewSession || interviewLoading) return;

    const answer = userInput.trim();
    setUserInput('');
    setMessages((prev) => [...prev, { sender: 'worker', text: answer }]);
    setInterviewLoading(true);

    try {
      const lang = i18n.language === 'ta' ? 'ta' : 'en';
      const res = await apiService.workerInterviewAnswer(interviewSession.sessionId, answer, lang);

      if (res.isCompleted) {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: `🎯 Interview Completed! AI Recommendation: ${res.verdict.toUpperCase()}`,
          },
        ]);
        setSuccessMessage('Interview completed and submitted for Admin verification.');
        // Update status to pending_verification
        setTimeout(async () => {
          try {
            const fresh = await apiService.workerGetMe();
            if (fresh) localStorage.setItem('smartfix_worker', JSON.stringify(fresh));
          } catch (e) {}
          navigate('/worker/pending');
        }, 2000);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            sender: 'ai',
            text: res.nextQuestion,
          },
        ]);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit answer.');
    } finally {
      setInterviewLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.workerLogout();
    } catch (e) {}
    clearPortalAuth('worker');
    navigate('/worker/login');
  };

  return (
    <div className="worker-rejected-container">
      <div className="worker-rejected-card">
        {/* Header Badge */}
        <div className="rejected-badge-row">
          <span className="badge-icon">⚠️</span>
          <span className="badge-text">{t('worker.rejected.badge', 'Verification Action Required')}</span>
        </div>

        <h1 className="rejected-title">{t('worker.rejected.title', 'Application Not Approved')}</h1>
        <p className="rejected-desc">
          {t(
            'worker.rejected.subtitle',
            'Our compliance team was unable to approve your application based on the submitted records. Please review the feedback below.'
          )}
        </p>

        {/* Reason Box */}
        <div className="rejection-reason-box">
          <div className="reason-header">
            <span className="reason-label">{t('worker.rejected.reason_heading', 'Reason for Non-Approval')}:</span>
            <span className="reviewed-meta">
              {worker?.reviewedAt ? new Date(worker.reviewedAt).toLocaleDateString() : 'Recent Review'}
            </span>
          </div>
          <p className="reason-text">
            "{worker?.rejectionReason || t('worker.rejected.default_reason', 'KYC identity proof was unclear or AI technical evaluation did not meet minimum safety thresholds.')}"
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="rejected-tabs">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📋 {t('worker.rejected.tab_actions', 'Status Overview')}
          </button>
          <button
            className={`tab-btn ${activeTab === 'retake_interview' ? 'active' : ''}`}
            onClick={() => {
              if (!interviewSession) startRetakeInterview();
              else setActiveTab('retake_interview');
            }}
          >
            🤖 {t('worker.rejected.tab_interview', 'Retake Skill Interview')}
          </button>
        </div>

        {errorMessage && (
          <div className="alert-banner error" role="alert">
            <span>❌</span> {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="alert-banner success" role="status">
            <span>✅</span> {successMessage}
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="overview-content">
            {/* Notice: KYC Process Closed for Rejected Workers */}
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', color: '#fca5a5' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontSize: '1.3rem' }}>🚫</span>
                <strong style={{ color: '#f87171', fontSize: '1rem' }}>
                  {t('worker.rejected.kyc_closed_title', 'KYC Document Submission Closed')}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                {t(
                  'worker.rejected.kyc_closed_desc',
                  'Because your profile was not approved by SmartFix Compliance, identity document upload privileges are permanently removed for this application. Unapproved or unskilled applicants are not eligible for KYC document verification.'
                )}
              </p>
            </div>

            <p className="tab-lead">
              {t(
                'worker.rejected.how_to_fix',
                'If you wish to demonstrate that you are a certified and skilled technician, you may retake the technical skill assessment:'
              )}
            </p>

            <div className="action-cards-grid">
              <div className="action-card" onClick={startRetakeInterview} style={{ gridColumn: '1 / -1' }}>
                <div className="action-icon">🧠</div>
                <h3>{t('worker.rejected.fix_interview_title', 'Retake Practical Skill Assessment')}</h3>
                <p>
                  {t(
                    'worker.rejected.fix_interview_desc',
                    'Answer 5 trade scenario questions to prove your technical diagnosis, practical tools knowledge, and safety awareness.'
                  )}
                </p>
                <button className="btn btn-sm btn-outline-warning">
                  {t('worker.rejected.start_interview_btn', 'Start Skill Assessment →')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RETAKE INTERVIEW */}
        {activeTab === 'retake_interview' && (
          <div className="interview-retake-container">
            <h3 className="section-title">
              🤖 {t('worker.rejected.interview_heading', 'Technical Assessment Retake')}
            </h3>

            <div className="chat-window">
              {messages.map((msg, index) => (
                <div key={index} className={`chat-bubble ${msg.sender}`}>
                  <div className="bubble-author">{msg.sender === 'ai' ? 'SmartFix AI' : 'You'}</div>
                  <div className="bubble-text">{msg.text}</div>
                </div>
              ))}
              {interviewLoading && (
                <div className="chat-bubble ai typing">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              )}
            </div>

            <form onSubmit={handleSendInterviewAnswer} className="chat-input-row">
              <input
                type="text"
                className="form-control"
                placeholder={t('worker.rejected.chat_placeholder', 'Type your technical answer with specific tools and steps...')}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={interviewLoading}
              />
              <button
                type="submit"
                className="btn btn-warning px-4"
                disabled={interviewLoading || !userInput.trim()}
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* Footer Actions */}
        <div className="rejected-footer">
          <button onClick={handleLogout} className="btn btn-logout-link">
            🚪 {t('worker.rejected.logout', 'Sign Out')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkerRejected;
