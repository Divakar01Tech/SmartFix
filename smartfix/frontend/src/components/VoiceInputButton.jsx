import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

// Privacy Note: The Web Speech API sends audio to the browser vendor's speech recognition service 
// (e.g., Google or Apple) for processing. The audio is NEVER recorded or uploaded to the HandyBook servers;
// only the text transcript is sent when the user submits the form.
const VoiceInputButton = ({ uiLanguage, onTranscript, onStartListening }) => {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [spokenLang, setSpokenLang] = useState(uiLanguage === 'ta' ? 'ta-IN' : 'en-IN');
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);

  const recognitionRef = useRef(null);
  
  useEffect(() => {
    setSpokenLang(uiLanguage === 'ta' ? 'ta-IN' : 'en-IN');
  }, [uiLanguage]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorMsg(null);
      if (onStartListening) onStartListening();
      // Show privacy notice on first use only
      if (!localStorage.getItem('smartfix_voice_privacy_seen')) {
        setShowPrivacyNotice(true);
        localStorage.setItem('smartfix_voice_privacy_seen', 'true');
      }
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      onTranscript(finalTranscript || interimTranscript, event.results[event.resultIndex].isFinal);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setErrorMsg('Microphone blocked. Please type instead. / மைக் தடுக்கப்பட்டுள்ளது. தயவுசெய்து தட்டச்சு செய்யவும்.');
      } else if (event.error === 'no-speech') {
        setErrorMsg('No speech detected.');
      } else {
        setErrorMsg(`Speech error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [onTranscript]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.lang = spokenLang;
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error('Recognition already started');
        }
      }
    }
  };

  if (!isSupported) {
    return null; // Fallback: hide mic button if API unsupported (e.g. Firefox without flag)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={toggleListening}
          className={`btn btn-sm ${isListening ? 'btn-danger' : 'btn-outline-primary'}`}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '5px',
            transition: 'all 0.2s',
            animation: isListening ? 'pulse 1.5s infinite' : 'none'
          }}
          title="Voice Input"
        >
          {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          {isListening ? 'Listening...' : 'Speak'}
        </button>
        
        <select 
          className="form-select form-select-sm" 
          value={spokenLang} 
          onChange={(e) => setSpokenLang(e.target.value)}
          style={{ width: 'auto', display: 'inline-block' }}
        >
          <option value="en-IN">English</option>
          <option value="ta-IN">தமிழ் (Tamil)</option>
        </select>
        
        {errorMsg && (
          <span style={{ fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={12} /> {errorMsg}
          </span>
        )}
      </div>
      
      {showPrivacyNotice && (
        <div style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '6px', borderRadius: '4px' }}>
          <strong>Privacy Note:</strong> Your speech is processed by your browser's default service (e.g., Google/Apple). Audio is not saved to our servers. / உங்கள் குரல் உங்கள் உலாவியால் (Browser) செயலாக்கப்படுகிறது. ஒலிக்கோப்பு எங்கள் சர்வரில் சேமிக்கப்படாது.
          <button 
            type="button"
            onClick={() => setShowPrivacyNotice(false)} 
            style={{ border: 'none', background: 'none', color: '#2563eb', marginLeft: '5px', cursor: 'pointer', padding: 0 }}
          >
            Dismiss
          </button>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
          100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
        }
      `}</style>
    </div>
  );
};

export default VoiceInputButton;
