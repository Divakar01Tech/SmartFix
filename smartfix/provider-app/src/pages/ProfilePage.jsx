import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { User, Phone, MapPin, Wrench, DollarSign, Save, Loader, ToggleLeft, ToggleRight } from 'lucide-react';

const TRADES = [
  'Plumbing', 'Electrical Repairs', 'AC Service & Repair',
  'Refrigerator Repair', 'Washing Machine Repair',
  'Water Purifier Service', 'Carpentry', 'Painting', 'Cleaning', 'Other',
];

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', location: '', trade: '', ratePerHour: '', isAvailable: true });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) setForm({ name: user.name || '', phone: user.phone || '', location: user.location || '', trade: user.trade || 'Plumbing', ratePerHour: user.ratePerHour || '', isAvailable: user.isAvailable !== false });
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      const res = await authAPI.updateProfile({ ...form, ratePerHour: Number(form.ratePerHour) });
      setUser(res.data.user);
      localStorage.setItem('hb_provider_user', JSON.stringify(res.data.user));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: '560px' }}>
      <h1 className="mb-8">My Profile</h1>
      <p className="text-muted mb-24">Manage your professional account</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0D0D1A', fontWeight: 800, fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{user?.name}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{user?.trade} Professional</div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input type="tel" className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Location / City</label>
              <input type="text" className="form-input" placeholder="City, State" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Trade Specialization</label>
              <select className="form-input" value={form.trade} onChange={e => setForm({ ...form, trade: e.target.value })}>
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Rate per Hour (₹)</label>
              <input type="number" className="form-input" value={form.ratePerHour} onChange={e => setForm({ ...form, ratePerHour: e.target.value })} />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="form-label" style={{ margin: 0 }}>Available for Jobs</label>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: form.isAvailable ? 'var(--primary)' : 'var(--text-muted)' }}
                onClick={() => setForm({ ...form, isAvailable: !form.isAvailable })}>
                {form.isAvailable ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>
            {error && <div style={{ background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)', color: 'var(--danger)', padding: '12px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>{error}</div>}
            {saved && <div style={{ background: 'var(--primary-glow)', border: '1px solid var(--border-glow)', color: 'var(--primary)', padding: '12px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>✅ Profile updated!</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
              {saving ? <><Loader size={16} className="spin-icon" /> Saving...</> : <><Save size={16} /> Save Changes</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
