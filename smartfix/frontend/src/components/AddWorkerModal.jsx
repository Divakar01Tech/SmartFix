import { useState } from 'react';
import { HOME_SERVICES } from '../data/servicesData';
import { apiService } from '../services/api';
import { saveWorkerToStorage } from '../data/mockData';
import { User, Phone, Wrench, MapPin, DollarSign, Award, X, CheckCircle2, Plus } from 'lucide-react';
import './AddWorkerModal.css';

const EMOJI_AVATARS = ['👨‍🔧', '👩‍🔧', '⚡', '❄️', '💧', '🪵', '🎨', '⚙️', '🏗️'];

const AddWorkerModal = ({ onClose, onWorkerAdded }) => {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    trade: 'Plumbing',
    subServices: [],
    location: 'Sivagangai Town',
    ratePerHour: '350',
    experience: '5 years',
    avatar: '👨‍🔧',
    lat: '9.8433',
    lng: '78.4809',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const selectedCategory = HOME_SERVICES.find((s) => s.name === form.trade) || HOME_SERVICES[0];

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'trade') {
      const cat = HOME_SERVICES.find((s) => s.name === value);
      setForm({
        ...form,
        trade: value,
        subServices: cat && cat.subServices ? [cat.subServices[0]] : [],
      });
    } else {
      setForm({ ...form, [name]: value });
    }
    setError('');
  };

  const handleSubServiceToggle = (sub) => {
    setForm((prev) => {
      const current = prev.subServices || [];
      const updated = current.includes(sub)
        ? current.filter((s) => s !== sub)
        : [...current, sub];
      return { ...prev, subServices: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Please enter the worker name.');
      return;
    }
    if (!form.phone.trim()) {
      setError('Please enter a valid phone number.');
      return;
    }

    setSubmitting(true);

    const workerPayload = {
      id: `w_${Date.now()}`,
      _id: `w_${Date.now()}`,
      name: form.name.trim(),
      phone: form.phone.trim(),
      trade: form.trade,
      subServices: form.subServices.length > 0 ? form.subServices : [selectedCategory.subServices[0]],
      location: form.location.trim() || 'Sivagangai Town',
      ratePerHour: Number(form.ratePerHour) || 350,
      rating: 4.9,
      ratingCount: 1,
      experience: form.experience || '3 years',
      avatar: form.avatar || '👨‍🔧',
      lat: Number(form.lat) || 9.8433,
      lng: Number(form.lng) || 78.4809,
    };

    try {
      const savedWorker = await apiService.createWorker(workerPayload);
      setSuccess(true);
      setTimeout(() => {
        if (onWorkerAdded) onWorkerAdded(savedWorker || workerPayload);
        onClose();
      }, 1000);
    } catch (err) {
      console.warn('API error, saving worker locally:', err.message);
      const savedWorker = saveWorkerToStorage(workerPayload);
      setSuccess(true);
      setTimeout(() => {
        if (onWorkerAdded) onWorkerAdded(savedWorker);
        onClose();
      }, 1000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-worker-modal-overlay" onClick={onClose}>
      <div className="add-worker-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="add-worker-header">
          <div className="aw-header-title">
            <div className="aw-icon-box">
              <Plus size={22} color="#ffffff" />
            </div>
            <div>
              <h3>Add New Worker Manually</h3>
              <p>Create and list a new service professional on the website</p>
            </div>
          </div>
          <button type="button" className="aw-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="aw-success-state">
            <CheckCircle2 size={54} color="#059669" />
            <h3>Worker Added Successfully!</h3>
            <p><strong>{form.name}</strong> ({form.trade}) has been listed and is now live on the website.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="add-worker-form">
            <div className="aw-form-grid">
              {/* Full Name */}
              <div className="aw-form-group">
                <label><User size={15} /> Worker Full Name *</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Ramesh Kumar"
                  required
                />
              </div>

              {/* Phone Number */}
              <div className="aw-form-group">
                <label><Phone size={15} /> Mobile Phone Number *</label>
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="e.g. +91 98765 43210"
                  required
                />
              </div>

              {/* Trade Selection */}
              <div className="aw-form-group">
                <label><Wrench size={15} /> Primary Trade / Category *</label>
                <select name="trade" value={form.trade} onChange={handleChange}>
                  {HOME_SERVICES.map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hourly Rate */}
              <div className="aw-form-group">
                <label><DollarSign size={15} /> Hourly Rate (₹/hr) *</label>
                <input
                  type="number"
                  name="ratePerHour"
                  value={form.ratePerHour}
                  onChange={handleChange}
                  placeholder="350"
                  required
                />
              </div>

              {/* Location */}
              <div className="aw-form-group">
                <label><MapPin size={15} /> Service Location / Town *</label>
                <input
                  type="text"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="e.g. Sivagangai Town / Karaikudi"
                  required
                />
              </div>

              {/* Experience */}
              <div className="aw-form-group">
                <label><Award size={15} /> Years of Experience</label>
                <input
                  type="text"
                  name="experience"
                  value={form.experience}
                  onChange={handleChange}
                  placeholder="e.g. 6 years"
                />
              </div>
            </div>

            {/* Avatar Emoji Selector */}
            <div className="aw-avatar-selector">
              <label>Select Avatar Icon:</label>
              <div className="avatar-options-row">
                {EMOJI_AVATARS.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    className={`avatar-option-btn ${form.avatar === emoji ? 'selected' : ''}`}
                    onClick={() => setForm({ ...form, avatar: emoji })}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Services Checklist */}
            {selectedCategory && (
              <div className="aw-subservices-section">
                <label>Select Worker Specialties ({selectedCategory.name}):</label>
                <div className="subservices-checkbox-grid">
                  {selectedCategory.subServices.map((sub) => {
                    const isChecked = form.subServices.includes(sub);
                    return (
                      <div
                        key={sub}
                        className={`sub-checkbox-card ${isChecked ? 'active' : ''}`}
                        onClick={() => handleSubServiceToggle(sub)}
                      >
                        <input type="checkbox" checked={isChecked} onChange={() => {}} />
                        <span>{sub}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {error && <div className="aw-error-alert">{error}</div>}

            <div className="aw-actions-row">
              <button type="button" className="aw-cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="aw-submit-btn" disabled={submitting}>
                {submitting ? 'Adding Worker...' : '➕ Add Worker To Website'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddWorkerModal;
