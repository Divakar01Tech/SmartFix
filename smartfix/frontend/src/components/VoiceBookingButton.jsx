import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { Mic, MicOff, Sparkles, Check, X, RefreshCw, Volume2 } from 'lucide-react';

export default function VoiceBookingButton({ onIntentExtracted }) {
  const { t } = useTranslation();
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [lang, setLang] = useState('ta-IN'); // Primary: Tamil (India), fallback: en-IN
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMsg('');
    };

    recognition.onresult = (event) => {
      let current = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        current += event.results[i][0].transcript;
      }
      setTranscript(current);
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setErrorMsg(`Speech error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [lang]);

  const toggleListening = () => {
    if (!speechSupported) {
      alert('Speech recognition is not supported in this browser. Please type your description.');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      if (transcript.trim()) {
        setShowReviewModal(true);
      }
    } else {
      setTranscript('');
      try {
        recognitionRef.current?.start();
      } catch (e) {
        // Recognition already active
      }
    }
  };

  const handleProcessIntent = async () => {
    const text = transcript.trim();
    if (!text || processing) return;

    setProcessing(true);
    setErrorMsg('');
    try {
      const res = await apiService.parseVoiceIntent(text);
      if (res.aiDisabled) {
        setErrorMsg('Voice booking is currently disabled by Admin.');
      } else if (res.intent) {
        setShowReviewModal(false);
        if (typeof onIntentExtracted === 'function') {
          onIntentExtracted(res.intent);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'Could not understand voice recording. Please verify text.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="d-inline-flex align-items-center gap-2">
        <button
          type="button"
          onClick={toggleListening}
          className={`btn btn-sm d-inline-flex align-items-center gap-2 rounded-pill px-3 py-2 fw-bold shadow-sm transition-all ${
            isListening ? 'btn-danger animate-pulse' : 'btn-outline-primary bg-white'
          }`}
          style={{
            borderWidth: '2px',
            fontSize: '0.82rem',
          }}
          title="Click to speak your problem in Tamil, Tanglish, or English"
        >
          {isListening ? (
            <>
              <MicOff size={16} />
              <span>Listening ({lang === 'ta-IN' ? 'தமிழ்' : 'English'})... Tap to Finish</span>
            </>
          ) : (
            <>
              <Mic size={16} className="text-primary" />
              <span>🎤 Voice Book / குரல் மூலம் புக் செய்</span>
            </>
          )}
        </button>

        {/* Language switch chip */}
        <button
          type="button"
          onClick={() => setLang((prev) => (prev === 'ta-IN' ? 'en-IN' : 'ta-IN'))}
          className="btn btn-sm btn-light border rounded-pill px-2 py-1 text-muted"
          style={{ fontSize: '0.72rem' }}
          title="Switch recognition language"
        >
          {lang === 'ta-IN' ? '🗣️ தமிழ்' : '🗣️ English'}
        </button>
      </div>

      {/* Review & Edit Spoken Transcript Modal */}
      {showReviewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1060,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="h6 fw-bold mb-0 d-flex align-items-center gap-2 text-dark">
                <Sparkles size={18} className="text-primary" />
                <span>Confirm Spoken Request / குரல் பதிவு சரிபார்ப்பு</span>
              </h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowReviewModal(false)}
              />
            </div>

            <p className="text-muted small mb-2">
              Review and edit what you spoke before our AI matches the repair category and parameters:
            </p>

            <textarea
              className="form-control mb-3"
              rows={4}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="E.g. ஃபேன் சுத்தல, பயங்கர சத்தம் வருது, இன்னைக்கு சாயங்காலம் வாங்க..."
              style={{ fontSize: '0.9rem' }}
            />

            {errorMsg && (
              <div className="alert alert-danger py-2 small mb-3">
                {errorMsg}
              </div>
            )}

            <div className="d-flex gap-2 justify-content-end">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-pill px-3"
                onClick={() => setShowReviewModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm rounded-pill px-4 fw-bold d-inline-flex align-items-center gap-2"
                onClick={handleProcessIntent}
                disabled={!transcript.trim() || processing}
              >
                {processing ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Analyzing Repair Intent...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Auto-Fill Booking Form ⚡</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
