import { useState } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { apiService, getApiBase } from '../services/api';

export default function SOSButton({ bookingId, onTriggered }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');

  const handleSOSConfirm = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Call SOS trigger API
      const token = localStorage.getItem('smartfix_token');
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/sos/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ bookingId, notes }),
      });


      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to trigger SOS alert');
      }

      setSuccessMsg('🚨 SOS Emergency Alert Sent! SmartFix Safety Operations Team & Admin have been notified.');
      setTimeout(() => {
        setShowModal(false);
        setSuccessMsg('');
        if (onTriggered) onTriggered(data.alert);
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-danger font-bold d-inline-flex align-items-center gap-2 shadow-sm"
        style={{ borderRadius: '24px', padding: '8px 18px', backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
        onClick={() => setShowModal(true)}
      >
        <AlertTriangle size={18} className="animate-bounce" />
        <span>SOS Emergency</span>
      </button>

      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-danger shadow-lg">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <ShieldAlert size={22} /> Confirm Emergency SOS Alert
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                {successMsg ? (
                  <div className="alert alert-success d-flex align-items-center gap-2 mb-0">
                    <CheckCircle2 size={24} />
                    <span>{successMsg}</span>
                  </div>
                ) : (
                  <>
                    <p className="fw-semibold text-dark mb-2">
                      Are you sure you want to alert SmartFix Admin & Safety Team immediately?
                    </p>
                    <p className="small text-secondary mb-3">
                      This will generate an urgent priority notification in the Admin Panel and trigger an emergency SMS dispatch to the platform administrator.
                    </p>

                    <div className="mb-3">
                      <label className="form-label small fw-bold text-secondary">Optional Emergency Notes</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        placeholder="e.g. Safety concern, unexpected issue, location emergency..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      ></textarea>
                    </div>

                    {error && <div className="alert alert-danger small py-2 mb-3">{error}</div>}

                    <div className="d-flex justify-content-end gap-2">
                      <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => setShowModal(false)}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger fw-bold px-4"
                        onClick={handleSOSConfirm}
                        disabled={loading}
                      >
                        {loading ? 'Dispatching Alert...' : 'Yes, Alert Admin NOW'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
