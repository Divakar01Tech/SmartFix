import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Activity, 
  RefreshCw, 
  ShieldAlert, 
  Save 
} from 'lucide-react';
import { apiService } from '../services/api';

const FEATURE_META = [
  { key: 'fraudDetection', name: 'Fraud & Wallet Abuse Detection', desc: 'Flags bonus exploitation, self-booking, and velocity spikes' },
  { key: 'kycCheck', name: 'AI KYC Document Check', desc: 'Audits ID card clarity, name similarity, and image quality' },
  { key: 'emergencyTriage', name: 'Emergency Triage & Safety Alert', desc: 'Identifies high-risk emergencies (gas leak, shocks) and provides safety tips' },
  { key: 'chatTranslation', name: 'Live Chat Translation (Tamil ↔ English)', desc: 'Real-time bidirectional message translation with Tanglish support' },
  { key: 'supportBot', name: 'Role-Aware Support Chatbot', desc: 'Role-based assistant with tool usage for bookings, status, and tickets' },
  { key: 'voiceBooking', name: 'Tamil Voice Booking', desc: 'Speech-to-text intake and auto-extraction of booking intent' },
  { key: 'jobProofCheck', name: 'Before/After Job Verification', desc: 'Analyzes repair photos and checks for duplicate photo reuse' },
  { key: 'demandInsights', name: 'Worker Demand Insights', desc: 'Aggregates regional demand trends and generates actionable tips' },
  { key: 'appliancePassport', name: 'Appliance Passport', desc: 'Extracts brand, model, and warranty from invoices and sets reminders' },
  { key: 'upskilling', name: 'Worker Upskilling Coach', desc: 'Generates targeted bite-sized lessons and quizzes for weak criteria' },
];

export default function AdminAiSettingsCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({});
  const [recentLogs, setRecentLogs] = useState([]);
  const [featureStats, setFeatureStats] = useState({});
  const [toast, setToast] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiService.getAdminAiSettings();
      if (data && data.settings) {
        setSettings(data.settings);
        setRecentLogs(data.recentLogs || []);
        setFeatureStats(data.featureStats || {});
      }
    } catch (err) {
      console.error('Failed to load AI settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (key) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    setSaving(true);
    try {
      await apiService.updateAdminAiSettings({ [key]: updated[key] });
      setToast(`Feature '${key}' is now ${updated[key] ? 'ENABLED' : 'DISABLED'}`);
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      alert('Failed to save setting: ' + err.message);
      // Revert on failure
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white text-center">
        <div className="spinner-border text-primary mx-auto mb-2" role="status" />
        <p className="text-muted small mb-0">Loading AI Settings & Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white overflow-hidden">
      <div className="card-header bg-dark text-white p-3 d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-2">
          <Sliders size={18} className="text-warning" />
          <h5 className="mb-0 fw-bold fs-6">AI Feature Governance & Settings</h5>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
          onClick={loadData}
          disabled={saving}
          style={{ fontSize: '0.75rem' }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="card-body p-4">
        {toast && (
          <div className="alert alert-info py-2 px-3 small rounded-3 mb-3 d-flex align-items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{toast}</span>
          </div>
        )}

        <p className="text-muted small mb-4">
          Enable or disable specific AI intelligence modules. When disabled, the platform gracefully defaults to offline rules or standard manual workflows without service disruption.
        </p>

        {/* 10 Feature Toggles Grid */}
        <div className="row g-3 mb-4">
          {FEATURE_META.map((item) => {
            const isEnabled = settings[item.key] !== false;
            const stats = featureStats[item.key] || { totalCalls: 0, successRate: 100 };

            return (
              <div key={item.key} className="col-12 col-md-6">
                <div 
                  className={`p-3 rounded-3 border h-100 d-flex flex-column justify-content-between transition-all ${
                    isEnabled ? 'bg-light border-primary-subtle' : 'bg-body-secondary border-secondary-subtle opacity-75'
                  }`}
                >
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <strong className="text-dark small d-flex align-items-center gap-2">
                        <span>{item.name}</span>
                        <span className={`badge ${isEnabled ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '0.65rem' }}>
                          {isEnabled ? 'Active' : 'Disabled'}
                        </span>
                      </strong>

                      {/* Custom Switch */}
                      <div className="form-check form-switch m-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={isEnabled}
                          onChange={() => handleToggle(item.key)}
                          disabled={saving}
                          style={{ cursor: 'pointer', width: '2.4em', height: '1.2em' }}
                        />
                      </div>
                    </div>
                    <p className="text-muted mb-2" style={{ fontSize: '0.75rem' }}>
                      {item.desc}
                    </p>
                  </div>

                  <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-auto">
                    <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
                      Calls: <strong>{stats.totalCalls}</strong>
                    </span>
                    <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
                      Success: <strong className={stats.successRate >= 90 ? 'text-success' : 'text-warning'}>{stats.successRate}%</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Telemetry Log Table (Last 50 calls) */}
        <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-2" style={{ fontSize: '0.9rem' }}>
          <Activity size={16} className="text-primary" />
          <span>Recent AI Execution Audit (Last 50 Logs)</span>
        </h6>

        {recentLogs.length === 0 ? (
          <div className="p-3 text-center bg-light rounded-3 text-muted small">
            No telemetry entries recorded yet.
          </div>
        ) : (
          <div className="table-responsive rounded-3 border" style={{ maxHeight: '280px', overflowY: 'auto' }}>
            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.75rem' }}>
              <thead className="table-light sticky-top">
                <tr>
                  <th>Feature</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Tokens (In/Out)</th>
                  <th>Error Code</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => (
                  <tr key={log._id}>
                    <td>
                      <code className="text-primary fw-semibold">{log.feature}</code>
                    </td>
                    <td>
                      {log.success ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          Success
                        </span>
                      ) : (
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                          Failed
                        </span>
                      )}
                    </td>
                    <td>{log.latencyMs}ms</td>
                    <td>{log.inputTokens} / {log.outputTokens}</td>
                    <td className="text-danger">{log.errorCode || '—'}</td>
                    <td className="text-muted">{new Date(log.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
