import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import './WorkerRejected.css';

const WorkerRejected = () => {
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

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'reupload' | 'retake_interview'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // KYC re-upload state
  const [aadhaarFront, setAadhaarFront] = useState(null);
  const [aadhaarBack, setAadhaarBack] = useState(null);
  const [secondIdType, setSecondIdType] = useState('driving_license');
  const [secondIdFile, setSecondIdFile] = useState(null);

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
          localStorage.setItem('smartfix_worker', JSON.stringify(fresh));
          const st = (fresh.verificationStatus || '').toLowerCase();
          if (st === 'approved') {
            navigate('/worker/dashboard');
          } else if (st === 'pending_verification' || st === 'pending') {
            navigate('/worker/pending');
          }
        }
      } catch (e) {}
    };
    fetchStatus();
  }, [navigate]);

  const validateFile = (file) => {
    if (!file) return 'File is required.';
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      return 'Only JPG, PNG, or PDF files are accepted.';
    }
    if (file.size > 5 * 1024 * 1024) {
      return 'File size exceeds maximum limit of 5 MB.';
    }
    return null;
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!aadhaarFront || !aadhaarBack || !secondIdFile) {
      setErrorMessage(t('worker.rejected.all_docs_required', 'Please select Aadhaar Front, Aadhaar Back, and Secondary ID files.'));
      return;
    }

    const frontErr = validateFile(aadhaarFront);
    if (frontErr) return setErrorMessage(`Aadhaar Front: ${frontErr}`);

    const backErr = validateFile(aadhaarBack);
    if (backErr) return setErrorMessage(`Aadhaar Back: ${backErr}`);

    const secondErr = validateFile(secondIdFile);
    if (secondErr) return setErrorMessage(`Secondary ID: ${secondErr}`);

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('aadhaarFront', aadhaarFront);
      formData.append('aadhaarBack', aadhaarBack);
      formData.append('secondId', secondIdFile);
      formData.append('secondIdType', secondIdType);

      const res = await apiService.workerUploadKyc(formData);
      if (res.success && res.worker) {
        setWorker(res.worker);
        localStorage.setItem('smartfix_worker', JSON.stringify(res.worker));
        setSuccessMessage(t('worker.rejected.kyc_resubmitted', 'KYC documents successfully re-submitted. Your status is now Pending Review.'));
        setTimeout(() => {
          navigate('/worker/pending');
        }, 1500);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to re-upload KYC documents.');
    } finally {
      setLoading(false);
    }
  };

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
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to initialize AI interview.');
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
    await apiService.workerLogout();
    localStorage.removeItem('smartfix_worker_token');
    localStorage.removeItem('smartfix_worker');
    localStorage.removeItem('smartfix_token');
    localStorage.removeItem('smartfix_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
            📋 {t('worker.rejected.tab_actions', 'Remediation Steps')}
          </button>
          <button
            className={`tab-btn ${activeTab === 'reupload' ? 'active' : ''}`}
            onClick={() => setActiveTab('reupload')}
          >
            📤 {t('worker.rejected.tab_reupload', 'Re-Upload KYC')}
          </button>
          <button
            className={`tab-btn ${activeTab === 'retake_interview' ? 'active' : ''}`}
            onClick={() => {
              if (!interviewSession) startRetakeInterview();
              else setActiveTab('retake_interview');
            }}
          >
            🤖 {t('worker.rejected.tab_interview', 'Retake AI Interview')}
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
            <p className="tab-lead">
              {t(
                'worker.rejected.how_to_fix',
                'You have the opportunity to update your records and resubmit your profile without registering from scratch:'
              )}
            </p>

            <div className="action-cards-grid">
              <div className="action-card" onClick={() => setActiveTab('reupload')}>
                <div className="action-icon">📄</div>
                <h3>{t('worker.rejected.fix_kyc_title', 'Update KYC Documents')}</h3>
                <p>
                  {t(
                    'worker.rejected.fix_kyc_desc',
                    'Upload clearer, government-issued photo identification (Aadhaar, DL, Voter ID, or PAN) in high resolution.'
                  )}
                </p>
                <button className="btn btn-sm btn-outline-warning">
                  {t('worker.rejected.reupload_btn', 'Re-Upload Files →')}
                </button>
              </div>

              <div className="action-card" onClick={startRetakeInterview}>
                <div className="action-icon">🧠</div>
                <h3>{t('worker.rejected.fix_interview_title', 'Retake Skill Interview')}</h3>
                <p>
                  {t(
                    'worker.rejected.fix_interview_desc',
                    'Answer 5 technical questions demonstrating your safety awareness, tool knowledge, and troubleshooting logic.'
                  )}
                </p>
                <button className="btn btn-sm btn-outline-warning">
                  {t('worker.rejected.start_interview_btn', 'Start Interview →')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RE-UPLOAD KYC */}
        {activeTab === 'reupload' && (
          <form onSubmit={handleKycSubmit} className="reupload-form">
            <h3 className="section-title">{t('worker.rejected.reupload_heading', 'Submit Updated Identity Documents')}</h3>
            <p className="text-muted small mb-3">
              {t('worker.rejected.file_spec', 'Maximum file size: 5 MB each. Supported formats: JPG, PNG, PDF.')}
            </p>

            <div className="upload-field-group mb-3">
              <label>1. {t('worker.rejected.aadhaar_front', 'Aadhaar Card (Front Side)')} *</label>
              <input
                type="file"
                className="form-control"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setAadhaarFront(e.target.files[0] || null)}
                required
              />
              {aadhaarFront && <small className="file-preview-label">📎 {aadhaarFront.name}</small>}
            </div>

            <div className="upload-field-group mb-3">
              <label>2. {t('worker.rejected.aadhaar_back', 'Aadhaar Card (Back Side with Address)')} *</label>
              <input
                type="file"
                className="form-control"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setAadhaarBack(e.target.files[0] || null)}
                required
              />
              {aadhaarBack && <small className="file-preview-label">📎 {aadhaarBack.name}</small>}
            </div>

            <div className="upload-field-group mb-3">
              <label>3. {t('worker.rejected.second_id_type', 'Secondary Photo ID Type')} *</label>
              <select
                className="form-select mb-2"
                value={secondIdType}
                onChange={(e) => setSecondIdType(e.target.value)}
              >
                <option value="driving_license">Driving License</option>
                <option value="voter_id">Voter ID</option>
                <option value="pan_card">PAN Card</option>
              </select>
              <input
                type="file"
                className="form-control"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => setSecondIdFile(e.target.files[0] || null)}
                required
              />
              {secondIdFile && <small className="file-preview-label">📎 {secondIdFile.name}</small>}
            </div>

            <button
              type="submit"
              className="btn btn-warning w-100 py-2 font-weight-bold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  {t('worker.rejected.uploading', 'Uploading securely...')}
                </>
              ) : (
                `📤 ${t('worker.rejected.submit_kyc_btn', 'Submit Documents for Re-Evaluation')}`
              )}
            </button>
          </form>
        )}

        {/* TAB 3: RETAKE INTERVIEW */}
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
