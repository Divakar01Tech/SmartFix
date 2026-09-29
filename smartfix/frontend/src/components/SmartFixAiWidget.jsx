import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, X, Send, User, RefreshCw, Zap, Wrench, ShieldAlert,
  Camera, Mic, MicOff, Volume2, VolumeX, Copy, Check, Sparkles,
  CheckCircle, Globe
} from 'lucide-react';
import { detectMcpIntent, executeMcpTool } from '../services/mcpTools';
import { useLanguage } from '../context/LanguageContext';
import './SmartFixAiWidget.css';

const getApiBase = () => {
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
};


const API_BASE = getApiBase();

const CUSTOMER_SUGGESTION_CHIPS = [
  { id: 'area', label: '📍 Check Service Area', prompt: 'Is Karaikudi or Sivagangai covered in service area?' },
  { id: 'pricing', label: '💰 Check Pricing', prompt: 'How much for an AC repair or plumber?' },
  { id: 'book', label: '📅 Book Service', prompt: 'Book a plumber for tomorrow at 5pm' },
  { id: 'status', label: '🚚 Track Worker / Status', prompt: 'Where is my worker and what is booking status?' },
  { id: 'wallet', label: '👛 Wallet Balance', prompt: 'What is my wallet balance and bonus?' },
  { id: 'diagnose', label: '🔧 Diagnose Issue', prompt: 'Diagnose issue: My refrigerator is not cooling and water is leaking' }
];

const WORKER_SUGGESTION_CHIPS = [
  { id: 'kyc', label: '🆔 Check KYC Status', prompt: 'Is my KYC verified?' },
  { id: 'jobs', label: '🔔 Incoming Jobs', prompt: 'Show available incoming job requests' },
  { id: 'availability', label: '🟢 Duty Status', prompt: 'Toggle my availability status online/offline' },
  { id: 'earnings', label: '💰 Check Earnings', prompt: 'How much did I earn this week?' },
  { id: 'commission', label: '📜 Commission Rate', prompt: 'What is the platform commission percentage?' }
];

const ADMIN_SUGGESTION_CHIPS = [
  { id: 'pending_kyc', label: '🔍 Pending KYCs', prompt: 'Show pending worker KYC list' },
  { id: 'sla', label: '⚠️ SLA Breaches', prompt: 'Show 1-hour SLA breached bookings' },
  { id: 'revenue', label: '📈 Revenue Metrics', prompt: 'Show total platform revenue metrics' },
  { id: 'active', label: '📊 Active Bookings', prompt: 'Show currently active running bookings' }
];

