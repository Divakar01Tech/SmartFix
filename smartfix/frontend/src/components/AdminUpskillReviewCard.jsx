import React, { useState, useEffect } from 'react';
import { Award, ShieldCheck, CheckCircle, XCircle, RefreshCw, UserCheck, Search, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';

export default function AdminUpskillReviewCard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'graduated' | 'active'
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const list = await apiService.getAdminUpskillList(filter);
      setRecords(list);
    } catch (err) {
      console.error('Failed to load upskill records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [filter]);

  const handleDecision = async (workerId, approved) => {
    const note = prompt(
      approved
        ? 'Admin note for awarding Trusted Worker Badge:'
        : 'Admin note for declining badge award:'
    );
    if (note === null) return;

    setActionLoading(workerId);
    try {
      await apiService.adminUpskillBadgeDecision(workerId, approved, note);
      await fetchRecords();
    } catch (err) {
      alert('Error updating badge: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredRecords = records.filter((r) => {
    const name = r.worker?.name?.toLowerCase() || '';
    const trade = r.trade?.toLowerCase() || '';
    const term = searchTerm.toLowerCase();
    return name.includes(term) || trade.includes(term);
  });

  return (
    <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h2 className="fs-5 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
            <Award size={22} color="#f59e0b" />
            <span>SmartFix Upskilling Academy & Trusted Badge Review</span>
          </h2>
          <small className="text-secondary">
            AI recommends based on 70%+ quiz mastery; Admin decides whether to award the Trusted Worker Badge.
          </small>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={fetchRecords}
          >
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div className="btn-group btn-group-sm" role="group">
          <button
            type="button"
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setFilter('all')}
          >
            All Workers
          </button>
          <button
            type="button"
            className={`btn ${filter === 'graduated' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setFilter('graduated')}
          >
            Graduated (Ready for Badge)
          </button>
        </div>

        <div className="input-group input-group-sm" style={{ maxWidth: '280px' }}>
          <span className="input-group-text bg-white">
            <Search size={14} />
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Search by worker or trade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <Loader2 size={32} className="text-primary spin-animation mb-2" />
          <p className="small text-muted">Loading Academy progress records...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="text-center py-5 bg-light rounded-4 border border-dashed">
          <Award size={36} className="text-muted mx-auto mb-2" />
          <h6 className="fw-bold text-dark">No upskilling records found</h6>
          <p className="small text-secondary">
            Workers who completed interview or voluntary upskilling will appear here.
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.86rem' }}>
            <thead className="table-light">
              <tr>
                <th>Worker</th>
                <th>Trade</th>
                <th>Trigger Reason</th>
                <th>Modules & Scores</th>
                <th>Academy Status</th>
                <th>Trusted Badge</th>
                <th className="text-end">Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => {
                const worker = r.worker || {};
                const isGraduated = r.overallStatus === 'graduated';
                const hasBadge = worker.trustedWorkerBadge;
                const isWorking = actionLoading === worker._id;

                return (
                  <tr key={r._id}>
                    <td>
                      <div className="fw-bold text-dark">{worker.name || 'Unknown'}</div>
                      <small className="text-muted">{worker.email}</small>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">{r.trade}</span>
                    </td>
                    <td>
                      <span className="badge bg-secondary-subtle text-secondary small">
                        {r.assignedReason}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex flex-column gap-1">
                        {r.lessons?.map((l, idx) => (
                          <div key={idx} className="small d-flex align-items-center gap-1">
                            {l.completed ? (
                              <CheckCircle size={12} className="text-success" />
                            ) : (
                              <XCircle size={12} className="text-muted" />
                            )}
                            <span>{l.lesson?.topic || `Module ${idx + 1}`}</span>
                            <strong className="text-primary ms-1">{l.quizScore}%</strong>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      {isGraduated ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          Graduated
                        </span>
                      ) : (
                        <span className="badge bg-warning-subtle text-warning border border-warning-subtle">
                          In Progress
                        </span>
                      )}
                    </td>
                    <td>
                      {hasBadge ? (
                        <span className="badge bg-success d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill">
                          <ShieldCheck size={12} /> Trusted
                        </span>
                      ) : (
                        <span className="badge bg-light text-muted border">None</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        {!hasBadge ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-success rounded-pill px-3 py-1"
                            style={{ fontSize: '0.75rem' }}
                            disabled={isWorking}
                            onClick={() => handleDecision(worker._id, true)}
                          >
                            {isWorking ? 'Updating...' : 'Award Badge ⭐'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger rounded-pill px-3 py-1"
                            style={{ fontSize: '0.75rem' }}
                            disabled={isWorking}
                            onClick={() => handleDecision(worker._id, false)}
                          >
                            Revoke Badge
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
  );
}
