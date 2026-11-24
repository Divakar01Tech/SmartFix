import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import socket from '../services/socket';
import { MessageSquare, Send, X, Sparkles, Globe, Shield } from 'lucide-react';

export default function InAppChatModal({ bookingId, recipientName, onClose }) {
  const { i18n } = useTranslation();
  const activeLang = i18n.language && i18n.language.startsWith('ta') ? 'ta' : 'en';

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showOriginalMap, setShowOriginalMap] = useState({});
  const messagesEndRef = useRef(null);

  // Load chat history
  useEffect(() => {
    let isMounted = true;
    const fetchChat = async () => {
      try {
        const msgs = await apiService.getChatMessages(bookingId);
        if (isMounted) setMessages(msgs);
      } catch (err) {
        console.warn('Failed to load chat history:', err.message);
      }
    };

    fetchChat();

    // Socket.io real-time listener
    if (socket) {
      const room = `booking:${bookingId}`;
      socket.emit('join-booking-room', room);

      const handleNewMessage = (msg) => {
        if (msg.booking === bookingId || msg.booking?._id === bookingId) {
          setMessages((prev) => [...prev, msg]);
        }
      };

      socket.on('new_message', handleNewMessage);
      socket.on('chat:message', handleNewMessage);

      return () => {
        isMounted = false;
        socket.off('new_message', handleNewMessage);
        socket.off('chat:message', handleNewMessage);
      };
    }
  }, [bookingId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');
    try {
      const savedMsg = await apiService.sendChatMessage(bookingId, text);
      // Append if socket hasn't delivered yet
      setMessages((prev) => {
        if (prev.some((m) => m._id === savedMsg._id)) return prev;
        return [...prev, savedMsg];
      });
    } catch (err) {
      alert(err.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const toggleOriginal = (msgId) => {
    setShowOriginalMap((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '600px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                {recipientName ? `Chat with ${recipientName}` : 'Service Coordination Chat'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={12} color="#38bdf8" /> Live Tamil ↔ English Translation Active
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Safety & Policy Banner */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#eff6ff',
            borderBottom: '1px solid #dbeafe',
            fontSize: '0.74rem',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Shield size={14} className="flex-shrink-0" />
          <span>Keep coordination inside SmartFix. Phone numbers are protected by in-app call bridge.</span>
        </div>

        {/* Messages Scroll Area */}
        <div
          style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#f8fafc',
          }}
        >
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', margin: 'auto', fontSize: '0.85rem' }}>
              <Globe size={28} style={{ margin: '0 auto 8px', opacity: 0.5, display: 'block' }} />
              Type in English, Tamil, or Tanglish. Both sides will understand seamlessly.
            </div>
          )}

          {messages.map((m) => {
            const isSystem = m.senderRole === 'System';
            const msgId = m._id || Math.random().toString();
            const showOriginal = !!showOriginalMap[msgId];

            if (isSystem) {
              return (
                <div
                  key={msgId}
                  style={{
                    alignSelf: 'center',
                    maxWidth: '85%',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    border: '1px solid #fecaca',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    textAlign: 'center',
                  }}
                >
                  {m.text}
                </div>
              );
            }

            const targetTranslation = m.translations?.[activeLang];
            const hasTranslation = targetTranslation && targetTranslation.trim() !== m.text.trim();
            const displayedText = showOriginal || !hasTranslation ? m.text : targetTranslation;

            return (
              <div
                key={msgId}
                style={{
                  alignSelf: m.senderRole === 'Customer' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.senderRole === 'Customer' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    backgroundColor: m.senderRole === 'Customer' ? '#2563eb' : '#ffffff',
                    color: m.senderRole === 'Customer' ? '#ffffff' : '#0f172a',
                    padding: '10px 14px',
                    borderRadius: '14px',
                    borderBottomRightRadius: m.senderRole === 'Customer' ? '2px' : '14px',
                    borderBottomLeftRadius: m.senderRole === 'Worker' ? '2px' : '14px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    fontSize: '0.88rem',
                    lineHeight: 1.4,
                  }}
                >
                  {displayedText}
                </div>

                {/* Translation metadata and toggle */}
                {hasTranslation && (
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: '#64748b',
                      marginTop: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Sparkles size={11} color="#0284c7" />
                    <span>
                      {showOriginal
                        ? `Original (${m.originalLang || 'text'})`
                        : `Translated to ${activeLang === 'ta' ? 'தமிழ்' : 'English'}`}
                    </span>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => toggleOriginal(msgId)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#2563eb',
                        padding: 0,
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      {showOriginal ? 'Show translated' : 'Show original'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSendMessage}
          style={{
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            gap: '8px',
          }}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type in English or தமிழ் (e.g. naan vandhurren)..."
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '24px',
              border: '1px solid #cbd5e1',
              outline: 'none',
              fontSize: '0.88rem',
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: !inputText.trim() || sending ? '#cbd5e1' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !inputText.trim() || sending ? 'default' : 'pointer',
            }}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
