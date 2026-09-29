import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { bookingAPI, dispatchAPI } from '../services/api';
import { MapPin, Calendar, Clock, FileText, DollarSign, ArrowRight, Loader } from 'lucide-react';
import './BookingPage.css';

const CATEGORY_MAP = {
  plumbing: 'Plumbing', electrical: 'Electrical Repairs',
  'ac-service': 'AC Service & Repair', refrigerator: 'Refrigerator Repair',
  'washing-machine': 'Washing Machine Repair', carpentry: 'Carpentry',
  painting: 'Painting', cleaning: 'Cleaning',
  gardening: 'Other', general: 'Other',
};

const TIER_INFO = {
  BikePro: { label: 'Express Pro ⚡', desc: 'Fastest, for minor fixes', color: '#3B82F6' },
  AutoHandyman: { label: 'Standard 🔧', desc: 'Most popular, all services', color: '#FF6B35' },
  MasterTech: { label: 'Master Tech 🏆', desc: 'Complex repairs, specialists', color: '#8B5CF6' },
};

export default function BookingPage() {
  const { category } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const trade = CATEGORY_MAP[category] || 'General';

  const [form, setForm] = useState({
    address: '', notes: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    selectedTier: 'AutoHandyman',
  });
  const [fareEstimates, setFareEstimates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [location, setLocation] = useState({ lat: 9.9252, lng: 78.1198 });
  const [locationName, setLocationName] = useState('');
  const [error, setError] = useState('');

  // Get user's GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationName(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => setLocationName('Sivagangai, Tamil Nadu')
      );
    }
  }, []);

  // Estimate fare when location is known
  useEffect(() => {
    if (!location.lat) return;
    const estimate = async () => {
      setEstimating(true);
      try {
        const res = await dispatchAPI.estimateFare({
          pickupLat: location.lat, pickupLng: location.lng,
          destLat: location.lat + 0.02, destLng: location.lng + 0.02,
        });
        setFareEstimates(res.data.fareEstimates || []);
      } catch (e) {
        setFareEstimates([
          { tier: 'BikePro',       price: 199, etaMinutes: 8,  distanceKm: 2.1 },
          { tier: 'AutoHandyman',  price: 349, etaMinutes: 12, distanceKm: 2.1 },
          { tier: 'MasterTech',    price: 549, etaMinutes: 18, distanceKm: 2.1 },
        ]);
      }
      setEstimating(false);
    };
    estimate();
  }, [location]);

  const selectedEstimate = fareEstimates.find(f => f.tier === form.selectedTier);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.address.trim()) { setError('Please enter your address'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await bookingAPI.create({
        trade,
        serviceTier: form.selectedTier,
        address: form.address,
        notes: form.notes,
        date: form.date,
        time: form.time,
        price: selectedEstimate?.price || 349,
        pickupLat: location.lat,
        pickupLng: location.lng,
      });
      const bookingId = res.data.booking?._id || res.data.booking?.id;
      navigate(`/track/${bookingId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page booking-page">
      <div className="booking-header">
        <h1>Book {trade}</h1>
        <p className="text-muted">Fill in the details to book your service</p>
      </div>

      <div className="booking-layout">
        {/* ── Left: Form ── */}
        <form onSubmit={handleSubmit} className="booking-form card">
          <div className="card-body">
            {/* Tier Selection */}
            <div className="form-group">
              <label className="form-label">Service Tier</label>
              <div className="tier-options">
                {['BikePro', 'AutoHandyman', 'MasterTech'].map(tier => {
                  const info = TIER_INFO[tier];
                  const est = fareEstimates.find(f => f.tier === tier);
                  return (
                    <button
                      key={tier} type="button"
                      className={`tier-option ${form.selectedTier === tier ? 'selected' : ''}`}
                      style={{ '--tier-color': info.color }}
                      onClick={() => setForm({ ...form, selectedTier: tier })}
                    >
                      <div className="tier-header">
                        <span className="tier-name">{info.label}</span>
                        <span className="tier-price">₹{est?.price || '—'}</span>
                      </div>
                      <span className="tier-desc">{info.desc}</span>
                      {est && <span className="tier-eta">ETA ~{est.etaMinutes} min</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Address */}
            <div className="form-group">
              <label className="form-label">Service Address</label>
              <div className="input-wrap">
                <MapPin size={18} className="input-icon" />
                <textarea
                  className="form-input textarea" rows={3}
                  placeholder="Enter your full address for the service..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{ paddingLeft: '44px', resize: 'none' }}
                />
              </div>
              {locationName && (
                <button type="button" className="use-gps-btn"
                  onClick={() => setForm({ ...form, address: locationName })}>
                  <MapPin size={14} /> Use current location: {locationName}
                </button>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Preferred Date</label>
                <div className="input-wrap">
                  <Calendar size={18} className="input-icon" />
                  <input type="date" className="form-input"
                    value={form.date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    style={{ paddingLeft: '44px' }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Time</label>
                <div className="input-wrap">
                  <Clock size={18} className="input-icon" />
                  <input type="time" className="form-input"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    style={{ paddingLeft: '44px' }}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Additional Notes (Optional)</label>
              <div className="input-wrap">
                <FileText size={18} className="input-icon" />
                <textarea
                  className="form-input textarea" rows={2}
                  placeholder="Describe the issue or any special instructions..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  style={{ paddingLeft: '44px', resize: 'none' }}
                />
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <><Loader size={18} className="spin-icon" /> Booking...</>
                       : <>Confirm Booking <ArrowRight size={18} /></>}
            </button>
          </div>
        </form>

        {/* ── Right: Summary ── */}
        <div className="booking-summary">
          <div className="card summary-card">
            <div className="card-header">
              <h3>Booking Summary</h3>
            </div>
            <div className="card-body">
              <div className="summary-row">
                <span>Service</span>
                <strong>{trade}</strong>
              </div>
              <div className="summary-row">
                <span>Tier</span>
                <strong>{TIER_INFO[form.selectedTier]?.label}</strong>
              </div>
              {selectedEstimate && (
                <>
                  <div className="summary-row">
                    <span>Distance</span>
                    <strong>{selectedEstimate.distanceKm} km</strong>
                  </div>
                  <div className="summary-row">
                    <span>ETA</span>
                    <strong>~{selectedEstimate.etaMinutes} min</strong>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-row total">
                    <span>Estimated Price</span>
                    <strong className="text-primary">₹{selectedEstimate.price}</strong>
                  </div>
                  <div className="cashback-note">
                    <DollarSign size={14} color="#10B981" />
                    <span>Earn cashback on payment!</span>
                  </div>
                </>
              )}
              {estimating && <div className="est-loading"><Loader size={16} className="spin-icon" /> Estimating fare...</div>}
            </div>
          </div>

          <div className="trust-badges">
            {['✅ Verified Professionals', '🛡️ Safe & Insured', '⭐ 4.8+ Avg Rating', '💳 Secure Payments'].map(b => (
              <div className="trust-badge" key={b}>{b}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
