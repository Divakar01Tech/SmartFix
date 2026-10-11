import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import tamilNaduLocations from '../data/tamilnadu-locations.json';
import {
  Wrench,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  UploadCloud,
  FileText,
  Bot,
  Send,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Clock,
  Mic,
  MicOff,
} from 'lucide-react';
import './WorkerSignup.css';

const FIXED_CATEGORIES = [
  { id: 'Plumbing', label: 'Plumbing', taLabel: 'பிளம்பிங் (குழாய் பழுது)', icon: '🔧' },
  { id: 'Electrical Repairs', label: 'Electrical Repairs', taLabel: 'மின் பழுதுபார்ப்பு', icon: '⚡' },
  { id: 'AC Service and Repair', label: 'AC Service and Repair', taLabel: 'ஏசி சர்வீஸ் & பழுது', icon: '❄️' },
  { id: 'Refrigerator Repair', label: 'Refrigerator Repair', taLabel: 'பிரிட்ஜ் பழுதுபார்ப்பு', icon: '🧊' },
  { id: 'Washing Machine Repair', label: 'Washing Machine Repair', taLabel: 'வாஷிங் மெஷின் பழுது', icon: '🌀' },
  { id: 'Water Purifier Service', label: 'Water Purifier Service', taLabel: 'வாட்டர் பியூரிஃபையர் சர்வீஸ்', icon: '💧' },
];

