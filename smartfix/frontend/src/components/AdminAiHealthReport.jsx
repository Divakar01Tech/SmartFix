import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  RefreshCw 
} from 'lucide-react';
import { apiService } from '../services/api';

export default function AdminAiHealthReport() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.getAdminPlatformHealthReport();
      setReport(data);
    } catch (err) {
      console.error('Failed to fetch AI health report:', err);
      setError('Could not generate AI executive briefing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  return (
    <div 
      className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4"
      style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        color: '#ffffff'
      }}
    >
      <div className="card-body p-4">
        {/* Header */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div className="d-flex align-items-center gap-2">
            <div 
              className="p-2 rounded-3 text-dark d-flex align-items-center justify-content-center"
              style={{ background: '#38bdf8', boxShadow: '0 4px 12px rgba(56, 189, 248, 0.4)' }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold fs-6 text-white d-flex align-items-center gap-2">
                <span>AI Executive Health & Operations Briefing</span>
                <span className="badge bg-info text-dark rounded-pill" style={{ fontSize: '0.72rem' }}>
                  Weekly AI Audit
                </span>
              </h5>
              <small className="text-light" style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                Autonomous intelligence on completion rates, regional demand balancing & growth bottlenecks
              </small>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-light fw-bold rounded-pill px-3 py-1 d-flex align-items-center gap-1 shadow-sm"
            onClick={fetchReport}
            disabled={loading}
            style={{ fontSize: '0.78rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Analyzing Data...' : 'Re-Run AI Audit'}</span>
          </button>
        </div>

        {error && (
          <div className="alert alert-warning py-2 px-3 rounded-3 small mb-2 text-dark">
            {error}
          </div>
        )}

        {loading && !report && (
          <div className="py-4 text-center text-light">
            <div className="spinner-border spinner-border-sm text-info mb-2" role="status" />
            <p className="small mb-0 opacity-75">Synthesizing platform telemetry, booking SLAs, and dispatch efficiency...</p>
          </div>
        )}

        {report && (
          <div className="animate__animated animate__fadeIn">
            {/* Top Score Banner */}
            <div className="row g-3 align-items-center mb-3">
              <div className="col-12 col-md-3">
                <div 
                  className="p-3 rounded-3 text-center border"
                  style={{ background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)' }}
                >
                  <small className="text-uppercase fw-bold text-info d-block" style={{ fontSize: '0.68rem' }}>
                    Platform Health Score
                  </small>
                  <h2 className="mb-0 fw-bolder text-warning">
                    {report.healthScore} / 100
                  </h2>
                  <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill mt-1" style={{ fontSize: '0.7rem' }}>
                    {report.platformStatus}
                  </span>
                </div>
              </div>

              <div className="col-12 col-md-9">
                <div className="row g-2">
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded-2 text-center" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
                      <small className="text-secondary d-block" style={{ fontSize: '0.68rem' }}>Fulfillment Rate</small>
                      <strong className="fs-6 text-white">{report.kpis?.completionRate}</strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded-2 text-center" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
                      <small className="text-secondary d-block" style={{ fontSize: '0.68rem' }}>Active Online Techs</small>
                      <strong className="fs-6 text-white">{report.kpis?.activeWorkersOnline}</strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded-2 text-center" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
                      <small className="text-secondary d-block" style={{ fontSize: '0.68rem' }}>30-Day Orders</small>
                      <strong className="fs-6 text-white">{report.kpis?.totalBookingsLast30Days}</strong>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="p-2 rounded-2 text-center" style={{ background: 'rgba(255, 255, 255, 0.06)' }}>
                      <small className="text-secondary d-block" style={{ fontSize: '0.68rem' }}>Total Registered</small>
                      <strong className="fs-6 text-white">{report.kpis?.totalRegisteredWorkers} Techs</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Strategic Action Insights */}
            <div className="row g-2">
              {report.strategicInsights?.map((item, idx) => (
                <div key={idx} className="col-12 col-md-4">
                  <div 
                    className="p-3 rounded-3 h-100 border"
                    style={{ background: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.15)' }}
                  >
                    <div className="d-flex align-items-center gap-1 mb-1">
                      <Zap size={14} className="text-warning" />
                      <strong className="text-warning small">{item.domain}</strong>
                    </div>
                    <p className="mb-2 text-light small" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                      {item.observation}
                    </p>
                    <div className="p-2 rounded-2" style={{ background: 'rgba(0, 0, 0, 0.25)' }}>
                      <small className="text-info fw-bold d-block" style={{ fontSize: '0.68rem' }}>
                        Recommended Action:
                      </small>
                      <span className="text-white" style={{ fontSize: '0.72rem' }}>
                        {item.action}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

