import { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { Bot, User, Mic, MicOff, Send, CheckCircle2, Clock, X, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import './SkillInterviewModal.css';

const SkillInterviewModal = ({ worker, category, onClose, onCompleted }) => {
  const { language } = useLanguage();
  const [session, setSession] = useState(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const workerId = worker?._id || worker?.id;
  const workerCategory = category || worker?.trade || 'Plumbing';

  useEffect(() => {
    initInterview();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, sending]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initInterview = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const activeSession = await apiService.startSkillInterview(workerId, workerCategory, language);
      setSession(activeSession);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initialize AI skill interview.');
    } finally {
      setLoading(false);
    }
  };

  // Initialize SpeechRecognition for Voice-to-Text
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported on this browser. Please type your answer in the box.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language === 'ta' ? 'ta-IN' : 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn('Failed to start speech recognition:', e);
      setIsListening(false);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || sending || !session?._id) return;

    const answer = inputText.trim();
    setInputText('');
    setSending(true);
    setErrorMsg('');

    try {
      const updatedSession = await apiService.submitSkillAnswer(session._id, answer, language);
      setSession(updatedSession);
      if (updatedSession.status === 'completed' && onCompleted) {
        onCompleted(updatedSession);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit answer. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const questionsAsked = session?.questionsAsked || 0;
  const isCompleted = session?.status === 'completed' || questionsAsked >= 5;

  return (
    <div className="interview-modal-overlay">
      <div className="interview-modal-container">
        {/* Header */}
        <div className="interview-modal-header">
          <div className="header-title-box">
            <div className="bot-icon-glow">
              <Bot size={22} color="#ffffff" />
            </div>
            <div>
              <h3>AI Practical Skill Verification</h3>
              <p>Trade: <strong>{workerCategory}</strong> • Spoken & Typed Assessment</p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="interview-progress-bar-container">
          <div className="progress-label-row">
            <span><Sparkles size={14} color="#2563eb" /> Practical Scenario Question</span>
            <span className="question-count-badge">
              {isCompleted ? '5 of 5 Completed ✅' : `Question ${Math.min(questionsAsked, 5)} of 5`}
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${(Math.min(questionsAsked, 5) / 5) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="interview-error-alert">
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Chat Body */}
        <div className="interview-chat-body">
          {loading ? (
            <div className="chat-loading-state">
              <Loader2 size={36} className="spin-icon" color="#2563eb" />
              <p>Initializing AI Practical Skill Assessor...</p>
            </div>
          ) : (
            <>
              {session?.messages?.map((msg, index) => (
                <div
                  key={index}
                  className={`chat-bubble-row ${msg.role === 'assistant' ? 'assistant-row' : 'worker-row'}`}
                >
                  <div className="avatar-box">
                    {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                  </div>
                  <div className="bubble-content">
                    <span className="sender-name">
                      {msg.role === 'assistant' ? 'SmartFix Skill Assessor AI' : 'Your Answer'}
                    </span>
                    <p>{msg.text}</p>
                    <span className="timestamp">
                      {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}

              {sending && (
                <div className="chat-bubble-row assistant-row">
                  <div className="avatar-box"><Bot size={18} /></div>
                  <div className="bubble-content typing-indicator">
                    <span className="sender-name">SmartFix Skill Assessor AI</span>
                    <p className="typing-dots">
                      <span>•</span><span>•</span><span>•</span> Evaluating response & loading next scenario...
                    </p>
                  </div>
                </div>
              )}

              {/* Completion State Message */}
              {isCompleted && !sending && (
                <div className="interview-completed-banner">
                  <CheckCircle2 size={32} color="#059669" />
                  <div>
                    <h4>Assessment Complete!</h4>
                    <p>Thank you! Your practical skill interview responses have been logged. Your application is now under final verification review by SmartFix Admin.</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Chat Input Footer */}
        {!isCompleted && !loading && (
          <form className="interview-input-footer" onSubmit={handleSend}>
            <button
              type="button"
              className={`mic-toggle-btn ${isListening ? 'listening' : ''}`}
              onClick={toggleSpeechRecognition}
              title={isListening ? 'Stop Listening' : 'Speak Your Response (Voice-to-Text)'}
            >
              {isListening ? <MicOff size={20} color="#dc2626" /> : <Mic size={20} color="#2563eb" />}
            </button>

            <input
              type="text"
              placeholder={isListening ? '🎙️ Listening to your speech...' : 'Type or speak your practical answer...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={sending}
            />

            <button
              type="submit"
              className="send-answer-btn"
              disabled={!inputText.trim() || sending}
            >
              {sending ? <Loader2 size={18} className="spin-icon" /> : <Send size={18} />}
              <span>Send</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SkillInterviewModal;
