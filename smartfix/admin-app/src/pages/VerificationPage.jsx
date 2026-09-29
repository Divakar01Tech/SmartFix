import { useState, useEffect } from 'react';
import { getPendingCaptains, verifyCaptain } from '../services/adminAPI';
import { ShieldCheck, CheckCircle2, XCircle, Clock, FileText, Search, Loader, ExternalLink, AlertTriangle } from 'lucide-react';
import './VerificationPage.css';

export default function VerificationPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [search, setSearch] = useState('');
  const [rejectingWorker, setRejectingWorker] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const res = await getPendingCaptains(statusFilter === 'All' ? {} : { status: statusFilter });
      setWorkers(res.data.captains || []);
    } catch (e) {
      console.warn('Verification queue fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, [statusFilter]);

  const handleApprove = async (id, name) => {
    if (!window.confirm(`Approve KYC verification for provider ${name}?`)) return;
    try {
      await verifyCaptain(id, { verificationStatus: 'Verified' });
      setMsg(`✅ Approved ${name} successfully! Account is now Verified.`);
      loadWorkers();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      alert('Failed to approve worker verification.');
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingWorker) return;
    setSubmitting(true);
    try {
      await verifyCaptain(rejectingWorker._id || rejectingWorker.id, {
        verificationStatus: 'Rejected',
        rejectionReason: rejectionReason.trim() || 'Document verification failed. Please re-upload valid IDs.',
      });
      setMsg(`⚠️ Rejected verification for ${rejectingWorker.name}.`);
      setRejectingWorker(null);
      setRejectionReason('');
      loadWorkers();
      setTimeout(() => setMsg(''), 4000);
    } catch (e) {
      alert('Failed to reject worker.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = workers.filter(w =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.phone?.includes(search) ||
    w.aadhaarNumber?.includes(search) ||
    w.trade?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="verification-page">
      <div className="page-header">
        <div>
          <h1>Worker Verification Queue (KYC)</h1>
          <p className="text-muted text-sm">Review Aadhaar card and secondary ID documents submitted by service providers</p>
        </div>
      </div>

      {msg && <div className="success-box mb-16">{msg}</div>}

      {/* Rejection Modal */}
      {rejectingWorker && (
        <div className="modal-overlay">
          <div className="modal">
            <h3 className="mb-8" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={20} color="var(--danger)" /> Reject Verification
            </h3>
            <p className="text-muted text-sm mb-16">
              Rejecting verification for <strong>{rejectingWorker.name}</strong>. Provide a reason for the worker:
            </p>
            <form onSubmit={handleRejectSubmit}>
              <div className="form-group">
                <label className="form-label">Rejection Reason</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="e.g. Aadhaar card image is blurred / Invalid 12-digit number."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setRejectingWorker(null)}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="card mb-16">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="tab-bar">
            {['Pending', 'Verified', 'Rejected', 'All'].map(status => (
              <button
                key={status}
                className={`tab-btn ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status} {status === 'Pending' ? `(${workers.length})` : ''}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search worker, phone, Aadhaar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', minWidth: '240px' }}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><Loader size={32} className="spin-icon" color="var(--primary)" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={40} color="var(--text-muted)" />
            <p>No worker verification requests found in this queue.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider Info</th>
                  <th>Aadhaar Number (12 Digits)</th>
                  <th>Aadhaar Doc</th>
                  <th>Secondary ID Proof</th>
                  <th>ID Doc</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => {
                  const id = w._id || w.id;
                  return (
                    <tr key={id}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{w.name}</div>
                        <div className="font-mono text-sm text-muted">{w.phone}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--primary-light)' }}>{w.trade} · ₹{w.ratePerHour}/hr</div>
                      </td>
                      <td>
                        <span className="font-mono font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                          {w.aadhaarNumber || '—'}
                        </span>
                      </td>
                      <td>
                        {w.aadhaarDocUrl ? (
                          <a href={w.aadhaarDocUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ gap: 4 }}>
                            <FileText size={13} /> View <ExternalLink size={11} />
                          </a>
                        ) : <span className="text-muted text-sm">Not Provided</span>}
                      </td>
                      <td>
                        <div style={{ textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {w.idProofType?.replace('_', ' ') || 'ID Proof'}
                        </div>
                        <div className="font-mono text-sm">{w.idProofNumber || '—'}</div>
                      </td>
                      <td>
                        {w.idProofDocUrl ? (
                          <a href={w.idProofDocUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ gap: 4 }}>
                            <FileText size={13} /> View <ExternalLink size={11} />
                          </a>
                        ) : <span className="text-muted text-sm">Not Provided</span>}
                      </td>
                      <td>
                        <span className={`badge badge-${w.verificationStatus?.toLowerCase() || 'pending'}`}>
                          {w.verificationStatus}
                        </span>
                        {w.verificationStatus === 'Rejected' && w.rejectionReason && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--danger)', marginTop: 4, maxWidth: 160 }}>
                            {w.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {w.verificationStatus !== 'Verified' && (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove(id, w.name)}
                              title="Approve KYC & Activate Worker"
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                          )}
                          {w.verificationStatus !== 'Rejected' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => setRejectingWorker(w)}
                              title="Reject KYC"
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