const WorkerSignup = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isTamil = i18n.language === 'ta';

  // Step 1: Email OTP | Step 2: Basic Details | Step 3: KYC Upload | Step 4: AI Interview
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Step 1: Email + OTP State
  const [email, setEmail] = useState('');
  const [otpBoxes, setOtpBoxes] = useState(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(300); // 5 minutes
  const otpInputRefs = useRef([]);

  // Step 2: Basic Details State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    password: '',
    confirmPassword: '',
    district: 'Sivagangai',
    taluk: 'Sivagangai',
    village: 'Sivagangai Town',
    streetAddress: '',
    state: 'Tamil Nadu',
    categories: ['Plumbing'],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 3: KYC Upload State
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [secondIdType, setSecondIdType] = useState('driving_license');
  const [secondIdNumber, setSecondIdNumber] = useState('');
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState(null);
  const [secondIdFile, setSecondIdFile] = useState(null);
  const [previews, setPreviews] = useState({ aadhaarFront: '', aadhaarBack: '', secondId: '' });

  // Step 4: AI Interview State
  const [interviewSessionId, setInterviewSessionId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [interviewFinished, setInterviewFinished] = useState(false);
  const [aiRubric, setAiRubric] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const chatBottomRef = useRef(null);

  // Guard: steps 2-4 require signupToken in sessionStorage
  useEffect(() => {
    const signupToken = sessionStorage.getItem('worker_signup_token');
    if (currentStep > 1 && !signupToken) {
      setCurrentStep(1);
      setErrorMessage(isTamil ? 'அமர்வு காலாவதியானது. தயவுசெய்து மின்னஞ்சலை மீண்டும் சரிபார்க்கவும்.' : 'Session expired. Please verify your email first.');
    }
  }, [currentStep, isTamil]);

  // Timers for OTP
  useEffect(() => {
    let timer = null;
    if (cooldownSeconds > 0) {
      timer = setInterval(() => setCooldownSeconds((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    let expiryTimer = null;
    if (otpSent && otpExpirySeconds > 0) {
      expiryTimer = setInterval(() => setOtpExpirySeconds((prev) => prev - 1), 1000);
    }
    return () => clearInterval(expiryTimer);
  }, [otpSent, otpExpirySeconds]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiTyping]);

  // --------------------------------------------------------------------------
  // STEP 1 HANDLERS (Email + OTP)
  // --------------------------------------------------------------------------
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage(isTamil ? 'சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.' : 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.workerSendOtp(email.trim());
      setOtpSent(true);
      setCooldownSeconds(60);
      setOtpExpirySeconds(300);
      setSuccessMessage(res.message || (isTamil ? 'சரிபார்ப்புக் குறியீடு உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது.' : 'Verification code sent to your email!'));
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err) {
      setErrorMessage(err.message || (isTamil ? 'குறியீடு அனுப்புவதில் தோல்வி.' : 'Failed to send verification code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpBoxChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newBoxes = [...otpBoxes];
    newBoxes[index] = value.slice(-1);
    setOtpBoxes(newBoxes);

    // Auto-advance
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpBoxes[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pasteData)) {
      const digits = pasteData.split('');
      setOtpBoxes(digits);
      otpInputRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    const fullOtp = otpBoxes.join('');

    if (fullOtp.length !== 6) {
      setErrorMessage(isTamil ? '6-இலக்க OTP குறியீட்டை முழுமையாக உள்ளிடவும்.' : 'Please enter all 6 digits of the OTP code.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.workerVerifyOtp(email.trim(), fullOtp);
      if (res.signupToken) {
        // Store in sessionStorage only
        sessionStorage.setItem('worker_signup_token', res.signupToken);
        setSuccessMessage(isTamil ? 'மின்னஞ்சல் சரிபார்க்கப்பட்டது! விவரங்களை நிரப்பவும்.' : 'Email verified! Proceeding to basic details.');
        setTimeout(() => {
          setSuccessMessage('');
          setCurrentStep(2);
        }, 500);
      }
    } catch (err) {
      setErrorMessage(err.message || (isTamil ? 'தவறான அல்லது காலாவதியான OTP.' : 'Invalid or expired OTP.'));
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 2 HANDLERS (Basic Details)
  // --------------------------------------------------------------------------
  const handleCategoryToggle = (catId) => {
    setFormData((prev) => {
      const exists = prev.categories.includes(catId);
      if (exists) {
        if (prev.categories.length === 1) return prev; // Keep at least one
        return { ...prev, categories: prev.categories.filter((c) => c !== catId) };
      } else {
        return { ...prev, categories: [...prev.categories, catId] };
      }
    });
  };

  const handleBasicDetailsSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      setErrorMessage(isTamil ? 'முழு பெயரை உள்ளிடவும்.' : 'Full name is required (min 2 characters).');
      return;
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    const phoneDigits = cleanPhone.length === 12 && cleanPhone.startsWith('91') ? cleanPhone.slice(2) : cleanPhone;
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
      setErrorMessage(isTamil ? 'சரியான இந்திய அலைபேசி எண்ணை உள்ளிடவும் (6-9இல் தொடங்கும் 10 இலக்கங்கள்).' : 'Please enter a valid 10-digit Indian phone number starting with 6-9.');
      return;
    }

    if (formData.password.length < 8 || !/(?=.*[A-Za-z])(?=.*\d)/.test(formData.password)) {
      setErrorMessage(isTamil ? 'கடவுச்சொல் குறைந்தது 8 எழுத்துக்கள், 1 எழுத்து மற்றும் 1 எண் கொண்டிருக்க வேண்டும்.' : 'Password must be min 8 characters and contain at least 1 letter and 1 number.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage(isTamil ? 'கடவுச்சொற்கள் பொருந்தவில்லை.' : 'Passwords do not match.');
      return;
    }

    if (!formData.district || !formData.taluk || !formData.streetAddress.trim()) {
      setErrorMessage(isTamil ? 'முழுமையான முகவரி விவரங்களை உள்ளிடவும்.' : 'Please fill all address fields.');
      return;
    }

    if (formData.categories.length === 0) {
      setErrorMessage(isTamil ? 'குறைந்தது ஒரு சேவைப் பிரிவைத் தேர்ந்தெடுக்கவும்.' : 'Select at least one trade category.');
      return;
    }

    setCurrentStep(3);
  };

  // --------------------------------------------------------------------------
  // STEP 3 HANDLERS (KYC Uploads)
  // --------------------------------------------------------------------------
  const handleFileSelect = (field, file) => {
    setErrorMessage('');
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(isTamil ? `கோப்பு அளவு 5 MB-க்கு குறைவாக இருக்க வேண்டும்.` : `File size for ${field} exceeds 5 MB limit.`);
      return;
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedMimes.includes(file.type)) {
      setErrorMessage(isTamil ? 'JPG, PNG அல்லது PDF கோப்புகளை மட்டுமே பதிவேற்றவும்.' : 'Only JPG, PNG, or PDF files are accepted.');
      return;
    }

    if (field === 'aadhaarFront') {
      setAadhaarFrontFile(file);
      if (file.type.startsWith('image/')) setPreviews((p) => ({ ...p, aadhaarFront: URL.createObjectURL(file) }));
    } else if (field === 'aadhaarBack') {
      setAadhaarBackFile(file);
      if (file.type.startsWith('image/')) setPreviews((p) => ({ ...p, aadhaarBack: URL.createObjectURL(file) }));
    } else if (field === 'secondId') {
      setSecondIdFile(file);
      if (file.type.startsWith('image/')) setPreviews((p) => ({ ...p, secondId: URL.createObjectURL(file) }));
    }
  };

  const handleKycStepSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!aadhaarNumber.trim() || aadhaarNumber.replace(/\D/g, '').length < 12) {
      setErrorMessage(isTamil ? '12-இலக்க ஆதார் எண்ணை உள்ளிடவும்.' : 'Please enter your complete 12-digit Aadhaar number.');
      return;
    }

    if (!secondIdNumber.trim()) {
      setErrorMessage(isTamil ? 'இரண்டாவது அடையாள அட்டை எண்ணை உள்ளிடவும்.' : 'Please enter the second ID number.');
      return;
    }

    if (!aadhaarFrontFile || !aadhaarBackFile || !secondIdFile) {
      setErrorMessage(isTamil ? 'ஆதார் முன், பின் மற்றும் இரண்டாவது அடையாள அட்டை ஆகிய மூன்றையும் பதிவேற்றவும்.' : 'Please upload all 3 required KYC document files.');
      return;
    }

    // Advance to Step 4 and start AI interview
    setCurrentStep(4);
    startAiInterview();
  };

  // --------------------------------------------------------------------------
  // STEP 4 HANDLERS (AI Skill Interview Chatbot)
  // --------------------------------------------------------------------------
  const startAiInterview = async () => {
    setIsAiTyping(true);
    setErrorMessage('');
    try {
      const primaryCategory = formData.categories[0] || 'Plumbing';
      const lang = isTamil ? 'ta' : 'en';
      const res = await apiService.workerInterviewStart(primaryCategory, lang);

      if (res && res.sessionId) {
        setInterviewSessionId(res.sessionId);
        setChatMessages(res.messages || [{ role: 'assistant', text: res.questionText }]);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to start AI interview.');
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleSendInterviewAnswer = async (e) => {
    if (e) e.preventDefault();
    if (!currentAnswer.trim() || isAiTyping || interviewFinished) return;

    const answer = currentAnswer.trim();
    setCurrentAnswer('');

    // Append worker answer immediately to UI
    setChatMessages((prev) => [...prev, { role: 'worker', text: answer }]);
    setIsAiTyping(true);

    try {
      const lang = isTamil ? 'ta' : 'en';
      const res = await apiService.workerInterviewAnswer(interviewSessionId, answer, lang);

      if (res) {
        setChatMessages(res.messages || []);
        if (res.isFinished && res.recommendation) {
          setInterviewFinished(true);
          setAiRubric(res.recommendation);
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit response.');
    } finally {
      setIsAiTyping(false);
    }
  };

  // Web Speech API Voice Dictation toggle
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or type your answer.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = isTamil ? 'ta-IN' : 'en-IN';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setCurrentAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  // Final Registration Submission to POST /api/worker/auth/register
  const handleFinalWorkerRegistration = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const signupToken = sessionStorage.getItem('worker_signup_token');
      if (!signupToken) {
        throw new Error('Verification session has expired. Please restart signup.');
      }

      // Build Multipart FormData
      const payload = new FormData();
      payload.append('fullName', formData.fullName.trim());
      payload.append('name', formData.fullName.trim());
      payload.append('phone', formData.phone);
      payload.append('password', formData.password);
      payload.append('confirmPassword', formData.confirmPassword);
      payload.append('address', `${formData.streetAddress}, ${formData.village}, ${formData.taluk}`);
      payload.append('district', formData.district);
      payload.append('state', formData.state);
      payload.append('categories', JSON.stringify(formData.categories));
      payload.append('aadhaarNumber', aadhaarNumber);
      payload.append('secondIdType', secondIdType);
      payload.append('secondIdNumber', secondIdNumber);

      if (aadhaarFrontFile) payload.append('aadhaarFront', aadhaarFrontFile);
      if (aadhaarBackFile) payload.append('aadhaarBack', aadhaarBackFile);
      if (secondIdFile) payload.append('secondId', secondIdFile);

      if (aiRubric) {
        payload.append(
          'interviewData',
          JSON.stringify({
            transcriptSummary: aiRubric.transcriptSummary || 'Practical scenario questions completed.',
            scores: aiRubric.scores,
            aiVerdict: aiRubric.verdict,
            completedAt: new Date().toISOString(),
          })
        );
      }

      const res = await apiService.workerRegister(payload, signupToken);

      // Clean up signupToken from sessionStorage
      sessionStorage.removeItem('worker_signup_token');

      // Save worker JWT and safe object
      if (res.token) localStorage.setItem('smartfix_worker_token', res.token);
      if (res.worker) localStorage.setItem('smartfix_worker', JSON.stringify(res.worker));

      // Redirect to Pending Verification view
      navigate('/worker/pending');
    } catch (err) {
      setErrorMessage(err.message || 'Worker registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Cascading Address Options
  const availableDistricts = Object.keys(tamilNaduLocations || {});
  const availableTaluks = formData.district && tamilNaduLocations[formData.district]
    ? Object.keys(tamilNaduLocations[formData.district])
    : [];
  const availableVillages = formData.district && formData.taluk && tamilNaduLocations[formData.district]?.[formData.taluk]
    ? tamilNaduLocations[formData.district][formData.taluk]
    : [];

  return (
    <div className="worker-auth-container">
      <div className="worker-card">
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(245,158,11,0.1)', padding: '6px 16px', borderRadius: '30px', border: '1px solid rgba(245,158,11,0.3)', marginBottom: '12px' }}>
            <Wrench size={18} color="#f59e0b" />
            <span style={{ color: '#f59e0b', fontWeight: '800', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
              SMARTFIX PARTNER NETWORK
            </span>
          </div>
          <h1 style={{ fontWeight: '900', fontSize: '1.9rem', color: '#f8fafc', margin: '0 0 6px 0' }}>
            {isTamil ? 'சேவை வல்லுநர் பதிவு' : 'Service Provider Onboarding'}
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', margin: 0 }}>
            {isTamil ? 'சிவகங்கை மற்றும் தமிழகம் முழுவதும் ஆயிரக்கணக்கான வாடிக்கையாளர்களை அடையுங்கள்' : 'Zero-commission verified technician platform in Sivagangai & Tamil Nadu'}
          </p>
        </div>

        {/* Stepper Progress Bar */}
        <div className="worker-stepper">
          <div className="stepper-progress-fill" style={{ width: `${((currentStep - 1) / 3) * 80}%` }} />
          {[
            { num: 1, title: isTamil ? 'மின்னஞ்சல்' : 'Email' },
            { num: 2, title: isTamil ? 'விவரங்கள்' : 'Details' },
            { num: 3, title: isTamil ? 'KYC ஆவணங்கள்' : 'KYC Docs' },
            { num: 4, title: isTamil ? 'AI நேர்காணல்' : 'AI Interview' },
          ].map((s) => (
            <div
              key={s.num}
              className={`stepper-node ${currentStep === s.num ? 'active' : currentStep > s.num ? 'completed' : ''}`}
            >
              <div className="node-circle">
                {currentStep > s.num ? <CheckCircle2 size={20} /> : s.num}
              </div>
              <span className="node-label">{s.title}</span>
            </div>
          ))}
        </div>

        {/* Global Notifications */}
        {errorMessage && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
            <AlertCircle size={20} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
            <CheckCircle2 size={20} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ================================================================== */}
        {/* STEP 1: EMAIL OTP                                                  */}
        {/* ================================================================== */}
        {currentStep === 1 && (
          <div>
            <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', fontWeight: '800', marginBottom: '8px' }}>
              {isTamil ? 'படி 1: மின்னஞ்சல் சரிபார்ப்பு' : 'Step 1: Email Verification'}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '20px' }}>
              {isTamil ? 'உங்கள் வேலைவாய்ப்பு மற்றும் முன்பதிவு தகவல்களைப் பெற உங்கள் மின்னஞ்சலை உள்ளிடவும்.' : 'Enter your email address to receive your 6-digit verification code.'}
            </p>

            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
              <div style={{ marginBottom: '20px' }}>
                <label className="worker-label">{isTamil ? 'மின்னஞ்சல் முகவரி' : 'Email Address'}</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="email"
                    className="worker-input"
                    placeholder="partner@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={otpSent}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || cooldownSeconds > 0}
                    className="btn-worker-secondary"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {loading ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : cooldownSeconds > 0 ? (
                      `${cooldownSeconds}s`
                    ) : otpSent ? (
                      isTamil ? 'மீண்டும் அனுப்பு' : 'Resend'
                    ) : (
                      isTamil ? 'OTP அனுப்பு' : 'Send Code'
                    )}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div style={{ background: '#111e33', border: '1px solid #1e293b', borderRadius: '16px', padding: '24px', textAlign: 'center', marginBottom: '24px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    {isTamil ? 'மின்னஞ்சலுக்கு அனுப்பப்பட்ட 6-இலக்க குறியீட்டை உள்ளிடவும்' : 'Enter 6-digit code sent to your email'}
                  </span>

                  <div className="otp-box-group" onPaste={handleOtpPaste}>
                    {otpBoxes.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputRefs.current[idx] = el)}
                        type="text"
                        maxLength={1}
                        className="otp-box"
                        value={digit}
                        onChange={(e) => handleOtpBoxChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: otpExpirySeconds < 60 ? '#ef4444' : '#64748b' }}>
                    <Clock size={16} />
                    <span>
                      {isTamil ? 'குறியீடு காலாவதி:' : 'Code expires in:'}{' '}
                      <strong>{Math.floor(otpExpirySeconds / 60)}:{String(otpExpirySeconds % 60).padStart(2, '0')}</strong>
                    </span>
                  </div>
                </div>
              )}

              {otpSent && (
                <button
                  type="submit"
                  disabled={loading || otpBoxes.join('').length !== 6}
                  className="btn-worker-primary"
                  style={{ width: '100%' }}
                >
                  {loading ? <span className="spinner-border spinner-border-sm me-2" /> : <ShieldCheck size={20} />}
                  {isTamil ? 'குறியீட்டைச் சரிபார்த்துத் தொடரவும்' : 'Verify & Continue to Profile'}
                </button>
              )}
            </form>

            <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.9rem', color: '#94a3b8' }}>
              {isTamil ? 'ஏற்கனவே கணக்கு உள்ளதா?' : 'Already have a provider account?'}{' '}
              <Link to="/worker/login" style={{ color: '#f59e0b', fontWeight: '800', textDecoration: 'none' }}>
                {isTamil ? 'இங்கே உள்நுழையவும்' : 'Log In Here'}
              </Link>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* STEP 2: BASIC DETAILS FORM                                         */}
        {/* ================================================================== */}
        {currentStep === 2 && (
          <form onSubmit={handleBasicDetailsSubmit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', fontWeight: '800', margin: 0 }}>
                {isTamil ? 'படி 2: தனிப்பட்ட மற்றும் சேவை விவரங்கள்' : 'Step 2: Basic Profile & Trade Categories'}
              </h3>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="btn-worker-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <ArrowLeft size={14} className="me-1" /> {isTamil ? 'மின்னஞ்சல் மாற்று' : 'Edit Email'}
              </button>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label className="worker-label">{isTamil ? 'முழு பெயர் (ஆதாரில் உள்ளபடி)' : 'Full Name (as per Aadhaar)'}</label>
                <input
                  type="text"
                  className="worker-input"
                  placeholder="e.g. M. Rajesh Kumar"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="worker-label">{isTamil ? 'மொபைல் எண் (+91)' : 'Mobile Number (+91)'}</label>
                <input
                  type="tel"
                  className="worker-input"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="worker-label">{isTamil ? 'கடவுச்சொல் (குறைந்தது 8 எழுத்துக்கள்)' : 'Password (min 8 chars, 1 letter + 1 number)'}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="worker-input"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="col-md-6">
                <label className="worker-label">{isTamil ? 'கடவுச்சொல்லை உறுதிப்படுத்தவும்' : 'Confirm Password'}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="worker-input"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Cascading Address Flow: District -> Taluk -> Village */}
              <div className="col-md-4">
                <label className="worker-label">{isTamil ? 'மாவட்டம்' : 'District'}</label>
                <select
                  className="worker-input"
                  value={formData.district}
                  onChange={(e) => {
                    const newDist = e.target.value;
                    const taluks = Object.keys(tamilNaduLocations[newDist] || {});
                    const firstTaluk = taluks[0] || '';
                    const villages = firstTaluk ? tamilNaduLocations[newDist]?.[firstTaluk] || [] : [];
                    setFormData({
                      ...formData,
                      district: newDist,
                      taluk: firstTaluk,
                      village: villages[0] || '',
                    });
                  }}
                >
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="worker-label">{isTamil ? 'வட்டம் (தாலுகா)' : 'Taluk'}</label>
                <select
                  className="worker-input"
                  value={formData.taluk}
                  onChange={(e) => {
                    const newTaluk = e.target.value;
                    const villages = tamilNaduLocations[formData.district]?.[newTaluk] || [];
                    setFormData({
                      ...formData,
                      taluk: newTaluk,
                      village: villages[0] || '',
                    });
                  }}
                >
                  {availableTaluks.map((tName) => (
                    <option key={tName} value={tName}>{tName}</option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="worker-label">{isTamil ? 'ஊர் / நகரம்' : 'Village / Town / City'}</label>
                <select
                  className="worker-input"
                  value={formData.village}
                  onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                >
                  {availableVillages.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="col-12">
                <label className="worker-label">{isTamil ? 'தெரு / கதவு எண் முகவரி' : 'Street Address / Door No.'}</label>
                <input
                  type="text"
                  className="worker-input"
                  placeholder="e.g. 42, Gandhi Road, Near Bus Stand"
                  value={formData.streetAddress}
                  onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                  required
                />
              </div>

              {/* Six Fixed Multi-Select Categories */}
              <div className="col-12" style={{ marginTop: '20px' }}>
                <label className="worker-label">
                  {isTamil ? 'சேவைப் பிரிவுகள் (ஒன்று அல்லது பலவற்றைத் தேர்வு செய்க)' : 'Service Categories (Multi-select from fixed 6 categories)'}
                </label>
                <div className="category-grid">
                  {FIXED_CATEGORIES.map((cat) => {
                    const isSelected = formData.categories.includes(cat.id);
                    return (
                      <div
                        key={cat.id}
                        className={`category-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleCategoryToggle(cat.id)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // Controlled by container click
                        />
                        <div style={{ fontSize: '1.4rem' }}>{cat.icon}</div>
                        <div>
                          <div style={{ fontWeight: '800', color: isSelected ? '#fbbf24' : '#f8fafc', fontSize: '0.9rem' }}>
                            {cat.label}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {cat.taLabel}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px' }}>
              <button type="submit" className="btn-worker-primary" style={{ minWidth: '220px' }}>
                {isTamil ? 'அடுத்து: KYC பதிவேற்றம்' : 'Next: Upload KYC Documents'} <ArrowRight size={18} />
              </button>
            </div>
          </form>
        )}

        {/* ================================================================== */}
        {/* STEP 3: KYC UPLOAD                                                 */}
        {/* ================================================================== */}
        {currentStep === 3 && (
          <form onSubmit={handleKycStepSubmit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', fontWeight: '800', margin: '0 0 4px 0' }}>
                  {isTamil ? 'படி 3: KYC ஆவணப் பதிவேற்றம்' : 'Step 3: KYC Document Verification'}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                  {isTamil ? 'ஆதார் மற்றும் இரண்டாவது அடையாள ஆவணங்களைப் பாதுகாப்பாகப் பதிவேற்றவும் (அதிகபட்சம் 5 MB).' : 'Upload Aadhaar front/back and a second official ID (Max 5MB each, JPG/PNG/PDF).'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="btn-worker-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                <ArrowLeft size={14} className="me-1" /> {isTamil ? 'பின்னே' : 'Back'}
              </button>
            </div>

            {/* Privacy notice banner */}
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.85rem', color: '#34d399' }}>
              <ShieldCheck size={24} />
              <span>
                <strong>{isTamil ? 'பாதுகாப்பு உறுதி:' : 'Privacy Protection:'}</strong> {isTamil ? 'உங்கள் முழு அடையாள எண்கள் ஒருபோதும் சேமிக்கப்படாது. கடைசி 4 இலக்கங்கள் மட்டுமே மறைக்கப்பட்டு வைக்கப்படும்.' : 'Your full ID numbers are never stored in plain text. Only the last 4 digits are masked at storage time.'}
              </span>
            </div>

            <div className="row g-3">
              {/* Aadhaar Number input */}
              <div className="col-md-6">
                <label className="worker-label">{isTamil ? '12-இலக்க ஆதார் எண்' : '12-Digit Aadhaar Number'}</label>
                <input
                  type="text"
                  maxLength={12}
                  className="worker-input"
                  placeholder="e.g. 123456789012"
                  value={aadhaarNumber}
                  onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                  required
                />
                {aadhaarNumber.length >= 4 && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                    Masked view: <strong>XXXX-XXXX-{aadhaarNumber.slice(-4)}</strong>
                  </span>
                )}
              </div>

              {/* Second ID Select + Number */}
              <div className="col-md-3">
                <label className="worker-label">{isTamil ? '2-வது அடையாள அட்டை வகை' : 'Second ID Type'}</label>
                <select
                  className="worker-input"
                  value={secondIdType}
                  onChange={(e) => setSecondIdType(e.target.value)}
                >
                  <option value="driving_license">Driving License</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="pan_card">PAN Card</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className="worker-label">{isTamil ? 'அடையாள அட்டை எண்' : 'Second ID Number'}</label>
                <input
                  type="text"
                  className="worker-input"
                  placeholder="e.g. TN6320210001234"
                  value={secondIdNumber}
                  onChange={(e) => setSecondIdNumber(e.target.value)}
                  required
                />
              </div>

              {/* Upload 1: Aadhaar Front */}
              <div className="col-md-4">
                <label className="worker-label">{isTamil ? 'ஆதார் அட்டை (முன்பக்கம்)' : 'Aadhaar Card (Front)'}</label>
                <div className="kyc-upload-dropzone">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    style={{ display: 'none' }}
                    id="file-aadhaar-front"
                    onChange={(e) => handleFileSelect('aadhaarFront', e.target.files[0])}
                  />
                  <label htmlFor="file-aadhaar-front" style={{ cursor: 'pointer', display: 'block', margin: 0 }}>
                    <UploadCloud size={32} color="#f59e0b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f8fafc', display: 'block' }}>
                      {aadhaarFrontFile ? aadhaarFrontFile.name : (isTamil ? 'முன்பக்க கோப்பைத் தேர்ந்தெடுக்கவும்' : 'Choose Front File')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>JPG, PNG or PDF (Max 5MB)</span>
                  </label>
                  {previews.aadhaarFront && (
                    <img src={previews.aadhaarFront} alt="Aadhaar Front Preview" className="kyc-preview-img" />
                  )}
                </div>
              </div>

              {/* Upload 2: Aadhaar Back */}
              <div className="col-md-4">
                <label className="worker-label">{isTamil ? 'ஆதார் அட்டை (பின்பக்கம்)' : 'Aadhaar Card (Back)'}</label>
                <div className="kyc-upload-dropzone">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    style={{ display: 'none' }}
                    id="file-aadhaar-back"
                    onChange={(e) => handleFileSelect('aadhaarBack', e.target.files[0])}
                  />
                  <label htmlFor="file-aadhaar-back" style={{ cursor: 'pointer', display: 'block', margin: 0 }}>
                    <UploadCloud size={32} color="#f59e0b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f8fafc', display: 'block' }}>
                      {aadhaarBackFile ? aadhaarBackFile.name : (isTamil ? 'பின்பக்க கோப்பைத் தேர்ந்தெடுக்கவும்' : 'Choose Back File')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>JPG, PNG or PDF (Max 5MB)</span>
                  </label>
                  {previews.aadhaarBack && (
                    <img src={previews.aadhaarBack} alt="Aadhaar Back Preview" className="kyc-preview-img" />
                  )}
                </div>
              </div>

              {/* Upload 3: Second ID */}
              <div className="col-md-4">
                <label className="worker-label">
                  {secondIdType === 'driving_license' ? 'Driving License' : secondIdType === 'voter_id' ? 'Voter ID' : 'PAN Card'}
                </label>
                <div className="kyc-upload-dropzone">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    style={{ display: 'none' }}
                    id="file-second-id"
                    onChange={(e) => handleFileSelect('secondId', e.target.files[0])}
                  />
                  <label htmlFor="file-second-id" style={{ cursor: 'pointer', display: 'block', margin: 0 }}>
                    <UploadCloud size={32} color="#f59e0b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f8fafc', display: 'block' }}>
                      {secondIdFile ? secondIdFile.name : (isTamil ? 'அடையாள கோப்பைத் தேர்ந்தெடுக்கவும்' : 'Choose Second ID File')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>JPG, PNG or PDF (Max 5MB)</span>
                  </label>
                  {previews.secondId && (
                    <img src={previews.secondId} alt="Second ID Preview" className="kyc-preview-img" />
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '30px' }}>
              <button type="submit" className="btn-worker-primary" style={{ minWidth: '240px' }}>
                {isTamil ? 'அடுத்து: AI நேர்காணல்' : 'Next: AI Skill Interview'} <Sparkles size={18} />
              </button>
            </div>
          </form>
        )}

        {/* ================================================================== */}
        {/* STEP 4: AI SKILL INTERVIEW                                         */}
        {/* ================================================================== */}
        {currentStep === 4 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: '#f8fafc', fontWeight: '800', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bot size={22} color="#f59e0b" /> {isTamil ? 'படி 4: AI செயல்முறைத் திறன் நேர்காணல்' : 'Step 4: AI Practical Skill Interview'}
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                  {isTamil ? `${formData.categories[0]} பணிக்கான செயல்முறை சூழ்நிலைக் கேள்விகள் (5 கேள்விகள்)` : `Live interactive scenario chatbot for ${formData.categories[0]} (5 practical questions)`}
                </p>
              </div>
            </div>

            {/* Chat Box */}
            <div className="ai-interview-box">
              <div className="ai-chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-bubble ${msg.role === 'assistant' ? 'ai' : 'worker'}`}>
                    {msg.role === 'assistant' && (
                      <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '800', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Bot size={14} /> SmartFix AI Evaluator
                      </div>
                    )}
                    <div>{msg.text}</div>
                  </div>
                ))}

                {isAiTyping && (
                  <div className="chat-bubble ai">
                    <div className="typing-dots">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Controls */}
              {!interviewFinished ? (
                <form
                  onSubmit={handleSendInterviewAnswer}
                  style={{ display: 'flex', gap: '10px', padding: '16px', background: '#111e33', borderTop: '1px solid #1e293b' }}
                >
                  <input
                    type="text"
                    className="worker-input"
                    placeholder={isTamil ? 'உங்கள் செயல்முறைப் பதிலை உள்ளிடவும் அல்லது பேசவும்...' : 'Type your practical response or click microphone to speak...'}
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    disabled={isAiTyping}
                  />

                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className="btn-worker-secondary"
                    title="Toggle Speech Recognition"
                    style={{ padding: '0 16px', background: isListening ? '#dc2626' : '#1e293b' }}
                  >
                    {isListening ? <MicOff size={20} color="#ffffff" /> : <Mic size={20} color="#f59e0b" />}
                  </button>

                  <button
                    type="submit"
                    disabled={!currentAnswer.trim() || isAiTyping}
                    className="btn-worker-primary"
                    style={{ padding: '0 20px' }}
                  >
                    <Send size={18} />
                  </button>
                </form>
              ) : (
                <div style={{ padding: '16px', background: '#111e33', textAlign: 'center', color: '#10b981', fontWeight: '700' }}>
                  ✅ {isTamil ? 'நேர்காணல் வெற்றிகரமாக முடிந்தது!' : 'All 5 practical questions completed!'}
                </div>
              )}
            </div>

            {/* Rubric Evaluation Results Card when finished */}
            {interviewFinished && aiRubric && (
              <div style={{ marginTop: '20px', background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ color: '#f8fafc', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} color="#f59e0b" /> {isTamil ? 'AI பரிந்துரை & மதிப்பீட்டு முடிவுகள்' : 'AI Recommendation & Rubric Scores'}
                  </h4>
                  <span
                    style={{
                      background: aiRubric.verdict === 'pass' ? '#166534' : aiRubric.verdict === 'fail' ? '#991b1b' : '#92400e',
                      color: '#ffffff',
                      fontWeight: '800',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    Recommendation: {aiRubric.verdict}
                  </span>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-3">
                    <div style={{ background: '#0f172a', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Practical Specificity</span>
                      <strong style={{ fontSize: '1.2rem', color: '#f59e0b' }}>{aiRubric.scores?.practicalSpecificity || 0}/25</strong>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div style={{ background: '#0f172a', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Safety Awareness</span>
                      <strong style={{ fontSize: '1.2rem', color: '#f59e0b' }}>{aiRubric.scores?.safetyAwareness || 0}/25</strong>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div style={{ background: '#0f172a', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Diagnosis Logic</span>
                      <strong style={{ fontSize: '1.2rem', color: '#f59e0b' }}>{aiRubric.scores?.diagnosisLogic || 0}/25</strong>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div style={{ background: '#0f172a', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Communication Clarity</span>
                      <strong style={{ fontSize: '1.2rem', color: '#f59e0b' }}>{aiRubric.scores?.communicationClarity || 0}/25</strong>
                    </div>
                  </div>
                </div>

                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', fontStyle: 'italic', margin: '0 0 16px 0' }}>
                  "{aiRubric.transcriptSummary}"
                </p>

                <div style={{ fontSize: '0.8rem', color: '#94a3b8', borderTop: '1px solid #334155', paddingTop: '12px' }}>
                  ℹ️ <strong>Note:</strong> The AI assessment is advisory. Your KYC documents and interview results will be reviewed by the SmartFix Admin Team for final account approval.
                </div>
              </div>
            )}

            {/* Final Submission Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={handleFinalWorkerRegistration}
                disabled={loading || !interviewFinished}
                className="btn-worker-primary"
                style={{ minWidth: '280px', padding: '16px' }}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    {isTamil ? 'பதிவு செய்யப்படுகிறது...' : 'Submitting Application...'}
                  </>
                ) : (
                  <>
                    <ShieldCheck size={20} />
                    {isTamil ? 'விண்ணப்பத்தை சமர்ப்பிக்கவும்' : 'Submit Application for Review'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerSignup;