const SmartFixAiWidget = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); // { base64, previewUrl, fileName }
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [userRole, setUserRole] = useState('customer');

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        if (u.role) setUserRole(u.role);
      }
    } catch (e) {}
  }, [isOpen]);

  const activeChips = userRole === 'admin'
    ? ADMIN_SUGGESTION_CHIPS
    : (userRole === 'handyman' || userRole === 'worker')
      ? WORKER_SUGGESTION_CHIPS
      : CUSTOMER_SUGGESTION_CHIPS;


  // Voice States (STT & TTS)
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState(null);
  const [isFullVoiceMode, setIsFullVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking'

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: language === 'ta'
        ? '👋 **வணக்கம் நண்பா, உனக்கு என்ன உதவி வேண்டும்?**'
        : '⚡ **Hii buddy, How can I help you?**',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const latestTranscriptRef = useRef('');
  const [voiceErrorMsg, setVoiceErrorMsg] = useState('');

  // Auto-scroll chat body
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Clean SpeechSynthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // -------------------------------------------------------------
  // Speech-to-Text (STT) & Native Audio Recording Setup
  // -------------------------------------------------------------
  const startVoiceRecording = async () => {
    latestTranscriptRef.current = '';
    audioChunksRef.current = [];
    setVoiceErrorMsg('');

    // 1. MediaRecorder Audio Stream (Guaranteed fallback for Gemini 3.6 Multimodal Audio)
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setVoiceState('listening');
      }
    } catch (err) {
      console.warn('MediaRecorder audio access warning:', err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceErrorMsg('⚠️ Mic permission denied. Allow mic access in your browser address bar.');
        return;
      }
    }

    // 2. Parallel Web Speech API for real-time text input typing
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch (e) {}
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language === 'ta' ? 'ta-IN' : (navigator.language || 'en-US');

        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          latestTranscriptRef.current = currentTranscript;
          setInput(currentTranscript);
        };

        recognition.onerror = (event) => {
          // Ignore Web Speech network errors quietly because MediaRecorder audio backup is active!
          console.warn('Web Speech event note:', event.error);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (e) {}
    }
  };

  const stopVoiceRecording = () => {
    setIsRecording(false);
    setVoiceState('idle');

    // Stop Web Speech Recognition if running
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    // Stop MediaRecorder and process audio blob if available
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }

        const transcript = latestTranscriptRef.current.trim();

        // If Web Speech API captured text into input box
        if (transcript) {
          setInput(transcript);
          if (isFullVoiceMode) {
            handleSend(null, transcript);
          }
        } else if (audioBlob.size > 0) {
          // Send audio recording directly to Gemini 3.6 Flash
          const reader = new FileReader();
          reader.onloadend = () => {
            handleSendWithAudio(reader.result);
          };
          reader.readAsDataURL(audioBlob);
        }
      };

      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    } else {
      const transcript = latestTranscriptRef.current.trim();
      if (transcript) {
        setInput(transcript);
        if (isFullVoiceMode) {
          handleSend(null, transcript);
        }
      }
    }
  };

  // -------------------------------------------------------------
  // Text-to-Speech (TTS) Setup
  // -------------------------------------------------------------
  const speakText = (text, idx) => {
    if (!('speechSynthesis' in window)) return;

    if (speakingMsgIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingMsgIdx(null);
      setVoiceState('idle');
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/[*#_~`>]/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setSpeakingMsgIdx(idx);
      setVoiceState('speaking');
    };

    utterance.onend = () => {
      setSpeakingMsgIdx(null);
      setVoiceState('idle');

      if (isFullVoiceMode) {
        setTimeout(() => startVoiceRecording(), 1000);
      }
    };

    utterance.onerror = () => {
      setSpeakingMsgIdx(null);
      setVoiceState('idle');
    };

    window.speechSynthesis.speak(utterance);
  };

  // -------------------------------------------------------------
  // Image Upload Handler
  // -------------------------------------------------------------
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert('Image size exceeds 8MB. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage({
        base64: reader.result,
        previewUrl: URL.createObjectURL(file),
        fileName: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // -------------------------------------------------------------
  // Process User Queries with Backend Gemini API & Tools
  // -------------------------------------------------------------
  const processQuery = async (userText, imagePayload, audioBase64 = null) => {
    const detectedMcp = detectMcpIntent(userText);
    let mcpResult = null;
    if (detectedMcp) {
      try {
        mcpResult = await executeMcpTool(detectedMcp.intent, detectedMcp.params);
      } catch (e) { }
    }

    const lower = (userText || '').toLowerCase();
    const isDiagnoseReq = lower.includes('diagnose') || lower.includes('problem') || lower.includes('troubleshoot') || imagePayload;
    const isWorkerReq = lower.includes('find worker') || lower.includes('handyman') || lower.includes('electrician') || lower.includes('plumber');

    let aiReply = '';
    let diagnosisCard = null;
    let serviceRequestCard = null;
    let matchedWorkersCard = null;

    let intentData = null;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: userText,
          image: imagePayload ? imagePayload.base64 : null,
          audio: audioBase64 ? { mimeType: 'audio/webm', data: audioBase64 } : null,
          mcpContext: mcpResult ? JSON.stringify(mcpResult) : null,
          language,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        aiReply = data.reply;
        intentData = data.intentData;
      } else {
        throw new Error('Backend AI Error');
      }
    } catch (err) {
      console.warn('Backend AI fallback:', err);
      aiReply = language === 'ta'
        ? '⚡ **SmartFix AI:** மன்னிக்கவும், தற்காலிகமாக ஆன்லைன் தொடர்பு கிடைக்கவில்லை. கைவினைஞர்களை நேரடியாக வரைபடத்தில் தேடலாம்!'
        : '⚡ **SmartFix AI:** Experiencing a brief network delay. You can browse verified local handymen directly on our map!';
    }

    if (isDiagnoseReq && userText.length > 5) {
      try {
        const diagRes = await fetch(`${API_BASE}/ai/diagnose`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ problem: userText, image: imagePayload ? imagePayload.base64 : null })
        });
        if (diagRes.ok) {
          const diagData = await diagRes.json();
          if (diagData.diagnosis) {
            diagnosisCard = diagData.diagnosis;
            if (diagData.diagnosis.serviceRequestDraft) {
              serviceRequestCard = diagData.diagnosis.serviceRequestDraft;
            }
          }
          if (diagData.workerMatches?.workers) {
            matchedWorkersCard = diagData.workerMatches.workers;
          }
        }
      } catch (e) { }
    }

    if (isWorkerReq && !matchedWorkersCard) {
      try {
        const matchRes = await fetch(`${API_BASE}/ai/match-workers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: userText })
        });
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          if (matchData.workers) {
            matchedWorkersCard = matchData.workers;
          }
        }
      } catch (e) { }
    }

    return {
      role: 'assistant',
      content: aiReply,
      intentData,
      diagnosisCard,
      serviceRequestCard,
      matchedWorkersCard,
      mcpToolData: mcpResult,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };


  // -------------------------------------------------------------
  // Send Audio Recording Directly to Gemini AI
  // -------------------------------------------------------------
  const handleSendWithAudio = async (base64Audio) => {
    if (loading) return;

    const userMessageObj = {
      role: 'user',
      content: '🎙️ Spoken Voice Message',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessageObj]);
    setLoading(true);

    try {
      const responseObj = await processQuery('Spoken voice repair query', null, base64Audio);
      setMessages((prev) => [...prev, responseObj]);

      if (isFullVoiceMode) {
        speakText(responseObj.content, messages.length + 1);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'SmartFix AI: System issue processing voice audio. Please try typing.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Send Message Action
  // -------------------------------------------------------------
  const handleSend = async (e, textOverride = null) => {
    if (e) e.preventDefault();
    const query = textOverride || input;
    const currentImg = selectedImage;

    if (!query.trim() && !currentImg) return;
    if (loading) return;

    setInput('');
    removeSelectedImage();

    const userMessageObj = {
      role: 'user',
      content: query.trim() || 'Uploaded image for inspection',
      imagePreview: currentImg ? currentImg.previewUrl : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessageObj]);
    setLoading(true);

    try {
      const responseObj = await processQuery(query.trim(), currentImg);
      setMessages((prev) => [...prev, responseObj]);

      if (isFullVoiceMode) {
        speakText(responseObj.content, messages.length + 1);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'SmartFix AI: System issue encountered. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Service Request Confirmation Action
  // -------------------------------------------------------------
  const handleConfirmServiceRequest = async (draft) => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please log in to confirm and create your service request.');
      setIsOpen(false);
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/create-service-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          trade: draft.trade || 'Plumbing',
          notes: draft.notes || 'Created via SmartFix AI',
          price: draft.estimatedPrice || 350,
          address: 'Sivagangai District, Tamil Nadu'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `🎉 **Service Request Created!**\nBooking ID: \`${data.booking?._id || 'Confirmed'}\`\n\nYour request has been broadcasted to verified ${draft.trade} experts near you. Track live status in your Customer Dashboard!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        const errData = await res.json();
        alert(`Request failed: ${errData.message || 'Error creating request'}`);
      }
    } catch (err) {
      alert('Network error while creating request.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="smartfix-ai-widget-wrapper">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          className="ai-widget-toggle-btn"
          onClick={() => setIsOpen(true)}
          title="SmartFix AI Assistant"
        >
          <div className="ai-toggle-icon-pulse">
            <Zap size={18} color="#f59e0b" />
          </div>
          <span>SmartFix AI</span>
          <span className="mcp-live-badge-pill">AI LIVE</span>
        </button>
      )}

      {/* Interactive AI Chat Box */}
      {isOpen && (
        <div className="ai-chat-card">
          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-header-left">
              <div className="ai-badge-icon">
                <Bot size={20} color="#ffffff" />
              </div>
              <div>
                <div className="ai-header-title-row">
                  <h4>SmartFix AI Assistant</h4>
                  <span className="online-dot-pulse">● Online</span>
                </div>
                <p className="ai-header-sub">
                  24/7 Intelligent Home Service Assistant
                </p>
              </div>
            </div>

            <div className="ai-header-actions">
              {/* Full Voice Mode Toggle */}
              <button
                type="button"
                className={`ai-header-icon-btn ${isFullVoiceMode ? 'active' : ''}`}
                title={isFullVoiceMode ? 'Disable Voice Chat Mode' : 'Enable Full Voice Chat Mode'}
                onClick={() => setIsFullVoiceMode(!isFullVoiceMode)}
              >
                <Mic size={16} color={isFullVoiceMode ? '#10b981' : '#cbd5e1'} />
              </button>

              {/* Language Switcher */}
              <button
                type="button"
                className="ai-lang-pill-btn"
                title="Switch Language"
                onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
              >
                <Globe size={13} />
                <span>{language === 'en' ? 'தமிழ்' : 'EN'}</span>
              </button>

              <button type="button" className="ai-close-btn" onClick={() => setIsOpen(false)}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Voice Mode Status Banner */}
          {isFullVoiceMode && (
            <div className="voice-mode-banner">
              <div className="voice-wave-animation">
                <span className="bar1"></span>
                <span className="bar2"></span>
                <span className="bar3"></span>
              </div>
              <p>🎙️ <strong>Full Voice Mode:</strong> {voiceState === 'listening' ? 'Listening...' : voiceState === 'speaking' ? 'AI Responding...' : 'Ready for speech'}</p>
              <button type="button" onClick={() => setIsFullVoiceMode(false)}>Exit</button>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="ai-chat-body">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-bubble-row ${msg.role}`}>
                <div className="bubble-avatar">
                  {msg.role === 'assistant' ? <Zap size={14} /> : <User size={14} />}
                </div>

                <div className="chat-bubble-content">
                  {/* Uploaded User Image Thumbnail */}
                  {msg.imagePreview && (
                    <div className="user-uploaded-image-preview">
                      <img src={msg.imagePreview} alt="User Upload" />
                    </div>
                  )}

                  <div className="chat-message-text">{msg.content}</div>

                  {/* RENDER LIVE INTENT BADGE & SUGGESTED ACTION CHIPS */}
                  {msg.intentData && (
                    <div className="ai-intent-badge-container">
                      <div className="intent-badge-pill" data-risk={msg.intentData.isSafetyRisk}>
                        <Sparkles size={12} />
                        <span>{msg.intentData.label}</span>
                      </div>

                      {msg.intentData.suggestedActions?.length > 0 && (
                        <div className="ai-intent-action-chips">
                          {msg.intentData.suggestedActions.map((act, actIdx) => (
                            <button
                              key={actIdx}
                              type="button"
                              className="intent-chip-btn"
                              onClick={() => {
                                if (act.action === 'CREATE_BOOKING') {
                                  navigate('/browse');
                                } else if (act.action === 'MY_BOOKINGS') {
                                  navigate('/my-bookings');
                                } else {
                                  handleSend(null, act.label.replace(/^[^\w]+/, '').trim());
                                }
                              }}
                            >
                              {act.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}


                  {/* RENDER DIAGNOSIS CARD */}
                  {msg.diagnosisCard && (
                    <div className="ai-diagnosis-card">
                      <div className="diag-header">
                        <Sparkles size={16} color="#2563eb" />
                        <strong>AI Problem Diagnosis</strong>
                        <span className="diag-priority-pill" data-priority={msg.diagnosisCard.priority}>
                          {msg.diagnosisCard.priority || 'Medium'} Priority
                        </span>
                      </div>

                      <div className="diag-grid">
                        <div className="diag-item">
                          <span>Category:</span> <strong>{msg.diagnosisCard.category}</strong>
                        </div>
                        <div className="diag-item">
                          <span>Main Problem:</span> <strong>{msg.diagnosisCard.problem}</strong>
                        </div>
                        {msg.diagnosisCard.additionalIssue && (
                          <div className="diag-item">
                            <span>Additional Issue:</span> <strong>{msg.diagnosisCard.additionalIssue}</strong>
                          </div>
                        )}
                      </div>

                      {msg.diagnosisCard.safetyWarning && (
                        <div className="diag-safety-alert">
                          <ShieldAlert size={14} color="#dc2626" />
                          <span>{msg.diagnosisCard.safetyWarning}</span>
                        </div>
                      )}

                      <div className="diag-action">
                        <p>👉 {msg.diagnosisCard.recommendedAction}</p>
                      </div>
                    </div>
                  )}

                  {/* RENDER SERVICE REQUEST CONFIRMATION CARD */}
                  {msg.serviceRequestCard && (
                    <div className="ai-request-confirmation-card">
                      <div className="card-top">
                        <Wrench size={16} color="#059669" />
                        <h5>Create Service Request</h5>
                      </div>

                      <div className="card-field-rows">
                        <div><span>Category:</span> <strong>{msg.serviceRequestCard.trade}</strong></div>
                        <div><span>Est. Fare:</span> <strong style={{ color: '#059669' }}>₹{msg.serviceRequestCard.estimatedPrice || 350}</strong></div>
                        <div><span>Details:</span> <span>{msg.serviceRequestCard.notes}</span></div>
                      </div>

                      <div className="card-action-btns">
                        <button
                          type="button"
                          className="confirm-req-btn"
                          onClick={() => handleConfirmServiceRequest(msg.serviceRequestCard)}
                          disabled={loading}
                        >
                          <CheckCircle size={14} /> Create Request
                        </button>
                        <button
                          type="button"
                          className="edit-req-btn"
                          onClick={() => setInput(`Edit Request: ${msg.serviceRequestCard.trade} - ${msg.serviceRequestCard.notes}`)}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RENDER MATCHED WORKERS CARD */}
                  {msg.matchedWorkersCard && msg.matchedWorkersCard.length > 0 && (
                    <div className="ai-matched-workers-card">
                      <div className="matched-header">
                        <strong>👨‍🔧 Verified Local Handymen Found ({msg.matchedWorkersCard.length}):</strong>
                      </div>
                      {msg.matchedWorkersCard.map((w) => (
                        <div key={w.id || w._id} className="matched-worker-row">
                          <div className="matched-worker-info">
                            <h6>👨‍🔧 {w.name}</h6>
                            <p>{w.trade} • ₹{w.ratePerHour}/hr • {w.rating || 4.9} ★</p>
                          </div>
                          <button
                            type="button"
                            className="matched-book-btn"
                            onClick={() => {
                              setIsOpen(false);
                              navigate(`/booking/${w.id || w._id}`);
                            }}
                          >
                            Book Now
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Bottom Action Bar */}
                  {msg.role === 'assistant' && (
                    <div className="bubble-actions">
                      <button
                        type="button"
                        className="action-icon-btn"
                        title="Listen to response"
                        onClick={() => speakText(msg.content, idx)}
                      >
                        {speakingMsgIdx === idx ? <VolumeX size={13} color="#ef4444" /> : <Volume2 size={13} />}
                        <span>{speakingMsgIdx === idx ? 'Stop' : 'Listen'}</span>
                      </button>

                      <button
                        type="button"
                        className="action-icon-btn"
                        title="Copy message"
                        onClick={() => copyToClipboard(msg.content, idx)}
                      >
                        {copiedIndex === idx ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                        <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  )}

                  <span className="bubble-time">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="chat-bubble-row assistant">
                <div className="bubble-avatar"><RefreshCw size={14} className="spin-icon" /></div>
                <div className="chat-bubble-content ai-thinking">
                  ⚡ SmartFix AI is processing...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Smart Suggestion Chips */}
          <div className="ai-suggestion-chips-container">
            {activeChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className="suggestion-chip-btn"
                onClick={() => handleSend(null, chip.prompt)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Selected Image Badge Attachment */}
          {selectedImage && (
            <div className="selected-image-attachment-bar">
              <div className="image-attachment-preview">
                <img src={selectedImage.previewUrl} alt="Upload preview" />
                <span>📷 {selectedImage.fileName}</span>
              </div>
              <button type="button" onClick={removeSelectedImage} className="remove-img-btn">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Voice Listening Active Banner */}
          {isRecording && (
            <div className="voice-listening-active-bar">
              <div className="listening-indicator">
                <span className="listening-pulse-dot">🔴</span>
                <span>Recording your voice audio... Click Done to send!</span>
              </div>
              <button type="button" onClick={stopVoiceRecording} className="stop-mic-btn">Done</button>
            </div>
          )}

          {/* Voice Error Diagnostic Banner */}
          {voiceErrorMsg && (
            <div className="voice-error-banner">
              <span>{voiceErrorMsg}</span>
              <button type="button" onClick={() => setVoiceErrorMsg('')} className="close-err-btn">✕</button>
            </div>
          )}

          {/* Input Bar */}
          <form onSubmit={handleSend} className="ai-chat-footer">
            {/* Image Picker Trigger */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />
            <button
              type="button"
              className={`ai-footer-btn ${selectedImage ? 'active' : ''}`}
              title="Upload photo of damaged appliance"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera size={18} />
            </button>

            {/* Voice STT Record Trigger */}
            <button
              type="button"
              className={`ai-footer-btn ${isRecording ? 'recording-pulse' : ''}`}
              title={isRecording ? 'Stop Recording' : 'Voice Input (Speech & Audio)'}
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            >
              {isRecording ? <MicOff size={18} color="#ef4444" /> : <Mic size={18} />}
            </button>

            <input
              type="text"
              placeholder={isRecording ? 'Recording voice...' : language === 'ta' ? 'உங்கள் பிரச்சனையை டைப் செய்யவும்...' : 'Describe repair problem, ask fare...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />

            <button type="submit" className="ai-send-btn" disabled={(!input.trim() && !selectedImage) || loading}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SmartFixAiWidget;
