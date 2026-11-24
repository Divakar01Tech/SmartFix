import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { Bot, MessageSquare, Send, X, AlertCircle, Sparkles, CheckCircle2, User, Wrench, Wallet } from 'lucide-react';

export default function FloatingSupportWidget() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your SmartFix Support Assistant. How can I assist you with your bookings or wallet today? / வணக்கம்! நான் உங்கள் ஸ்மார்ட்ஃபிக்ஸ் உதவி உதவியாளர். உங்களுக்கு எவ்வாறு உதவலாம்?',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [aiDisabled, setAiDisabled] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await apiService.chatWithSupport(conversationId, text);
      if (res.conversationId) setConversationId(res.conversationId);

      if (res.aiDisabled) {
        setAiDisabled(true);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.reply || 'AI Support Assistant is currently offline. An email notification has been dispatched to admin.',
          },
        ]);
      } else {
        if (res.isEscalated) setIsEscalated(true);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.reply,
            toolsUsed: res.toolsUsed,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an issue connecting to the support server. Please try again shortly or contact support directly.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickChips = [
    { label: 'Where is my technician?', text: 'Where is my technician?' },
    { label: 'Wallet balance', text: 'How much wallet balance and bonus do I have?' },
    { label: 'Cancellation policy', text: 'What is the cancellation policy and refund rule?' },
    { label: 'Talk to human', text: 'I want to talk to an admin or escalate a dispute' },
  ];

  return (
    <>
      {/* Floating launcher button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
            cursor: 'pointer',
            zIndex: 1040,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s ease',
          }}
          title="SmartFix Support Assistant 🤖"
        >
          <Bot size={28} />
        </button>
      )}

      {/* Support Chat Dialog */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '380px',
            maxWidth: 'calc(100vw - 32px)',
            height: '540px',
            maxHeight: 'calc(100vh - 48px)',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 1050,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#1e293b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={18} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>SmartFix AI Support</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Real-time Booking & Wallet Grounded</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Escalation alert banner */}
          {isEscalated && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: '#fef3c7',
                borderBottom: '1px solid #fde68a',
                color: '#92400e',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>Support Ticket Registered. An admin will review and follow up shortly.</span>
            </div>
          )}

          {/* Message List */}
          <div
            style={{
              flex: 1,
              padding: '12px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              backgroundColor: '#f8fafc',
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    backgroundColor: m.role === 'user' ? '#2563eb' : '#ffffff',
                    color: m.role === 'user' ? '#ffffff' : '#0f172a',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    borderBottomRightRadius: m.role === 'user' ? '2px' : '12px',
                    borderBottomLeftRadius: m.role === 'assistant' ? '2px' : '12px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    fontSize: '0.84rem',
                    lineHeight: 1.4,
                  }}
                >
                  {m.content}
                </div>
                {m.toolsUsed && m.toolsUsed.length > 0 && (
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                    ⚡ Verified via {m.toolsUsed.join(', ')}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: '#64748b', fontSize: '0.78rem', fontStyle: 'italic' }}>
                Checking real-time records... 🤖
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick reply chips */}
          <div
            style={{
              padding: '6px 10px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(chip.text)}
                disabled={loading}
                style={{
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  color: '#334155',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '10px 12px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '6px',
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about bookings, wallet, policy..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '20px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontSize: '0.84rem',
              }}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: !inputText.trim() || loading ? '#cbd5e1' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: !inputText.trim() || loading ? 'default' : 'pointer',
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
