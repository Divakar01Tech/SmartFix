import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { workerAPI } from '../services/api';
import { User, Phone, MapPin, Save, Loader } from 'lucide-react';
import './ProfilePage.css';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', phone: user.phone || '', location: user.location || '' });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      const res = await workerAPI.updateProfile(form);
      const updated = res.data.user;
      setUser(updated);
      localStorage.setItem('hb_user', JSON.stringify(updated));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page page-sm profile-page">
      <h1 className="mb-8">My Profile</h1>
      <p className="text-muted mb-24">Manage your account information</p>

      <div className="profile-avatar-section">
        <div className="profile-avatar">{user?.name?.charAt(0).toUpperCase()}</div>
        <div>
          <div className="font-bold" style={{ fontSize: '1.1rem' }}>{user?.name}</div>
          <div className="text-muted text-sm">Customer Account</div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-wrap">
                <User size={18} className="input-icon" />
                <input type="text" className="form-input" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={{ paddingLeft: '44px' }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div className="input-wrap">
                <Phone size={18} className="input-icon" />
                <input type="tel" className="form-input" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  style={{ paddingLeft: '44px' }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Default Location</label>
              <div className="input-wrap">
                <MapPin size={18} className="input-icon" />
                <input type="text" className="form-input" placeholder="City, State"
                  value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  style={{ paddingLeft: '44px' }} />
              </div>
            </div>
            {error && <div className="error-box mb-16">{error}</div>}
            {saved && <div className="success-box mb-16">✅ Profile updated successfully!</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
              {saving ? <><Loader size={16} className="spin-icon" /> Saving...</>
                      : <><Save size={16} /> Save Changes</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
