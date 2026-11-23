import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Receipt, 
  CheckCircle2, 
  Copy, 
  Check, 
  MessageSquare, 
  Wrench, 
  ShieldCheck, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { apiService } from '../services/api';

export default function WorkerAiInvoiceModal({ booking, onClose, onAttachToProof }) {
  const [workDone, setWorkDone] = useState('');
  const [partsUsed, setPartsUsed] = useState('');
  const [laborAmount, setLaborAmount] = useState(booking?.price || 350);
  const [partsAmount, setPartsAmount] = useState(0);
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [attached, setAttached] = useState(false);

  if (!booking) return null;

  const customerPhone = booking.customer?.phone || booking.customerPhone || '';
  const cleanPhone = customerPhone.replace(/\D/g, '');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setInvoice(null);
    setAttached(false);

    try {
      const data = await apiService.getWorkerInvoiceSummary(
        booking._id || booking.id,
        workDone || 'Inspection and diagnostic maintenance',
        partsUsed || 'Standard fasteners & materials',
        laborAmount,
        partsAmount,
        lang
      );
      setInvoice(data);
    } catch (err) {
      console.error('Invoice generation error:', err);
      setError('Failed to generate AI invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = (text) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAttachProof = () => {
    if (!invoice) return;
    const proofSummary = `[SmartFix AI Work Invoice]\nTitle: ${invoice.summaryTitle}\nSummary: ${invoice.customerSummary?.en || ''}\nTotal: ₹${invoice.totalAmount}\nWarranty: ${invoice.warrantyNote}`;
    if (onAttachToProof) {
      onAttachToProof(proofSummary);
      setAttached(true);
    }
  };

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
        style={{ maxWidth: '620px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-dark text-white d-flex align-items-center justify-content-between border-bottom border-secondary">
          <div className="d-flex align-items-center gap-2">
            <div className="p-2 rounded-3 bg-primary text-white d-flex align-items-center justify-content-center">
              <Receipt size={18} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold fs-6">AI Job Invoice & Work Proof Generator</h5>
              <small className="text-secondary" style={{ fontSize: '0.75rem' }}>
                Booking #{String(booking._id || '').slice(-6)} • {booking.customer?.name || 'Customer'}
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
            <button type="button" className="btn btn-sm btn-link text-white p-1" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto" style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          {/* Inputs Section */}
          <div className="bg-white p-3 rounded-3 border shadow-sm mb-3">
            <h6 className="fw-bold text-dark mb-2" style={{ fontSize: '0.85rem' }}>
              1. Enter Quick Work Notes
            </h6>
            <div className="mb-2">
              <label className="form-label text-muted small mb-1">What repair/service did you complete?</label>
              <input
                type="text"
                className="form-control form-control-sm rounded-3"
                placeholder="e.g. Replaced capacitor, cleaned cooling coils, checked gas pressure"
                value={workDone}
                onChange={(e) => setWorkDone(e.target.value)}
              />
            </div>
            <div className="row g-2 mb-2">
              <div className="col-12 col-md-6">
                <label className="form-label text-muted small mb-1">Parts / Materials Used (Optional)</label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-3"
                  placeholder="e.g. 3.15uF Capacitor, Teflon Tape"
                  value={partsUsed}
                  onChange={(e) => setPartsUsed(e.target.value)}
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label text-muted small mb-1">Labor (₹)</label>
                <input
                  type="number"
                  className="form-control form-control-sm rounded-3"
                  value={laborAmount}
                  onChange={(e) => setLaborAmount(e.target.value)}
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label text-muted small mb-1">Parts Cost (₹)</label>
                <input
                  type="number"
                  className="form-control form-control-sm rounded-3"
                  value={partsAmount}
                  onChange={(e) => setPartsAmount(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm w-100 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2 mt-2"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  <span>Drafting Professional Invoice...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate AI Invoice & Customer Handover</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="alert alert-danger py-2 px-3 rounded-3 small mb-3 d-flex align-items-center gap-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* AI Generated Invoice Output */}
          {invoice && (
            <div className="bg-white p-3 rounded-3 border shadow-sm animate__animated animate__fadeIn">
              <div className="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <CheckCircle2 size={18} className="text-success" />
                  <span className="fw-bold text-dark fs-6">{invoice.summaryTitle}</span>
                </div>
                <span className="badge bg-success-subtle text-success border border-success-subtle">
                  Total: ₹{invoice.totalAmount}
                </span>
              </div>

              {/* Customer Summary */}
              <div className="p-2 rounded-2 bg-light mb-3">
                <small className="text-muted d-block fw-bold" style={{ fontSize: '0.7rem' }}>
                  {lang === 'ta' ? 'வாடிக்கையாளர் அறிக்கை (தமிழ்):' : 'Customer Service Summary:'}
                </small>
                <p className="mb-0 small text-dark">
                  {invoice.customerSummary?.[lang] || invoice.customerSummary?.en}
                </p>
              </div>

              {/* Itemized Table */}
              <div className="table-responsive mb-3">
                <table className="table table-sm table-bordered mb-0 small">
                  <thead className="table-light">
                    <tr>
                      <th>Service / Item</th>
                      <th className="text-end" style={{ width: '100px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.itemizedBill?.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.item}</td>
                        <td className="text-end fw-semibold">₹{item.cost}</td>
                      </tr>
                    ))}
                    <tr className="table-primary fw-bold">
                      <td>Total Payable</td>
                      <td className="text-end">₹{invoice.totalAmount}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Warranty & Care Tip */}
              <div className="d-flex flex-column gap-2 mb-3">
                <div className="p-2 rounded-2 bg-info-subtle text-info-emphasis d-flex align-items-center gap-2">
                  <ShieldCheck size={16} className="text-info flex-shrink-0" />
                  <small style={{ fontSize: '0.75rem' }}>
                    <strong>Warranty:</strong> {invoice.warrantyNote}
                  </small>
                </div>
                {(invoice.customerCareTip?.[lang] || invoice.customerCareTip?.en) && (
                  <div className="p-2 rounded-2 bg-warning-subtle text-warning-emphasis d-flex align-items-center gap-2">
                    <Wrench size={16} className="text-warning-emphasis flex-shrink-0" />
                    <small style={{ fontSize: '0.75rem' }}>
                      <strong>Preventive Tip:</strong> {invoice.customerCareTip?.[lang] || invoice.customerCareTip?.en}
                    </small>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="d-flex flex-wrap gap-2 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-1"
                  onClick={() => handleCopyText(invoice.smsWhatsAppMessage || invoice.customerSummary?.en)}
                >
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy Receipt'}</span>
                </button>

                {cleanPhone && (
                  <a
                    href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(invoice.smsWhatsAppMessage || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline-success btn-sm rounded-3 d-flex align-items-center gap-1"
                  >
                    <MessageSquare size={14} /> Send WhatsApp
                  </a>
                )}

                {onAttachToProof && (
                  <button
                    type="button"
                    className={`btn btn-sm rounded-3 d-flex align-items-center gap-1 ms-auto ${attached ? 'btn-success text-white' : 'btn-primary'}`}
                    onClick={handleAttachProof}
                    disabled={attached}
                  >
                    <FileText size={14} />
                    <span>{attached ? '✓ Attached to Notes' : 'Attach to Job Notes'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

