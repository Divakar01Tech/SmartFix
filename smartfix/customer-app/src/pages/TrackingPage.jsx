import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingAPI } from '../services/api';
import socket from '../services/socket';
import {
  MapPin, Navigation, Clock, CheckCircle, Phone, AlertTriangle,
  Loader, Star, CreditCard, User
} from 'lucide-react';
import './TrackingPage.css';

const STATUS_STEPS = [
  { key: 'Pending',       label: 'Finding Provider',  num: 1 },
  { key: 'Accepted',      label: 'Accepted',          num: 2 },
  { key: 'EnRoute',       label: 'En Route',          num: 3 },
  { key: 'Arrived',       label: 'Arrived',           num: 4 },
  { key: 'WorkInProgress',label: 'In Progress',       num: 5 },
  { key: 'Completed',     label: 'Completed',         num: 6 },
];

const STATUS_MESSAGES = {
  Pending:         'Looking for nearby professionals...',
  Accepted:        'Provider accepted your booking! They will arrive within 60 minutes.',
  EnRoute:         'Your provider is on the way to you!',
  Arrived:         'Provider has arrived at your location.',
  WorkInProgress:  'Work is in progress...',
  Completed:       'Work completed! Please make payment.',
  Paid:            'Payment received. Thank you!',
  Reviewed:        'Booking complete!',
  Cancelled:       'Booking was cancelled.',
  SLABreached:     '⚠️ Provider is running late! We apologize for the delay.',
};

function SLATimer({ slaDeadline, status }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!slaDeadline || ['Arrived', 'WorkInProgress', 'Completed', 'Paid'].includes(status)) return;
    const update = () => {
      const diff = new Date(slaDeadline) - new Date();
      setTimeLeft(Math.max(0, diff));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [slaDeadline, status]);

  if (!timeLeft || !slaDeadline) return null;
  const mins = Math.floor(timeLeft / 60000);
  const secs = Math.floor((timeLeft % 60000) / 1000);
  const urgent = mins < 10;

  return (
    <div className={`sla-timer ${urgent ? 'urgent' : ''}`}>
      <Clock size={16} />
      <span>Provider must arrive in: <strong>{mins}:{secs.toString().padStart(2, '0')}</strong></span>
      {urgent && <AlertTriangle size={16} />}
    </div>
  );
}

