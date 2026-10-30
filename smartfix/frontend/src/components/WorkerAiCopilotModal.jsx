import React, { useState, useEffect } from 'react';
import { X, Wrench, ShieldAlert, CheckCircle2, Copy, Check, MessageSquare, ExternalLink, Sparkles, AlertTriangle } from 'lucide-react';
import { apiService } from '../services/api';

export default function WorkerAiCopilotModal({ booking, onClose }) {
  const [loading, setLoading] = useState(true);
  const [copilot, setCopilot] = useState(null);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('en'); // 'en' or 'ta'
  const [checkedItems, setCheckedItems] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const fetchCopilot = async () => {
      setLoading(true);
      setError('');
      try {
        const trade = booking?.trade || booking?.category || 'General Repair';
        const notes = booking?.notes || booking?.description || booking?.problemDescription || '';
        const data = await apiService.getWorkerJobCopilot(booking?._id || booking?.id, trade, notes, lang);
        setCopilot(data);
      } catch (err) {
        console.error('Failed to load Worker AI Copilot:', err);
        setError('Failed to generate AI guidance. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (booking) {
      fetchCopilot();
    }
  }, [booking, lang]);

  const toggleCheck = (item) => {
    setCheckedItems((prev) => ({ ...prev, [item]: !prev[item] }));
  };

  const handleCopyText = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (!booking) return null;

  const customerPhone = booking.customer?.phone || booking.customerPhone || '';
  const cleanPhone = customerPhone.replace(/\D/g, '');

  return (
    <div
      className="modal-backdrop show d-flex align-items-center justify-content-center p-3"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        zIndex: 1060,
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="card border-0 shadow-lg rounded-4 overflow-hidden w-100"
        style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 bg-dark text-white d-flex align-items-center justify-content-between border-bottom border-secondary">
          <div className="d-flex align-items-center gap-2">
            <div className="p-2 rounded-3 bg-warning text-dark d-flex align-items-center justify-content-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold fs-6">AI Technician Co-Pilot</h5>
              <small className="text-secondary" style={{ fontSize: '0.75rem' }}>
                {booking.trade || 'Repair Job'} • {booking.customer?.name || 'Customer Task'}
              </small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="btn-group btn-group-sm" role="group">
              <button
                type="button"
                className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setLang('en')}
              >
                English
              </button>
              <button
                type="button"
                className={`btn btn-sm ${lang === 'ta' ? 'btn-primary' : 'btn-outline-secondary'}`}
                style={{ fontSize: '0.72rem' }}
                onClick={() => setLang('ta')}
              >
                தமிழ்
              </button>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-link text-white p-1"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto" style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary mb-2" role="status" style={{ width: '2rem', height: '2rem' }} />
              <p className="text-muted small mb-0">Analyzing customer issue & gathering technician toolkit...</p>
            </div>
          ) : error ? (
            <div className="alert alert-danger small p-3 rounded-3">{error}</div>
          ) : copilot ? (
            <div className="d-flex flex-column gap-3">
              {/* Customer Problem Banner */}
              <div className="p-3 bg-white rounded-3 border">
                <span className="text-muted d-block small fw-bold mb-1">CUSTOMER REPORTED ISSUE:</span>
                <p className="mb-0 text-dark small fst-italic">
                  "{booking.notes || booking.description || booking.problemDescription || 'Inspection requested'}"
                </p>
              </div>

              {/* Hazard Safety Warning */}
              {copilot.hazardSafetyAlert && (
                <div className="p-3 rounded-3 border border-warning-subtle bg-warning-subtle d-flex align-items-start gap-2">
                  <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="fw-bold small text-dark d-block">On-Site Safety Caution:</span>
                    <span className="small text-dark">{copilot.hazardSafetyAlert}</span>
                  </div>
                </div>
              )}

              {/* Tools & Parts Checklist */}
              <div className="p-3 bg-white rounded-3 border">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-bold text-dark small d-flex align-items-center gap-1">
                    <Wrench size={16} className="text-primary" /> Tools & Spares to Pack Before Leaving:
                  </span>
                  <span className="badge bg-light text-secondary border small">
                    {Object.values(checkedItems).filter(Boolean).length} of{' '}
                    {(copilot.requiredTools?.length || 0) + (copilot.likelySpareParts?.length || 0)} Packed
                  </span>
                </div>

                <div className="row g-2">
                  {copilot.requiredTools?.map((tool, idx) => {
                    const isChecked = !!checkedItems[tool];
                    return (
                      <div className="col-12 col-sm-6" key={`tool-${idx}`}>
                        <div
                          className={`p-2 rounded-2 border d-flex align-items-center gap-2 cursor-pointer transition ${
                            isChecked ? 'bg-success-subtle border-success text-success' : 'bg-light'
                          }`}
                          style={{ cursor: 'pointer', fontSize: '0.8rem' }}
                          onClick={() => toggleCheck(tool)}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheck(tool)}
                            className="form-check-input mt-0"
                          />
                          <span className={isChecked ? 'text-decoration-line-through text-muted' : 'text-dark fw-medium'}>
                            {tool}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {copilot.likelySpareParts?.map((part, idx) => {
                    const isChecked = !!checkedItems[part];
                    return (
                      <div className="col-12 col-sm-6" key={`part-${idx}`}>
                        <div
                          className={`p-2 rounded-2 border d-flex align-items-center gap-2 cursor-pointer transition ${
                            isChecked ? 'bg-success-subtle border-success text-success' : 'bg-light'
                          }`}
                          style={{ cursor: 'pointer', fontSize: '0.8rem' }}
                          onClick={() => toggleCheck(part)}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheck(part)}
                            className="form-check-input mt-0"
                          />
                          <span className={isChecked ? 'text-decoration-line-through text-muted' : 'text-dark fw-medium'}>
                            📦 {part}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step by Step Protocol */}
              {copilot.stepByStepProtocol && copilot.stepByStepProtocol.length > 0 && (
                <div className="p-3 bg-white rounded-3 border">
                  <span className="fw-bold text-dark small d-flex align-items-center gap-1 mb-2">
                    <CheckCircle2 size={16} className="text-success" /> Step-by-Step Diagnostic Protocol:
                  </span>
                  <ol className="mb-0 ps-3 small text-secondary">
                    {copilot.stepByStepProtocol.map((step, idx) => (
                      <li key={idx} className="mb-1">
                        {step.replace(/^\d+\.\s*/, '')}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* 1-Tap Customer Quick Updates */}
              {copilot.quickCustomerReplies && copilot.quickCustomerReplies.length > 0 && (
                <div className="p-3 bg-white rounded-3 border">
                  <span className="fw-bold text-dark small d-flex align-items-center gap-1 mb-2">
                    <MessageSquare size={16} className="text-primary" /> 1-Tap Customer Status Messages ({lang === 'ta' ? 'தமிழ்' : 'English'}):
                  </span>
                  <div className="d-flex flex-column gap-2">
                    {copilot.quickCustomerReplies.map((reply) => {
                      const textToSend = (lang === 'ta' && reply.ta) ? reply.ta : reply.en;
                      const isCopied = copiedId === reply.id;
                      return (
                        <div key={reply.id} className="p-2 bg-light rounded-2 border d-flex align-items-center justify-content-between gap-2">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span className="badge bg-secondary-subtle text-secondary small mb-1">{reply.title}</span>
                            <p className="mb-0 small text-dark text-truncate" style={{ fontSize: '0.78rem' }} title={textToSend}>
                              "{textToSend}"
                            </p>
                          </div>
                          <div className="d-flex align-items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              className={`btn btn-sm ${isCopied ? 'btn-success' : 'btn-outline-primary'} py-1 px-2`}
                              style={{ fontSize: '0.72rem' }}
                              onClick={() => handleCopyText(reply.id, textToSend)}
                            >
                              {isCopied ? <Check size={12} /> : <Copy size={12} />}
                              <span className="ms-1">{isCopied ? 'Copied' : 'Copy'}</span>
                            </button>
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(textToSend)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-sm btn-outline-success py-1 px-2"
                                style={{ fontSize: '0.72rem' }}
                                title="Send via WhatsApp"
                              >
                                WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-light border-top d-flex justify-content-end">
          <button type="button" className="btn btn-secondary btn-sm px-4 rounded-pill" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

