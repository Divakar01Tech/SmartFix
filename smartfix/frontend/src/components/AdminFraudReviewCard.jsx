import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Search, 
  User, 
  CreditCard, 
  Eye, 
  FileText,
  Filter
} from 'lucide-react';
import { apiService } from '../services/api';

export default function AdminFraudReviewCard() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('open');
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  const [pendingTxns, setPendingTxns] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [toast, setToast] = useState('');

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const data = await apiService.getAdminFraudFlags({ status: filterStatus });
      setFlags(data.flags || []);
    } catch (err) {
      console.error('Failed to load fraud flags:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, [filterStatus]);

  const handleOpenDetail = async (flagId) => {
    try {
      const data = await apiService.getAdminFraudFlagById(flagId);
      setSelectedFlag(data.flag);
      setPendingTxns(data.pendingTransactions || []);
      setAdminNote(data.flag.adminNote || '');
      setDetailModal(true);
    } catch (err) {
      alert('Failed to load flag details: ' + err.message);
    }
  };

  const handleResolve = async (status) => {
    if (!selectedFlag) return;
    setActionLoading(true);
    try {
      await apiService.updateAdminFraudFlagStatus(selectedFlag._id, status, adminNote);
      setToast(`Flag marked as ${status.toUpperCase()}. Held wallet credits updated.`);
      setDetailModal(false);
      fetchFlags();
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      alert('Action failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white overflow-hidden">
      <div className="card-header bg-dark text-white p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <ShieldAlert size={18} className="text-danger" />
          <h5 className="mb-0 fw-bold fs-6">Fraud &amp; Wallet Abuse Review</h5>
        </div>
        <div className="d-flex align-items-center gap-2">
          <select
            className="form-select form-select-sm bg-light border-0 fw-semibold"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: '130px', fontSize: '0.78rem' }}
          >
            <option value="open">Open Flags</option>
            <option value="cleared">Cleared</option>
            <option value="confirmed">Confirmed</option>
            <option value="">All Flags</option>
          </select>
          <button
            type="button"
            className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
            onClick={fetchFlags}
            style={{ fontSize: '0.75rem' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="card-body p-4">
        {toast && (
          <div className="alert alert-success py-2 px-3 small rounded-3 mb-3 d-flex align-items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{toast}</span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-4 text-muted small">
            <div className="spinner-border spinner-border-sm text-danger mb-2" role="status" />
            <p className="mb-0">Scanning for velocity abuse, linked devices, and repeat pair collusion...</p>
          </div>
        ) : flags.length === 0 ? (
          <div className="p-4 text-center bg-light rounded-3 text-muted small">
            <CheckCircle2 size={32} className="text-success mb-2" />
            <p className="mb-0 fw-semibold">No {filterStatus} fraud flags detected.</p>
          </div>
        ) : (
          <div className="table-responsive rounded-3 border">
            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.78rem' }}>
              <thead className="table-light">
                <tr>
                  <th>Type</th>
                  <th>Risk Score</th>
                  <th>Subject User</th>
                  <th>Signals</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => {
                  const score = flag.score || 0;
                  const badgeColor = score >= 80 ? 'bg-danger text-white' : 'bg-warning text-dark';

                  return (
                    <tr key={flag._id}>
                      <td>
                        <span className="badge bg-light text-dark border">
                          {flag.type}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${badgeColor} px-2 py-1`}>
                          {score} / 100
                        </span>
                      </td>
                      <td>
                        <strong>{flag.subjectUserId?.name || 'User'}</strong>
                        <div className="text-muted small">{flag.subjectUserId?.email}</div>
                      </td>
                      <td>
                        <span className="text-secondary">
                          {flag.signals?.length || 0} signal(s) triggered
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          flag.status === 'open' ? 'bg-warning-subtle text-warning-emphasis' :
                          flag.status === 'confirmed' ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'
                        }`}>
                          {flag.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-muted">
                        {new Date(flag.createdAt).toLocaleDateString()}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                          onClick={() => handleOpenDetail(flag._id)}
                          style={{ fontSize: '0.75rem' }}
                        >
                          <Eye size={13} /> Review Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Detail Inspection Modal */}
        {detailModal && selectedFlag && (
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
            onClick={() => setDetailModal(false)}
          >
            <div 
              className="card border-0 shadow-lg rounded-4 overflow-hidden w-100"
              style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 bg-dark text-white d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <ShieldAlert size={18} className="text-danger" />
                  <h6 className="mb-0 fw-bold">Fraud Flag Inspection: #{String(selectedFlag._id).slice(-6)}</h6>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setDetailModal(false)} />
              </div>

              <div className="p-4 overflow-y-auto" style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                {/* Score & Type Banner */}
                <div className="p-3 bg-white rounded-3 border mb-3 d-flex align-items-center justify-content-between">
                  <div>
                    <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.68rem' }}>Violation Pattern</small>
                    <strong className="text-dark fs-6">{selectedFlag.type}</strong>
                  </div>
                  <div className="text-end">
                    <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.68rem' }}>Confidence Score</small>
                    <span className={`badge ${selectedFlag.score >= 80 ? 'bg-danger' : 'bg-warning text-dark'} fs-6`}>
                      {selectedFlag.score} / 100
                    </span>
                  </div>
                </div>

                {/* AI Explanation */}
                {selectedFlag.aiExplanation && (
                  <div className="p-3 bg-primary-subtle rounded-3 border border-primary-subtle mb-3">
                    <strong className="d-block text-primary small mb-1">
                      🤖 AI Risk Analysis &amp; Explanation
                    </strong>
                    <p className="mb-2 text-dark small">
                      {selectedFlag.aiExplanation.summary}
                    </p>
                    {selectedFlag.aiExplanation.suggestedAdminChecks && (
                      <div>
                        <small className="text-secondary fw-bold d-block" style={{ fontSize: '0.7rem' }}>
                          Suggested Admin Verification Steps:
                        </small>
                        <ul className="mb-0 ps-3 small text-secondary">
                          {selectedFlag.aiExplanation.suggestedAdminChecks.map((check, i) => (
                            <li key={i}>{check}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Signals List */}
                <div className="bg-white p-3 rounded-3 border mb-3">
                  <h6 className="fw-bold text-dark mb-2" style={{ fontSize: '0.82rem' }}>
                    Triggered Signals ({selectedFlag.signals?.length || 0})
                  </h6>
                  <div className="d-flex flex-column gap-2">
                    {selectedFlag.signals?.map((sig, idx) => (
                      <div key={idx} className="p-2 bg-light rounded-2 border d-flex justify-content-between align-items-center">
                        <span className="small text-dark">{sig.detail}</span>
                        <span className="badge bg-secondary-subtle text-secondary ms-2" style={{ fontSize: '0.68rem' }}>
                          +{sig.weight} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Held Transactions */}
                {pendingTxns.length > 0 && (
                  <div className="p-3 bg-warning-subtle rounded-3 border border-warning-subtle mb-3">
                    <strong className="d-block text-warning-emphasis small mb-1">
                      ⚠️ Wallet Credits on Hold ({pendingTxns.length})
                    </strong>
                    <div className="small text-secondary">
                      {pendingTxns.map((t, idx) => (
                        <div key={idx} className="d-flex justify-content-between py-1 border-bottom border-warning-subtle">
                          <span>{t.description}</span>
                          <strong>₹{t.amount}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Note Input */}
                <div className="mb-3">
                  <label className="form-label text-muted small mb-1">Admin Decision Notes</label>
                  <textarea
                    className="form-control form-control-sm rounded-3"
                    rows="2"
                    placeholder="Enter reason for clearing or confirming this flag..."
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                  />
                </div>

                {/* Resolution CTA Buttons */}
                {selectedFlag.status === 'open' && (
                  <div className="d-flex gap-2 pt-2 border-top">
                    <button
                      type="button"
                      className="btn btn-success btn-sm flex-fill fw-bold rounded-3"
                      onClick={() => handleResolve('cleared')}
                      disabled={actionLoading}
                    >
                      ✓ Clear Flag (Release Credits)
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm flex-fill fw-bold rounded-3"
                      onClick={() => handleResolve('confirmed')}
                      disabled={actionLoading}
                    >
                      ✕ Confirm Fraud (Revoke Bonus)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
