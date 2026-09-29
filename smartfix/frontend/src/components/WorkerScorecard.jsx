import { useState, useEffect } from 'react';
import { Award, CheckCircle, Clock, Star, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getApiBase } from '../services/api';

export default function WorkerScorecard({ workerId }) {
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchScorecard();
  }, [workerId]);

  const fetchScorecard = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('smartfix_token');
      const response = await fetch(`${getApiBase()}/workers/scorecard`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load performance scorecard');
      }

      const data = await response.json();
      setScorecard(data.scorecard);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-3 text-muted text-center">Loading performance metrics...</div>;
  }

  if (error || !scorecard) {
    return <div className="alert alert-warning py-2 text-center small">{error || 'Scorecard unavailable'}</div>;
  }

  return (
    <div className="card shadow-sm border-0 mb-4 bg-white rounded-3">
      <div className="card-header bg-gradient-primary text-white py-3 d-flex justify-content-between align-items-center">
        <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
          <Award size={20} /> Worker Performance Scorecard
        </h5>
        {scorecard.trustedWorkerBadge && (
          <span className="badge bg-warning text-dark px-3 py-2 fw-bold d-flex align-items-center gap-1 shadow-xs">
            <ShieldCheck size={16} color="#d97706" /> Trusted Worker Verified
          </span>
        )}
      </div>

      <div className="card-body p-4">
        <div className="row g-3 text-center mb-4">
          {/* Completion Rate */}
          <div className="col-md-3 col-6">
            <div className="p-3 rounded-3 bg-light border">
              <div className="text-secondary small fw-semibold mb-1">Completion Rate</div>
              <div className="fs-3 fw-bold text-success d-flex align-items-center justify-content-center gap-1">
                <CheckCircle size={22} /> {scorecard.completionRate}%
              </div>
              <div className="text-muted extra-small">{scorecard.completedCount} / {scorecard.acceptedCount} Jobs</div>
            </div>
          </div>

          {/* Avg SLA Time */}
          <div className="col-md-3 col-6">
            <div className="p-3 rounded-3 bg-light border">
              <div className="text-secondary small fw-semibold mb-1">Avg Arrival Time</div>
              <div className="fs-3 fw-bold text-primary d-flex align-items-center justify-content-center gap-1">
                <Clock size={22} /> {scorecard.avgSlaTimeMinutes || '18'}m
              </div>
              <div className="text-muted extra-small">Target: &lt; 60 Mins</div>
            </div>
          </div>

          {/* Rating */}
          <div className="col-md-3 col-6">
            <div className="p-3 rounded-3 bg-light border">
              <div className="text-secondary small fw-semibold mb-1">Rating Average</div>
              <div className="fs-3 fw-bold text-warning d-flex align-items-center justify-content-center gap-1">
                <Star size={22} fill="#f59e0b" color="#f59e0b" /> {scorecard.rating ? scorecard.rating.toFixed(1) : '5.0'}
              </div>
              <div className="text-muted extra-small">{scorecard.ratingCount || 0} Customer Reviews</div>
            </div>
          </div>

          {/* No Show Count */}
          <div className="col-md-3 col-6">
            <div className="p-3 rounded-3 bg-light border">
              <div className="text-secondary small fw-semibold mb-1">No-Show Strikes</div>
              <div className={`fs-3 fw-bold d-flex align-items-center justify-content-center gap-1 ${scorecard.noShowCount > 0 ? 'text-danger' : 'text-secondary'}`}>
                <AlertTriangle size={22} /> {scorecard.noShowCount || 0} / 3
              </div>
              <div className="text-muted extra-small">{scorecard.isSuspended ? 'Account Suspended' : 'Clean Record'}</div>
            </div>
          </div>
        </div>

        {/* Rating Trend (Last 10 Reviews) */}
        {scorecard.ratingTrend && scorecard.ratingTrend.length > 0 && (
          <div>
            <h6 className="fw-bold text-dark mb-3">Recent Customer Reviews Trend</h6>
            <div className="d-flex flex-column gap-2">
              {scorecard.ratingTrend.map((rev, idx) => (
                <div key={idx} className="p-2 border-bottom d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-warning text-dark font-mono">
                      ★ {rev.rating}
                    </span>
                    <span className="small text-secondary">{rev.review || 'No review text'}</span>
                  </div>
                  <span className="extra-small text-muted">
                    {new Date(rev.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
