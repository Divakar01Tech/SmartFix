import { useState } from 'react';
import { getApiBase } from '../services/api';

const DisputeModal = ({ booking, role, onClose }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason || !description.trim()) {
      setError('Please select a reason and provide a description.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      
      const apiBase = getApiBase();
      const token = localStorage.getItem('smartfix_token') || localStorage.getItem('smartfix_token');
      const res = await fetch(`${apiBase}/disputes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookingId: booking._id || booking.id,
          reason,
          description
        })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => onClose(), 2000);
      } else {
        throw new Error(data.message || 'Failed to submit dispute. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Failed to submit dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content text-center p-4">
            <h4 className="text-success mb-3">Dispute Submitted</h4>
            <p>Your issue has been reported. Our team will review it and get back to you shortly.</p>
          </div>
        </div>
      </div>
    );
  }

  const reasons = role === 'customer' 
    ? ['Quality of Service', 'Overcharged', 'Handyman No-Show', 'Behavioral Issue', 'Other']
    : ['Customer No-Show', 'Unsafe Conditions', 'Payment Denied', 'Other'];

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header border-bottom-0 pb-0">
            <h5 className="modal-title fw-bold text-danger">Report an Issue</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label text-muted small fw-bold">Reason</label>
                <select 
                  className="form-select" 
                  value={reason} 
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Select a reason</option>
                  {reasons.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label text-muted small fw-bold">Description</label>
                <textarea
                  className="form-control"
                  rows="4"
                  placeholder="Please describe the issue in detail..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </div>
              
              {error && <div className="alert alert-danger py-2 small">{error}</div>}
              
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-light w-50" onClick={onClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-danger w-50" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisputeModal;
