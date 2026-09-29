import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { bookingAPI } from '../services/api';
import socket from '../services/socket';
import {
  Navigation, MapPin, Phone, CheckCircle, Clock, Loader,
  Radio, Play, Square, AlertTriangle, ArrowRight
} from 'lucide-react';
import './ActiveJobPage.css';

const STATUS_FLOW = [
  { from: 'Accepted',        to: 'EnRoute',         label: 'Start Journey → En Route', icon: Navigation, color: '#6366F1' },
  { from: 'EnRoute',         to: 'Arrived',         label: "I've Arrived",              icon: MapPin,     color: '#F59E0B' },
  { from: 'Arrived',         to: 'WorkInProgress',  label: 'Start Work',               icon: Play,       color: '#00D4AA' },
  { from: 'WorkInProgress',  to: 'Completed',       label: 'Mark Work Completed',      icon: CheckCircle,color: '#2ED573' },
];

export default function ActiveJobPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);
  const gpsWatchRef = useRef(null);
  const [currentLat, setCurrentLat] = useState(null);
  const [currentLng, setCurrentLng] = useState(null);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const res = await bookingAPI.getById(bookingId);
        setBooking(res.data.booking);
      } catch (e) {}
      setLoading(false);
    };
    fetchBooking();
    socket.emit('join-booking', bookingId);

    socket.on('booking-status-changed', (data) => {
      if (data.bookingId === bookingId) {
        setBooking(prev => prev ? { ...prev, status: data.status } : prev);
      }
    });

    return () => {
      socket.emit('leave-booking', bookingId);
      socket.off('booking-status-changed');
    };
  }, [bookingId]);

  // GPS Broadcasting
  const toggleGps = () => {
    if (gpsActive) {
      if (gpsWatchRef.current) navigator.geolocation.clearWatch(gpsWatchRef.current);
      setGpsActive(false);
    } else {
      if (!navigator.geolocation) { alert('Geolocation not available'); return; }
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCurrentLat(lat);
          setCurrentLng(lng);
          socket.emit('worker-location', {
            workerId: user?.id,
            bookingId,
            latitude: lat,
            longitude: lng,
          });
        },
        (err) => console.warn('GPS error:', err.message),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      setGpsActive(true);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true);
    try {
      await bookingAPI.updateStatus(bookingId, { status: newStatus });
      setBooking(prev => prev ? { ...prev, status: newStatus } : prev);
    } catch (e) {
      alert('Status update failed. Please try again.');
    }
    setUpdating(false);
  };

  const currentTransition = STATUS_FLOW.find(sf => sf.from === booking?.status);
  const customer = booking?.customer;

  if (loading) return (
    <div className="page flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <Loader size={36} className="spin-icon" color="var(--primary)" />
    </div>
  );

  if (!booking) return (
    <div className="page text-center">
      <h2>Booking not found</h2>
      <button className="btn btn-primary mt-16" onClick={() => navigate('/')}>Back to Dashboard</button>
    </div>
  );

  return (
    <div className="page active-job-page">
      <div className="job-layout">
        {/* ── Left: Controls ── */}
        <div className="job-controls">
          {/* Status Card */}
          <div className={`card card-glow status-card`}>
            <div className="card-body text-center">
              <div className="status-badge-big">{booking.status}</div>
              <p className="text-muted mt-8" style={{ fontSize: '0.875rem' }}>
                {booking.status === 'Accepted' && 'Head to the customer location'}
                {booking.status === 'EnRoute' && 'You are on the way!'}
                {booking.status === 'Arrived' && 'You have arrived. Start the work.'}
                {booking.status === 'WorkInProgress' && 'Work in progress...'}
                {booking.status === 'Completed' && 'Job done! Wait for customer payment.'}
                {booking.status === 'Paid' && 'Payment received. Great work! ✅'}
              </p>
            </div>
          </div>

          {/* Next Action Button */}
          {currentTransition && booking.status !== 'Completed' && booking.status !== 'Paid' && (
            <button
              className="btn btn-primary btn-full btn-lg next-action-btn"
              style={{ '--btn-color': currentTransition.color }}
              onClick={() => handleStatusUpdate(currentTransition.to)}
              disabled={updating}
            >
              {updating ? <Loader size={18} className="spin-icon" /> : <currentTransition.icon size={20} />}
              {updating ? 'Updating...' : currentTransition.label}
              {!updating && <ArrowRight size={18} />}
            </button>
          )}

          {/* GPS Toggle */}
          <div className="card">
            <div className="card-body">
              <div className="gps-header">
                <div>
                  <h3>Live GPS Broadcasting</h3>
                  <p className="text-muted text-sm">Share your live location with customer</p>
                </div>
                <button className={`btn ${gpsActive ? 'btn-danger' : 'btn-primary'} btn-sm`} onClick={toggleGps}>
                  {gpsActive ? <><Square size={14} /> Stop GPS</> : <><Radio size={14} /> Start GPS</>}
                </button>
              </div>
              {gpsActive && currentLat && (
                <div className="gps-coords">
                  <div className="gps-live-dot" />
                  <span>Live: {currentLat.toFixed(5)}, {currentLng?.toFixed(5)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Customer Info */}
          {customer && (
            <div className="card">
              <div className="card-body">
                <h3 className="mb-16">Customer Details</h3>
                <div className="customer-info">
                  <div className="customer-avatar">{customer.name?.charAt(0).toUpperCase()}</div>
                  <div className="customer-details">
                    <div className="customer-name">{customer.name}</div>
                    <div className="customer-phone"><Phone size={13} /> {customer.phone}</div>
                  </div>
                  <a href={`tel:${customer.phone}`} className="btn btn-outline btn-sm">
                    <Phone size={14} /> Call
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Booking Details */}
          <div className="card">
            <div className="card-body">
              <h3 className="mb-16">Job Details</h3>
              <div className="detail-list">
                <div className="detail-item-row"><span>Service</span><strong>{booking.trade}</strong></div>
                <div className="detail-item-row"><span>Address</span><strong>{booking.address}</strong></div>
                <div className="detail-item-row"><span>Date</span><strong>{booking.date} {booking.time}</strong></div>
                <div className="detail-item-row"><span>Price</span><strong className="text-primary">₹{booking.price}</strong></div>
                <div className="detail-item-row"><span>Your Payout</span><strong style={{ color: 'var(--success)' }}>₹{Math.round(booking.price * 0.9)}</strong></div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Map ── */}
        <div className="job-map-panel">
          <div className="card map-card">
            <div className="card-header">
              <h3>Navigation</h3>
              {gpsActive && <span className="live-indicator"><span className="live-dot-red" />LIVE</span>}
            </div>
            <div className="map-view">
              {/* Simulated map */}
              <div className="map-mock-dark">
                <div className="customer-location-pin">
                  <MapPin size={32} color="#FF6B35" fill="#FF6B35" />
                  <div className="pin-label">Customer<br />{booking.address}</div>
                </div>
                {gpsActive && (
                  <div className="provider-pin">
                    <Navigation size={28} color="var(--primary)" fill="var(--primary)" />
                    <div className="pin-label provider-pin-label">You (Live)</div>
                  </div>
                )}
                {!gpsActive && (
                  <div className="map-instructions">
                    <Radio size={20} color="var(--primary)" />
                    <p>Enable GPS to start live tracking</p>
                  </div>
                )}
              </div>
            </div>
            <div className="map-footer-dark">
              <div className="map-stat"><MapPin size={14} color="#FF6B35" /><span>{booking.distanceKm || 2} km to customer</span></div>
              {booking.slaDeadline && (
                <div className={`map-stat ${booking.slaBreached ? 'sla-breached' : ''}`}>
                  <Clock size={14} color={booking.slaBreached ? 'var(--danger)' : 'var(--warning)'} />
                  <span>SLA: {new Date(booking.slaDeadline).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  {booking.slaBreached && <AlertTriangle size={13} color="var(--danger)" />}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
