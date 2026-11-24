import { useState, useEffect } from 'react';
import { apiService, getApiBase } from '../services/api';
import { Camera, CheckCircle2, AlertTriangle, Eye, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';

export default function JobProofVerificationCard({ bookingId, isWorker = false, onProofUpdated }) {
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingKind, setUploadingKind] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const apiBase = getApiBase();

  const fetchProof = async () => {
    try {
      setLoading(true);
      const data = await apiService.getJobProof(bookingId);
      setProof(data);
    } catch (err) {
      console.warn('Failed to load job proof:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingId) fetchProof();
  }, [bookingId]);

  const handleFileUpload = async (e, kind) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingKind(kind);
    setErrorMsg('');
    try {
      const res = await apiService.uploadJobProof(bookingId, file, kind);
      setProof(res.jobProof);
      if (res.isReused) {
        alert('Notice: This image matches a previously recorded job photo. Administration will review.');
      }
      if (typeof onProofUpdated === 'function') {
        onProofUpdated(res.jobProof);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed');
    } finally {
      setUploadingKind(null);
    }
  };

  const handleVerifyAi = async () => {
    setVerifying(true);
    setErrorMsg('');
    try {
      const aiResult = await apiService.verifyJobProof(bookingId);
      setProof((prev) => ({ ...prev, ai: aiResult }));
    } catch (err) {
      setErrorMsg(err.message || 'Verification error');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="p-3 text-center text-muted small">Loading job proof details...</div>;
  }

  const beforePhoto = (proof?.before || []).slice(-1)[0];
  const afterPhoto = (proof?.after || []).slice(-1)[0];
  const ai = proof?.ai;

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h3 className="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
          <Camera size={18} className="text-primary" />
          <span>Before & After Job Verification / வேலை சரிபார்ப்பு</span>
        </h3>

        {/* AI Verdict Badge */}
        {ai && ai.verdict !== 'not_run' && (
          <span
            className={`badge px-3 py-2 rounded-pill d-inline-flex align-items-center gap-1 ${
              ai.verdict === 'verified'
                ? 'bg-success-subtle text-success border border-success-subtle'
                : ai.verdict === 'suspicious'
                ? 'bg-danger-subtle text-danger border border-danger-subtle'
                : 'bg-warning-subtle text-warning border border-warning-subtle'
            }`}
            style={{ fontSize: '0.75rem', fontWeight: '700' }}
          >
            {ai.verdict === 'verified' ? (
              <>
                <CheckCircle2 size={13} /> Work verified by AI ✓
              </>
            ) : (
              <>
                <AlertTriangle size={13} /> Under review ⚠️ ({ai.verdict})
              </>
            )}
          </span>
        )}
      </div>

      {errorMsg && <div className="alert alert-danger py-2 small mb-3">{errorMsg}</div>}

      {/* Side-by-Side Comparison Slots */}
      <div className="row g-3">
        {/* Before Photo */}
        <div className="col-6">
          <div className="border rounded-3 p-3 bg-light text-center" style={{ minHeight: '160px' }}>
            <div className="small fw-bold text-muted mb-2">1. Before Starting</div>
            {beforePhoto ? (
              <div>
                <img
                  src={beforePhoto.url.startsWith('http') ? beforePhoto.url : `${apiBase}${beforePhoto.url}`}
                  alt="Before Repair"
                  className="img-fluid rounded mb-2 shadow-2xs"
                  style={{ maxHeight: '140px', objectFit: 'cover' }}
                />
                <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                  Uploaded: {new Date(beforePhoto.uploadedAt).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="py-4 text-muted small">
                {isWorker ? (
                  <label className="btn btn-sm btn-outline-primary rounded-pill px-3 cursor-pointer">
                    <Camera size={14} className="me-1 inline-block" /> Upload Before Photo
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingKind === 'before'}
                      onChange={(e) => handleFileUpload(e, 'before')}
                    />
                  </label>
                ) : (
                  <span>No before photo uploaded yet</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* After Photo */}
        <div className="col-6">
          <div className="border rounded-3 p-3 bg-light text-center" style={{ minHeight: '160px' }}>
            <div className="small fw-bold text-muted mb-2">2. After Finishing</div>
            {afterPhoto ? (
              <div>
                <img
                  src={afterPhoto.url.startsWith('http') ? afterPhoto.url : `${apiBase}${afterPhoto.url}`}
                  alt="After Repair"
                  className="img-fluid rounded mb-2 shadow-2xs"
                  style={{ maxHeight: '140px', objectFit: 'cover' }}
                />
                <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                  Uploaded: {new Date(afterPhoto.uploadedAt).toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="py-4 text-muted small">
                {isWorker ? (
                  <label className="btn btn-sm btn-outline-primary rounded-pill px-3 cursor-pointer">
                    <Camera size={14} className="me-1 inline-block" /> Upload After Photo
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingKind === 'after'}
                      onChange={(e) => handleFileUpload(e, 'after')}
                    />
                  </label>
                ) : (
                  <span>No after photo uploaded yet</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Analysis Result Explanation */}
      {ai && ai.observations && (
        <div className="mt-3 p-3 rounded-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div className="d-flex align-items-center gap-1 text-dark fw-bold mb-1" style={{ fontSize: '0.8rem' }}>
            <Sparkles size={14} className="text-primary" /> AI Vision Analysis
          </div>
          <p className="mb-0 text-muted small" style={{ lineHeight: 1.4 }}>
            {ai.observations}
          </p>
          {ai.completionConfidence > 0 && (
            <div className="mt-1 small text-dark fw-semibold" style={{ fontSize: '0.74rem' }}>
              Completion Confidence: {ai.completionConfidence}%
            </div>
          )}
        </div>
      )}

      {/* Trigger AI Verification Button */}
      {beforePhoto && afterPhoto && (!ai || ai.verdict === 'not_run' || isWorker) && (
        <div className="mt-3 text-end">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1"
            disabled={verifying}
            onClick={handleVerifyAi}
          >
            {verifying ? (
              <>
                <RefreshCw size={13} className="spin" /> Verifying with AI...
              </>
            ) : (
              <>
                <Sparkles size={13} /> Run AI Job Verification
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
