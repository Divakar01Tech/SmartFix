import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { bookingAPI } from '../services/api';
import socket from '../services/socket';
import {
  ToggleLeft, ToggleRight, Bell, CheckCircle, XCircle, MapPin,
  Clock, Briefcase, DollarSign, Navigation, Phone, Timer, Loader, RefreshCw
} from 'lucide-react';
import './ProviderDashboard.css';

const STATUS_MAP = {
  Pending: 'pending', Accepted: 'accepted', EnRoute: 'enroute',
  Arrived: 'arrived', WorkInProgress: 'wip', Completed: 'completed', Paid: 'paid',
};

export default function ProviderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const countdownRef = useRef(null);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const res = await bookingAPI.getMyBookings();
      setBookings(res.data.bookings || []);
    } catch (e) {
      console.warn('Bookings load error:', e.message);
    }
    setLoading(false);
  };

  const triggerIncomingModal = (booking) => {
    setIncomingRequest(booking);
    setCountdown(30);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setIncomingRequest(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAccept = async () => {
    if (!incomingRequest) return;
    clearInterval(countdownRef.current);
    const id = incomingRequest._id || incomingRequest.id;
    try {
      await bookingAPI.accept(id);
      setBookings(prev => [{ ...incomingRequest, status: 'Accepted' }, ...prev.filter(b => (b._id || b.id) !== id)]);
      setIncomingRequest(null);
      navigate(`/job/${id}`);
    } catch (e) {
      console.warn('Accept error:', e.message);
    }
  };

  const handleDecline = async () => {
    if (!incomingRequest) return;
    clearInterval(countdownRef.current);
    const id = incomingRequest._id || incomingRequest.id;
    try {
      await bookingAPI.decline(id, { reason: 'Provider unavailable' });
    } catch (e) {}
    setIncomingRequest(null);
  };

  useEffect(() => {
    loadBookings();

    socket.on('booking-created', (newBooking) => {
      console.log('📲 Incoming booking request:', newBooking);
      if (isOnline) triggerIncomingModal(newBooking);
      setBookings(prev => [newBooking, ...prev.filter(b => (b._id || b.id) !== (newBooking._id || newBooking.id))]);
    });

    socket.on('new-booking-request', (newBooking) => {
      if (isOnline) triggerIncomingModal(newBooking);
    });

    socket.on('booking-updated', (updated) => {
      setBookings(prev => prev.map(b =>
        (b._id || b.id) === (updated._id || updated.id) ? { ...b, ...updated } : b
      ));
    });

    return () => {
      socket.off('booking-created');
      socket.off('new-booking-request');
      socket.off('booking-updated');
      clearInterval(countdownRef.current);
    };
  }, [isOnline]);

  const activeBookings = bookings.filter(b => ['Accepted', 'EnRoute', 'Arrived', 'WorkInProgress'].includes(b.status));
  const pendingBookings = bookings.filter(b => ['Pending', 'PendingDispatch'].includes(b.status));
  const completedToday = bookings.filter(b => ['Completed', 'Paid', 'Reviewed'].includes(b.status));
  const todayEarnings = completedToday.reduce((sum, b) => sum + (b.workerTotalPayout || b.price * 0.9 || 0), 0);

  return (
    <div className="page provider-dashboard">
      {/* ── Incoming Request Modal ── */}
      {incomingRequest && (
        <div className="modal-overlay">
          <div className="modal incoming-modal">
            <div className="incoming-header">
              <div className="incoming-pulse"><Bell size={24} /></div>
              <h2>New Booking Request!</h2>
              <div className="countdown-ring">
                <svg viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="var(--border)" strokeWidth="4" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="var(--primary)" strokeWidth="4"
                    strokeDasharray={`${(countdown / 30) * 125.6} 125.6`}
                    strokeLinecap="round"
                    transform="rotate(-90 24 24)"
                  />
                </svg>
                <span className="countdown-num">{countdown}</span>
              </div>
            </div>
            <div className="incoming-details">
              <div className="detail-item"><Briefcase size={16} /><span>{incomingRequest.trade || 'Service'}</span></div>
              <div className="detail-item"><MapPin size={16} /><span>{incomingRequest.address || 'Customer location'}</span></div>
              <div className="detail-item"><DollarSign size={16} /><span>₹{incomingRequest.price} ({incomingRequest.serviceTier})</span></div>
              <div className="detail-item"><Navigation size={16} /><span>~{incomingRequest.distanceKm || 2} km away • ETA {incomingRequest.estimatedMinutes || 12} min</span></div>
            </div>
            <div className="incoming-actions">
              <button className="btn btn-danger btn-full" onClick={handleDecline}>
                <XCircle size={18} /> Decline
              </button>
              <button className="btn btn-primary btn-full" onClick={handleAccept}>
                <CheckCircle size={18} /> Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="dashboard-header">
        <div>
          <h1>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-muted">{user?.trade} · {user?.location || 'Location not set'}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost btn-sm" onClick={loadBookings}><RefreshCw size={15} /> Refresh</button>
          <button className={`online-toggle ${isOnline ? 'online' : 'offline'}`} onClick={() => setIsOnline(!isOnline)}>
            {isOnline ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </button>
        </div>
      </div>

      {/* ── KYC Status Alert Banner ── */}
      {user?.verificationStatus === 'Pending' && (
        <div className="card mb-24" style={{ background: 'rgba(255, 165, 2, 0.1)', borderColor: 'rgba(255, 165, 2, 0.3)', padding: '16px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={24} color="var(--warning)" />
            <div>
              <strong style={{ color: 'var(--warning)', fontSize: '0.95rem', display: 'block' }}>KYC Verification Pending</strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Your Aadhaar and ID proof documents are currently under review by Admin. You will be able to receive & accept booking requests once approved.
              </span>
            </div>
          </div>
        </div>
      )}

      {user?.verificationStatus === 'Rejected' && (
        <div className="card mb-24" style={{ background: 'rgba(255, 71, 87, 0.1)', borderColor: 'rgba(255, 71, 87, 0.3)', padding: '16px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <XCircle size={24} color="var(--danger)" />
            <div>
              <strong style={{ color: 'var(--danger)', fontSize: '0.95rem', display: 'block' }}>KYC Verification Rejected</strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Reason: {user.rejectionReason || 'Document verification failed.'} Please update your documents in Profile.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid-4 mb-24">
        {[
          { label: 'Active Jobs', value: activeBookings.length, icon: Navigation, color: 'primary' },
          { label: 'Pending', value: pendingBookings.length, icon: Clock, color: 'warning' },
          { label: "Today's Jobs", value: completedToday.length, icon: CheckCircle, color: 'success' },
          { label: "Today's Earnings", value: `₹${Math.round(todayEarnings)}`, icon: DollarSign, color: 'accent' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`kpi-card kpi-${color}`}>
            <div className="kpi-icon"><Icon size={22} /></div>
            <div className="kpi-value">{value}</div>
            <div className="kpi-label">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Active Jobs ── */}
      {activeBookings.length > 0 && (
        <div className="mb-24">
          <h2 className="section-title">Active Jobs</h2>
          <div className="jobs-list">
            {activeBookings.map(b => {
              const id = b._id || b.id;
              return (
                <div key={id} className="job-card card card-glow">
                  <div className="card-body">
                    <div className="job-header">
                      <div>
                        <div className="job-trade">{b.trade}</div>
                        <div className="job-address"><MapPin size={13} /> {b.address}</div>
                      </div>
                      <span className={`badge badge-${STATUS_MAP[b.status] || 'accepted'}`}>{b.status}</span>
                    </div>
                    <div className="job-footer">
                      <span className="job-price">₹{b.price}</span>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/job/${id}`)}>
                        <Navigation size={14} /> Manage Job
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pending Bookings ── */}
      {pendingBookings.length > 0 && (
        <div className="mb-24">
          <h2 className="section-title">Waiting for Your Response</h2>
          <div className="jobs-list">
            {pendingBookings.map(b => {
              const id = b._id || b.id;
              return (
                <div key={id} className="job-card card">
                  <div className="card-body">
                    <div className="job-header">
                      <div>
                        <div className="job-trade">{b.trade}</div>
                        <div className="job-address"><MapPin size={13} /> {b.address}</div>
                      </div>
                      <span className="badge badge-pending">Pending</span>
                    </div>
                    <div className="job-footer">
                      <span className="job-price">₹{b.price}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDecline()}>Decline</button>
                        <button className="btn btn-primary btn-sm" onClick={() => triggerIncomingModal(b)}>Review</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center" style={{ padding: '48px' }}>
          <Loader size={32} className="spin-icon" color="var(--primary)" />
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <div className="empty-state">
          <Bell size={48} color="var(--text-muted)" />
          <h3>No bookings yet</h3>
          <p className="text-muted">Stay online to receive booking requests</p>
        </div>
      )}
    </div>
  );
}
