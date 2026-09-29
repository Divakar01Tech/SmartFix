import { useState, useEffect } from 'react';
import { getCommissionConfig, updateCommissionConfig } from '../services/adminAPI';
import { Settings, Save, Loader, Percent, Clock, Gift } from 'lucide-react';

export default function CommissionPage() {
  const [config, setConfig] = useState({ commissionRate: 10, cashbackRate: 5, slaTimeMinutes: 60 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCommissionConfig().then(r => {
      setConfig(r.data.config || r.data || { commissionRate: 10, cashbackRate: 5, slaTimeMinutes: 60 });
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      await updateCommissionConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
      <Loader size={32} className="spin-icon" color="var(--primary)" />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1>Commission & SLA Config</h1>
      </div>

      {/* Preview Cards */}
      <div className="grid-3 mb-24">
        {[
          { icon: Percent, label: 'Commission Rate', value: `${config.commissionRate}%`, desc: 'of every booking price' },
          { icon: Gift, label: 'Customer Cashback', value: `${config.cashbackRate}%`, desc: 'of commission amount' },
          { icon: Clock, label: 'SLA Time Limit', value: `${config.slaTimeMinutes} min`, desc: 'Provider must arrive within' },
        ].map(({ icon: Icon, label, value, desc }) => (
          <div key={label} className="card card-glow">
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-glow)', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} />
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary-light)', marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Config Form */}
      <div className="card" style={{ maxWidth: '540px' }}>
        <div className="card-header"><h3>Edit Configuration</h3></div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Commission Rate (%)</label>
              <input type="number" className="form-input" min="1" max="50"
                value={config.commissionRate}
                onChange={e => setConfig({ ...config, commissionRate: Number(e.target.value) })}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Platform takes {config.commissionRate}% of every booking. Provider earns {100 - config.commissionRate}%.
              </span>
            </div>
            <div className="form-group">
              <label className="form-label">Customer Cashback Rate (% of commission)</label>
              <input type="number" className="form-input" min="0" max="100"
                value={config.cashbackRate}
                onChange={e => setConfig({ ...config, cashbackRate: Number(e.target.value) })}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Customer gets {config.cashbackRate}% of the commission as cashback in their wallet.
              </span>
            </div>
            <div className="form-group">
              <label className="form-label">SLA Time Limit (minutes)</label>
              <input type="number" className="form-input" min="5" max="300"
                value={config.slaTimeMinutes}
                onChange={e => setConfig({ ...config, slaTimeMinutes: Number(e.target.value) })}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Provider must arrive within {config.slaTimeMinutes} minutes after accepting or SLA breach is triggered.
              </span>
            </div>

            {error && <div className="error-box mb-16">{error}</div>}
            {saved && <div className="success-box mb-16">✅ Configuration saved successfully!</div>}

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={saving}>
              {saving ? <><Loader size={16} className="spin-icon" /> Saving...</>
                      : <><Save size={16} /> Save Configuration</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
