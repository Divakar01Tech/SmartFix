import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

const AssistantWidget = ({ contextLabel = "Ask about your data" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Hello! I'm your AI assistant. ${contextLabel}. How can I help you?` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('smartfix_token') || localStorage.getItem('smartfix_token'); 
      const baseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      const response = await fetch(`${baseUrl}/assistant/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question: userMessage })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      console.error('Assistant error:', err);
      const errorMsg = err.message || 'Sorry, I could not process that request. Please try again later.';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg, isError: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="assistant-widget-container"
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {/* Chat Window */}
      {isOpen && (
        <div 
          className="card shadow-lg border-0 mb-3" 
          style={{ 
            width: '350px', 
            borderRadius: '16px', 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeInUp 0.3s ease'
          }}
        >
          {/* Header */}
          <div className="text-white p-3 d-flex justify-content-between align-items-center" style={{ backgroundColor: '#0f172a' }}>
            <div>
              <h5 className="mb-0 fw-bold">SmartFix AI</h5>
              <small className="opacity-75">{contextLabel}</small>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="btn btn-sm btn-link text-white text-decoration-none"
              style={{ padding: 0 }}
            >
              <X size={22} />
            </button>
          </div>

          {/* Messages Area */}
          <div 
            className="p-3" 
            style={{ 
              height: '320px', 
              overflowY: 'auto', 
              backgroundColor: '#f8f9fa',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: '16px',
                  borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                  borderBottomLeftRadius: msg.role === 'user' ? '16px' : '4px',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: msg.role === 'user' ? '#334155' : (msg.isError ? '#f8d7da' : '#ffffff'),
                  color: msg.role === 'user' ? '#ffffff' : (msg.isError ? '#842029' : '#212529'),
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  border: msg.role === 'user' ? 'none' : '1px solid #e9ecef'
                }}
              >
                <p className="mb-0" style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
              </div>
            ))}
            {loading && (
              <div 
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#ffffff',
                  padding: '10px 14px',
                  borderRadius: '16px',
                  borderBottomLeftRadius: '4px',
                  border: '1px solid #e9ecef',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                }}
              >
                <Loader2 className="text-secondary" size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-top d-flex gap-2 align-items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask in English or Tamil..."
              className="form-control rounded-pill bg-light border-0 px-3"
              style={{ fontSize: '0.9rem' }}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="btn rounded-circle d-flex align-items-center justify-content-center p-2"
              style={{ 
                width: '40px', 
                height: '40px', 
                flexShrink: 0, 
                backgroundColor: '#0f172a', 
                color: 'white',
                border: 'none',
                opacity: (!input.trim() || loading) ? 0.6 : 1
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="btn shadow-lg d-flex align-items-center justify-content-center"
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            transition: 'transform 0.2s',
            backgroundColor: '#0f172a',
            border: 'none',
            color: 'white'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title={contextLabel}
        >
          <MessageCircle size={30} color="#ffffff" />
        </button>
      )}
      
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AssistantWidget;