export default function TrackingPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workerLoc, setWorkerLoc] = useState(null);

  const fetchBooking = async () => {
    try {
      const res = await bookingAPI.getById(bookingId);
      setBooking(res.data.booking);
    } catch (e) {
      console.warn('Booking fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();

    // Join booking room for real-time updates
    socket.emit('join-booking', bookingId);

    socket.on('booking-status-changed', (data) => {
      if (data.bookingId === bookingId || data.bookingId === bookingId.toString()) {
        setBooking(prev => prev ? { ...prev, status: data.status, slaDeadline: data.slaDeadline || prev.slaDeadline } : prev);
      }
    });

    socket.on('booking-accepted', (data) => {
      if (data.bookingId === bookingId) {
        setBooking(prev => prev ? { ...prev, status: 'Accepted', slaDeadline: data.slaDeadline, worker: data.provider } : prev);
      }
    });

    socket.on('worker-location-updated', (data) => {
      if (data.bookingId === bookingId) {
        setWorkerLoc({ lat: data.latitude, lng: data.longitude });
      }
    });

    socket.on('booking-updated', (updated) => {
      if ((updated._id || updated.id) === bookingId) {
        setBooking(prev => ({ ...prev, ...updated }));
      }
    });

    socket.on('sla-breached', (data) => {
      if (data.bookingId === bookingId) {
        setBooking(prev => prev ? { ...prev, slaBreached: true } : prev);
      }
    });

    // Poll every 15s as fallback
    const poller = setInterval(fetchBooking, 15000);

    return () => {
      socket.emit('leave-booking', bookingId);
      socket.off('booking-status-changed');
      socket.off('booking-accepted');
      socket.off('worker-location-updated');
      socket.off('booking-updated');
      socket.off('sla-breached');
      clearInterval(poller);
    };
  }, [bookingId]);

  if (loading) return (
    <div className="page flex items-center justify-center" style={{ minHeight: '80vh' }}>
      <div className="text-center">
        <Loader size={40} className="spin-icon" color="#FF6B35" />
        <p className="mt-16 text-muted">Loading tracking info...</p>
      </div>
    </div>
  );

  if (!booking) return (
    <div className="page page-sm text-center">
      <h2>Booking not found</h2>
      <button className="btn btn-primary mt-24" onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
    </div>
  );

  const currentStep = STATUS_STEPS.findIndex(s => s.key === booking.status) + 1;
  const isCompleted = booking.status === 'Completed';
  const isPaid = booking.status === 'Paid' || booking.paymentStatus === 'Paid';
  const provider = booking.worker;

  return (
    <div className="page tracking-page">
      <div className="tracking-layout">
        {/* ── Left: Status Panel ── */}
        <div className="status-panel">
          {/* Status */}
          <div className="card status-card">
            <div className="card-body">
              <div className={`status-icon-wrap ${booking.status?.toLowerCase().replace(/\s/g, '-')}`}>
                {booking.status === 'Pending' ? <Loader size={28} className="spin-icon" /> :
                 booking.status === 'Completed' ? <CheckCircle size={28} /> :
                 <Navigation size={28} />}
              </div>
              <h2 className="status-title">{STATUS_MESSAGES[booking.status] || booking.status}</h2>
              {booking.slaBreached && (
                <div className="sla-breach-alert">
                  <AlertTriangle size={16} />
                  SLA Breached — Provider arrived late. We apologize!
                </div>
              )}
              <SLATimer slaDeadline={booking.slaDeadline} status={booking.status} />
            </div>
          </div>

          {/* Stepper */}
          <div className="card">
            <div className="card-body">
              <div className="stepper-vertical">
                {STATUS_STEPS.map((step, i) => {
                  const isDone = i + 1 < currentStep;
                  const isActive = step.key === booking.status;
                  return (
                    <div key={step.key} className={`vstep ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                      <div className="vstep-dot">
                        {isDone ? <CheckCircle size={14} /> : <span>{step.num}</span>}
                      </div>
                      <div className="vstep-line" />
                      <span className="vstep-label">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Provider Info */}
          {provider && (
            <div className="card provider-card">
              <div className="card-body">
                <h3 className="mb-8">Your Provider</h3>
                <div className="provider-info">
                  <div className="provider-avatar">{provider.name?.charAt(0).toUpperCase()}</div>
                  <div className="provider-details">
                    <span className="provider-name">{provider.name}</span>
                    <span className="provider-trade">{provider.trade}</span>
                    <div className="provider-rating">
                      <Star size={14} fill="#F59E0B" color="#F59E0B" />
                      <span>{provider.rating || 4.8}</span>
                    </div>
                  </div>
                  <a href={`tel:${provider.phone}`} className="btn btn-outline btn-sm">
                    <Phone size={15} /> Call
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Booking Details */}
          <div className="card">
            <div className="card-body">
              <h3 className="mb-16">Booking Details</h3>
              <div className="detail-rows">
                <div className="detail-row"><span>Service</span><strong>{booking.trade}</strong></div>
                <div className="detail-row"><span>Address</span><strong>{booking.address}</strong></div>
                <div className="detail-row"><span>Price</span><strong className="text-primary">₹{booking.price}</strong></div>
                <div className="detail-row"><span>Status</span><span className={`badge badge-${booking.status?.toLowerCase()}`}>{booking.status}</span></div>
              </div>
            </div>
          </div>

          {/* Pay Button */}
          {isCompleted && !isPaid && (
            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={() => navigate(`/pay/${bookingId}`)}
            >
              <CreditCard size={20} /> Pay ₹{booking.price} Now
            </button>
          )}

          {isPaid && !booking.rating && (
            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={() => navigate(`/review/${bookingId}`)}
            >
              <Star size={20} /> Rate Your Experience
            </button>
          )}
        </div>

        {/* ── Right: Map Panel ── */}
        <div className="map-panel">
          <div className="card map-card">
            <div className="card-header">
              <h3>Live Location</h3>
              <span className="live-dot"><span />LIVE</span>
            </div>
            <div className="map-placeholder">
              <div className="map-mock">
                {/* Map grid lines */}
                <div className="map-grid" />
                <div className="map-roads" />

                {/* Customer pin */}
                <div className="map-pin customer-pin" style={{ left: '50%', top: '50%' }}>
                  <MapPin size={28} color="#FF6B35" fill="#FF6B35" />
                  <span>Your location</span>
                </div>

                {/* Worker pin (live) */}
                {workerLoc && (
                  <div className="map-pin worker-pin" style={{ left: '35%', top: '35%' }}>
                    <Navigation size={24} color="#3B82F6" fill="#3B82F6" />
                    <span>Provider</span>
                  </div>
                )}

                {/* Overlay message */}
                {booking.status === 'Pending' && (
                  <div className="map-overlay">
                    <Loader size={24} className="spin-icon" color="#FF6B35" />
                    <p>Waiting for provider to accept...</p>
                  </div>
                )}

                {booking.status === 'EnRoute' && (
                  <div className="map-info-strip">
                    <Navigation size={16} color="#3B82F6" />
                    <span>Provider is en route • ~{booking.estimatedMinutes || 12} min away</span>
                  </div>
                )}
              </div>
            </div>
            <div className="map-footer">
              <div className="map-stat">
                <MapPin size={16} color="#FF6B35" />
                <span>{booking.distanceKm || '2.5'} km away</span>
              </div>
              <div className="map-stat">
                <Clock size={16} color="#3B82F6" />
                <span>~{booking.estimatedMinutes || 15} min ETA</span>
              </div>
              {booking.worker?.phone && (
                <div className="map-stat">
                  <Phone size={16} color="#10B981" />
                  <span>{booking.worker.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
