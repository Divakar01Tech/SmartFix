import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { useLanguage } from '../context/LanguageContext';
import { mockBookings } from '../data/mockData';
import { apiService, getApiBase } from '../services/api';

import socket from '../services/socket';
import WorkerCard from '../components/WorkerCard';
import LiveTrackerMap from '../components/LiveTrackerMap';
import OnlineWorkersWidget from '../components/OnlineWorkersWidget';
import PaymentModal from '../components/PaymentModal';
import SOSButton from '../components/SOSButton';
import DisputeModal from '../components/DisputeModal';

import { User, Calendar, Clock, MapPin, Wrench, ShieldCheck, CheckCircle2, Phone, PhoneCall, MessageSquare, AlertCircle, RefreshCw, Star, CreditCard, Navigation, Gift, Sparkles, XCircle, RotateCcw, Map, Download, Camera } from 'lucide-react';
import './Dashboard.css';

const CustomerDashboard = () => {
  const { user } = useAuth();
  const { startCall } = useCall();
  const { t } = useLanguage();
  const [bookings, setBookings] = useState([]);
  const [allWorkers, setAllWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'map' | 'completed' | 'cancelled'
  const [toastMessage, setToastMessage] = useState('');
  // SLA countdown — ticks every second to display remaining arrival time
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    const loadWorkers = async () => {
      try {
        const wData = await apiService.getWorkers();
        if (wData && Array.isArray(wData)) setAllWorkers(wData);
      } catch (e) {}
    };
    loadWorkers();
  }, []);

  // Modal States
  const [selectedBookingForMap, setSelectedBookingForMap] = useState(null);
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState(null);
  const [selectedBookingForRating, setSelectedBookingForRating] = useState(null);
  const [selectedBookingForDispute, setSelectedBookingForDispute] = useState(null);

  // Rating Modal Form State
  const [ratingVal, setRatingVal] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Load Bookings from Backend API & Local Storage Sync
  const loadBookings = async () => {
    setLoading(true);
    try {
      const apiBookings = await apiService.getMyBookings();
      setBookings(apiBookings || []);
    } catch (err) {
      console.warn('Backend fetch bookings notice:', err.message);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  // Socket.IO Real-time updates for customer
  useEffect(() => {
    if (!socket) return;

    const handleBookingUpdated = (updatedBooking) => {
      console.log('⚡ Real-time Socket.IO booking update for customer:', updatedBooking);
      setBookings((prev) =>
        prev.map((b) => ((b._id || b.id) === (updatedBooking._id || updatedBooking.id) ? { ...b, ...updatedBooking } : b))
      );

      // Auto-trigger Payment process when worker completes job!
      if (updatedBooking.status === 'Completed' && updatedBooking.paymentStatus !== 'Paid') {
        setSelectedBookingForPayment(updatedBooking);
        setToastMessage('🎉 Handyman marked work COMPLETED! Please complete the payment process below.');
      }
    };

    // SLA breach alert from server — show prominent warning to customer
    const handleSlaBreached = (data) => {
      const bookingShortId = data?.bookingId ? `#${String(data.bookingId).slice(-6)}` : '';
      setToastMessage(
        `⚠️ SLA BREACHED ${bookingShortId}: Your handyman has exceeded the 1-hour arrival guarantee. Our team has been alerted.`
      );
      // Keep the breach message visible for 12 seconds
      setTimeout(() => setToastMessage(''), 12000);
    };

    // Worker has gone En Route — join the booking's tracking room
    const handleTrackingStarted = (data) => {
      if (data?.bookingId) {
        socket.emit('join-booking', data.bookingId);
      }
      setBookings((prev) =>
        prev.map((b) =>
          (b._id || b.id) === data?.bookingId
            ? { ...b, status: 'EnRoute', slaDeadline: data.slaDeadline ?? b.slaDeadline }
            : b
        )
      );
    };

    socket.on('booking-updated', handleBookingUpdated);
    socket.on('sla-breached', handleSlaBreached);
    socket.on('tracking-started', handleTrackingStarted);

    return () => {
      socket.off('booking-updated', handleBookingUpdated);
      socket.off('sla-breached', handleSlaBreached);
      socket.off('tracking-started', handleTrackingStarted);
    };
  }, []);

  // Expanded filter: canonical statuses (EnRoute, Arrived, WorkInProgress) + legacy aliases
  const activeBookings = bookings.filter(
    (b) =>
      (
        b.status === 'Pending' ||
        b.status === 'PendingDispatch' ||
        b.status === 'Accepted' ||
        b.status === 'Confirmed' ||
        b.status === 'EnRoute' ||
        b.status === 'Arrived' ||
        b.status === 'WorkInProgress' ||
        b.status === 'CaptainArrived' ||
        b.status === 'InProgress' ||
        b.status === 'Completed' ||
        b.status === 'WorkCompleted' ||
        b.status === 'PaymentPending'
      ) && b.paymentStatus !== 'Paid'
  );
  const completedBookings = bookings.filter((b) => (b.status === 'Completed' || b.status === 'WorkCompleted') && b.paymentStatus === 'Paid');
  const cancelledBookings = bookings.filter(
    (b) => b.status === 'Cancelled' || b.status === 'Declined' || b.status === 'Rejected'
  );

  const handleCancelBooking = async (bId) => {
    if (!window.confirm('Are you sure you want to cancel this handyman booking?')) return;

    try {
      await apiService.updateBookingStatus(bId, 'Cancelled', { cancelReason: 'Customer requested cancellation' });
    } catch (e) {}

    setBookings((prev) =>
      prev.map((b) => ((b._id || b.id) === bId ? { ...b, status: 'Cancelled' } : b))
    );

    try {
      const stored = JSON.parse(localStorage.getItem('smartfix_bookings') || '[]');
      const updatedLocal = stored.map((b) => ((b._id || b.id) === bId ? { ...b, status: 'Cancelled' } : b));
      localStorage.setItem('smartfix_bookings', JSON.stringify(updatedLocal));
    } catch (e) {}

    setToastMessage(`❌ Booking #${String(bId).slice(-6)} has been cancelled and moved to the Cancelled Orders tab.`);
    setTimeout(() => setToastMessage(''), 5000);
  };

  const handlePaymentSuccess = async (txnDetails) => {
    if (selectedBookingForPayment) {
      const bId = selectedBookingForPayment._id || selectedBookingForPayment.id;
      const completedBookingObj = {
        ...selectedBookingForPayment,
        status: 'Completed',
        paymentStatus: 'Paid',
        paymentMethod: txnDetails.paymentMethod,
        transactionId: txnDetails.transactionId,
        workerBonusAmount: txnDetails.workerBonusAmount,
      };

      try {
        await apiService.payBooking(bId, {
          paymentMethod: txnDetails.paymentMethod,
          transactionId: txnDetails.transactionId,
        });
      } catch (err) {
        console.warn('Backend payment record error:', err.message);
      }

      // Sync local storage so order is closed permanently
      try {
        const stored = JSON.parse(localStorage.getItem('smartfix_bookings') || '[]');
        const updatedLocal = stored.map((b) => ((b._id || b.id) === bId ? completedBookingObj : b));
        localStorage.setItem('smartfix_bookings', JSON.stringify(updatedLocal));
      } catch (e) {}

      // Update state: closes active booking card
      setBookings((prev) =>
        prev.map((b) =>
          (b._id || b.id) === bId ? completedBookingObj : b
        )
      );

      // Close Live Map Tracker & Payment Modals
      setSelectedBookingForMap(null);
      setSelectedBookingForPayment(null);
      
      // Open Rating & Review Modal
      setSelectedBookingForRating(completedBookingObj);

      // Auto-switch tab to Completed Jobs
      setActiveTab('completed');

      setToastMessage('🎉 Payment completed! Order closed & moved to Completed Jobs tab.');
      setTimeout(() => setToastMessage(''), 6000);
    }
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!selectedBookingForRating) return;

    const bId = selectedBookingForRating._id || selectedBookingForRating.id;
    setRatingSubmitting(true);

    try {
      await apiService.rateBooking(bId, ratingVal, reviewText);
    } catch (err) {
      console.warn('Backend rate error:', err.message);
    }

    setBookings((prev) =>
      prev.map((b) => ((b._id || b.id) === bId ? { ...b, rating: ratingVal, review: reviewText } : b))
    );

    setRatingSubmitting(false);
    setSelectedBookingForRating(null);
    setReviewText('');
    setToastMessage('⭐ Thank you for rating your worker & submitting your feedback!');
    setTimeout(() => setToastMessage(''), 5000);
  };

  return (
    <div className="customer-dashboard container py-4 animate__animated animate__fadeIn">
      {/* Header Card */}
      <div className="cd-header-card bg-white border-0 shadow-sm rounded-4 p-4 mb-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div className="cd-avatar bg-primary-subtle text-primary rounded-circle p-3 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
            <User size={28} />
          </div>
          <div>
            <h2 className="fw-extrabold text-dark mb-1 fs-4">Welcome back, {user?.name || 'Customer'}!</h2>
            <p className="text-secondary small mb-0">Track live handyman arrival, manage bookings & review service history</p>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm fw-bold rounded-3 d-flex align-items-center gap-1 py-2 px-3" onClick={loadBookings}>
            <RefreshCw size={15} /> Refresh
          </button>
          <Link to="/browse" className="btn btn-primary fw-bold rounded-3 d-flex align-items-center gap-1 py-2 px-3 shadow-sm">
            <Sparkles size={16} /> Book New Repair
          </Link>
        </div>
      </div>

      {toastMessage && (
        <div className="alert alert-danger shadow-sm rounded-4 border-0 p-3 mb-4 d-flex align-items-center gap-2 fw-bold animate__animated animate__fadeInDown">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white d-flex flex-row align-items-center gap-3">
            <div className="p-3 bg-primary-subtle text-primary rounded-4">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="fw-extrabold text-dark mb-0">{bookings.length}</h3>
              <small className="text-muted fw-semibold">Total Bookings</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white d-flex flex-row align-items-center gap-3">
            <div className="p-3 bg-warning-subtle text-warning-emphasis rounded-4">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="fw-extrabold text-dark mb-0">{activeBookings.length}</h3>
              <small className="text-muted fw-semibold">Active Services</small>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white d-flex flex-row align-items-center gap-3">
            <div className="p-3 bg-success-subtle text-success rounded-4">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="fw-extrabold text-dark mb-0">{completedBookings.length}</h3>
              <small className="text-muted fw-semibold">Completed History</small>
            </div>
          </div>
        </div>
      </div>

      {/* Online Worker Bonus Announcement Card */}
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 text-dark position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderLeft: '6px solid #2563eb' }}>
        <div className="d-flex align-items-center gap-3">
          <div className="p-2 bg-primary text-white rounded-circle shadow-xs flex-shrink-0">
            <Gift size={24} />
          </div>
          <div>
            <h6 className="fw-extrabold text-primary mb-1">Pay Online In-App & Reward Your Worker (+5% Bonus)!</h6>
            <small className="text-secondary">When you pay online via UPI, Card, or NetBanking within SmartFix, we grant your handyman an <strong>EXTRA +5% Reward Bonus</strong>!</small>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="d-flex gap-2 mb-4 p-1 bg-light rounded-3 border flex-wrap">
        <button
          className={`btn btn-sm fw-bold rounded-2 px-3 py-2 d-flex align-items-center gap-2 ${activeTab === 'active' ? 'btn-primary shadow-xs' : 'btn-light text-secondary'}`}
          onClick={() => setActiveTab('active')}
        >
          <Clock size={16} /> Active Bookings <span className="badge bg-white text-primary rounded-pill">{activeBookings.length}</span>
        </button>
        <button
          className={`btn btn-sm fw-bold rounded-2 px-3 py-2 d-flex align-items-center gap-2 ${activeTab === 'completed' ? 'btn-success text-white shadow-xs' : 'btn-light text-secondary'}`}
          onClick={() => setActiveTab('completed')}
        >
          <CheckCircle2 size={16} /> Completed Jobs <span className="badge bg-white text-success rounded-pill">{completedBookings.length}</span>
        </button>
        <button
          className={`btn btn-sm fw-bold rounded-2 px-3 py-2 d-flex align-items-center gap-2 ${activeTab === 'cancelled' ? 'btn-danger text-white shadow-xs' : 'btn-light text-secondary'}`}
          onClick={() => setActiveTab('cancelled')}
        >
          <XCircle size={16} /> Cancelled Orders <span className="badge bg-white text-danger rounded-pill">{cancelledBookings.length}</span>
        </button>
      </div>

      {/* Tab 1: Active Bookings */}
      {activeTab === 'active' && (
        <div className="cd-tab-content">
          {loading ? (
            <p className="text-muted text-center py-5">Loading active bookings...</p>
          ) : activeBookings.length === 0 ? (
            <div className="alert alert-light border shadow-sm rounded-4 p-5 text-center my-3">
              <Clock size={48} className="text-muted mb-3 mx-auto" />
              <h4 className="fw-bold text-dark mb-2">No Active Repair Bookings</h4>
              <p className="text-secondary max-w-md mx-auto mb-3">
                When you book a handyman, live tracking and real-time order status updates will appear here.
              </p>
              <Link to="/browse" className="btn btn-primary fw-bold rounded-3 px-4 py-2">
                Browse Handyman Experts Now
              </Link>
            </div>
          ) : (
            <div className="active-bookings-grid">
              {activeBookings.map((b) => {
                const bId = b._id || b.id;
                const workerObj = b.worker || { name: b.workerName, phone: b.workerPhone, trade: b.trade };
                const workerPhone = workerObj.phone || b.workerPhone || '+919876543210';
                const cleanPhone = workerPhone.replace(/[^0-9]/g, '');
                const waMessage = encodeURIComponent(
                  `Hello ${workerObj.name}, I am tracking my ${b.trade} booking on SmartFix. What is your current arrival ETA?`
                );

                const isJobCompleted = b.status === 'Completed' || b.status === 'WorkCompleted' || b.status === 'PaymentPending' || b.workCompleted === true;

                return (
                  <div key={bId} className="active-booking-card">
                    {/* Header */}
                    <div className="abc-header">
                      <div>
                        <span className="abc-service-tag">{b.trade}</span>
                        <h3>{workerObj.name || 'Assigned Handyman Pro'}</h3>
                      </div>
                      <span className={`status-pill ${isJobCompleted ? 'completed' : b.status?.toLowerCase()}`}>
                        {isJobCompleted ? `✅ ${t('statuses.Completed')}` : (b.status === 'Confirmed' || b.status === 'Accepted' ? `⚡ ${t('statuses.EnRoute')}` : (t(`statuses.${b.status}`) || b.status))}
                      </span>
                    </div>

                    {/* 1-Hour Arrival Guarantee Info or Completed Banner */}
                    <div className={`abc-1hr-banner ${isJobCompleted ? 'bg-success-subtle text-success' : ''}`}>
                      {isJobCompleted ? (
                        <>
                          <CheckCircle2 size={16} color="#059669" />
                          <span>🎉 Handyman has <strong>completed your service!</strong> Please complete payment below.</span>
                        </>
                      ) : (() => {
                        // SLA countdown display
                        const deadline = b.slaDeadline ? new Date(b.slaDeadline).getTime() : null;
                        const remaining = deadline ? Math.max(0, deadline - Date.now()) : null;
                        const mins = remaining !== null ? Math.floor(remaining / 60000) : null;
                        const secs = remaining !== null ? Math.floor((remaining % 60000) / 1000) : null;
                        const isNearExpiry = remaining !== null && remaining < 10 * 60 * 1000;
                        const isExpired = remaining === 0;
                        return (
                          <>
                            <Clock size={15} color={isNearExpiry ? '#dc2626' : '#059669'} />
                            {deadline && !isExpired ? (
                              <span style={{ color: isNearExpiry ? '#dc2626' : undefined }}>
                                SLA: Worker must arrive within{' '}
                                <strong style={{ color: isNearExpiry ? '#dc2626' : '#059669' }}>
                                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                                </strong>
                              </span>
                            ) : isExpired ? (
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ SLA Deadline Passed</span>
                            ) : (
                              <span>Arriving within <strong>1 hour</strong> of acceptance • 5 km radial dispatch</span>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Details Rows */}
                    <div className="abc-details-box">
                      <div className="abc-row">
                        <MapPin size={15} color="#2563eb" />
                        <span>Address: <strong>{b.address || 'Service Location'}</strong></span>
                      </div>
                      <div className="abc-row">
                        <Calendar size={15} color="#2563eb" />
                        <span>Booking Date: <strong>{b.date || 'Today'} ({b.time || 'On-Demand'})</strong></span>
                      </div>
                      <div className="abc-row">
                        <CreditCard size={15} color="#2563eb" />
                        <span>Service Rate: <strong>₹{b.price}/hr</strong> ({b.paymentStatus || 'Unpaid'})</span>
                      </div>
                    </div>

                    {/* Worker Preview */}
                    <div className="abc-worker-preview">
                      {b.status !== 'Pending' && b.status !== 'PendingDispatch' && b.worker ? (
                        <WorkerCard
                          worker={{
                            name: workerObj.name || 'Pro Specialist',
                            trade: b.trade,
                            location: 'Tamil Nadu',
                            ratePerHour: b.price || 350,
                            rating: workerObj.rating || 4.8,
                            ratingCount: workerObj.ratingCount || 42,
                            phone: workerPhone,
                            subServices: b.subServices || [],
                          }}
                          confirmedBooking={true}
                        />
                      ) : (
                        <div className="text-center p-3 text-muted">
                          <div className="spinner-border spinner-border-sm text-primary mb-2" role="status"></div>
                          <p className="mb-0 fw-medium">Searching for nearby available pros...</p>
                        </div>
                      )}
                    </div>

                    {/* Action Bar: WHEN WORK COMPLETED, SHOW ONLY PAYMENT BUTTON! */}
                    {isJobCompleted ? (
                      <div className="abc-actions-bar w-100 p-3 rounded-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #dcfce7 100%)', border: '2px solid #10b981' }}>
                        <button
                          type="button"
                          className="abc-action-btn pay-btn btn-lg fw-extrabold w-100 shadow-md py-3 text-white"
                          style={{ background: '#059669', borderColor: '#059669', fontSize: '1.08rem' }}
                          onClick={() => setSelectedBookingForPayment(b)}
                        >
                          <CreditCard size={22} /> Complete Payment Now (₹{b.price}) — Reward Worker +5% Bonus 🎁
                        </button>
                      </div>
                    ) : (
                      <div className="abc-actions-bar">
                        <button
                          type="button"
                          className="abc-action-btn live-map-btn"
                          onClick={() => setSelectedBookingForMap(b)}
                          title={!(b.status === 'EnRoute' || b.status === 'Accepted') ? 'Live tracking becomes available once worker accepts' : 'Track worker live on map'}
                          style={!(b.status === 'EnRoute' || b.status === 'Accepted') ? { opacity: 0.55, cursor: 'not-allowed' } : {}}
                          disabled={!(b.status === 'EnRoute' || b.status === 'Accepted')}
                        >
                          <Navigation size={16} />
                          {(b.status === 'EnRoute' || b.status === 'Accepted') ? 'Live GPS Map Tracker' : '🗺️ Track (Active jobs only)'}
                        </button>

                        {b.status !== 'Pending' && b.status !== 'PendingDispatch' && b.worker && (
                          <>
                            <button
                              type="button"
                              className="abc-action-btn call-btn btn-primary text-white border-0 fw-bold"
                              onClick={() =>
                                startCall({
                                  receiverId: workerObj._id || workerObj.id || b.workerId,
                                  receiverName: workerObj.name || 'Pro Specialist',
                                  receiverRole: b.trade || 'Handyman Specialist',
                                  receiverAvatar: workerObj.avatar,
                                  receiverPhone: workerPhone,
                                  bookingId: bId,
                                })
                              }
                            >
                              <PhoneCall size={16} /> In-App Call
                            </button>

                            <a
                              href={`https://wa.me/${cleanPhone}?text=${waMessage}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="abc-action-btn whatsapp-btn"
                            >
                              <MessageSquare size={16} /> WhatsApp
                            </a>
                          </>
                        )}

                        {b.paymentStatus !== 'Paid' ? (
                          <button
                            type="button"
                            className="abc-action-btn pay-btn"
                            onClick={() => setSelectedBookingForPayment(b)}
                          >
                            <CreditCard size={16} /> Pay Online (+5% Worker Bonus 🎁)
                          </button>
                        ) : (
                          <span className="badge bg-success p-2 rounded-3 d-inline-flex align-items-center gap-1">
                            <CheckCircle2 size={16} /> Paid Online (+5% Bonus Sent)
                          </span>
                        )}

                        <button
                          type="button"
                          className="abc-action-btn cancel-btn"
                          onClick={() => handleCancelBooking(bId)}
                        >
                          <XCircle size={16} /> Cancel Booking
                        </button>

                        <SOSButton bookingId={bId} />
                      </div>
                    )}

                    {/* Photo Proof of Work Display */}
                    {((b.beforePhotoUrls && b.beforePhotoUrls.length > 0) || (b.afterPhotoUrls && b.afterPhotoUrls.length > 0)) && (
                      <div className="p-3 bg-light rounded-3 mt-3 border">
                        <div className="fw-bold small text-dark mb-2 d-flex align-items-center gap-1">
                          <Camera size={16} className="text-primary" /> Handyman Photo Proof of Work
                        </div>
                        <div className="d-flex gap-3 flex-wrap">
                          {b.beforePhotoUrls && b.beforePhotoUrls.map((url, idx) => (
                            <div key={`before-${idx}`}>
                              <span className="badge bg-secondary mb-1 d-block">Before Work</span>
                              <img src={url} alt="Before work proof" style={{ width: 100, height: 75, objectFit: 'cover', borderRadius: 8, border: '1px solid #cbd5e1' }} />
                            </div>
                          ))}
                          {b.afterPhotoUrls && b.afterPhotoUrls.map((url, idx) => (
                            <div key={`after-${idx}`}>
                              <span className="badge bg-success mb-1 d-block">After Work</span>
                              <img src={url} alt="After work proof" style={{ width: 100, height: 75, objectFit: 'cover', borderRadius: 8, border: '1px solid #10b981' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Completed Jobs */}
      {activeTab === 'completed' && (
        <div className="cd-tab-content">
          {completedBookings.length === 0 ? (
            <div className="alert alert-light border shadow-sm rounded-4 p-5 text-center my-3">
              <CheckCircle2 size={48} className="text-muted mb-3 mx-auto" />
              <h4 className="fw-bold text-dark mb-2">No Completed Jobs Yet</h4>
              <p className="text-secondary max-w-md mx-auto mb-3">
                Services you complete will appear here with customer reviews and payment breakdowns.
              </p>
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Handyman</th>
                    <th>Service Trade</th>
                    <th>Address</th>
                    <th>Price</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>AI Work Verification</th>
                    <th>Action / Review</th>
                  </tr>
                </thead>
                <tbody>
                  {completedBookings.map((b) => {
                    const bId = b._id || b.id;
                    const workerObj = b.worker || { name: b.workerName, phone: b.workerPhone };
                    return (
                      <tr key={bId}>
                        <td><strong>#{String(bId).slice(-6)}</strong></td>
                        <td>
                          <strong>{workerObj.name || b.workerName || 'Handyman'}</strong>
                          <br />
                          <small style={{ color: '#64748b' }}>{workerObj.phone || b.workerPhone || '+919876543210'}</small>
                        </td>
                        <td>{b.trade}</td>
                        <td>{b.address}</td>
                        <td>₹{b.price}</td>
                        <td>
                          <span className={`payment-status-badge ${b.paymentStatus === 'Paid' ? 'paid' : 'unpaid'}`}>
                            {b.paymentStatus || 'Unpaid'}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-success-subtle text-success fw-bold px-2 py-1 rounded-pill">
                            ✓ Completed
                          </span>
                        </td>
                        <td>
                          {b.workProof?.aiVerification ? (
                            <div style={{ fontSize: '0.85rem', maxWidth: '250px' }}>
                              <strong>AI Assessment:</strong> {b.workProof.aiVerification.summary}
                              <br/>
                              <small className="text-muted fst-italic">Note: Advisory only. Not a guarantee.</small>
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.85rem' }}>No AI scan available.</span>
                          )}
                        </td>
                        <td>
                          {b.rating ? (
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <span className="rated-stars-display">
                                {'★'.repeat(b.rating)} ({b.rating}/5)
                              </span>
                              <a
                                href={`${getApiBase()}/bookings/${bId}/invoice`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1"
                              >
                                <Download size={14} /> PDF Invoice
                              </a>
                            </div>
                          ) : (
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                className="rate-pro-btn"
                                onClick={() => setSelectedBookingForRating(b)}
                              >
                                <Star size={14} /> Rate Pro
                              </button>
                              <a
                                href={`${getApiBase()}/bookings/${bId}/invoice`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1"
                              >
                                <Download size={14} /> PDF Invoice
                              </a>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger fw-bold d-inline-flex align-items-center gap-1"
                                onClick={() => setSelectedBookingForDispute(b)}
                              >
                                <AlertCircle size={14} /> Report Issue
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Cancelled Orders */}
      {activeTab === 'cancelled' && (
        <div className="cd-tab-content">
          {cancelledBookings.length === 0 ? (
            <div className="alert alert-light border shadow-sm rounded-4 p-5 text-center my-3">
              <XCircle size={48} className="text-muted mb-3 mx-auto" />
              <h4 className="fw-bold text-dark mb-2">No Cancelled Orders</h4>
              <p className="text-secondary max-w-md mx-auto mb-3">
                You have no cancelled repair tickets. Cancelled requests will be listed here separately for your records.
              </p>
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Handyman</th>
                    <th>Service Trade</th>
                    <th>Address</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Re-Book Option</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledBookings.map((b) => {
                    const bId = b._id || b.id;
                    const workerObj = b.worker || { name: b.workerName, phone: b.workerPhone };
                    return (
                      <tr key={bId}>
                        <td><strong>#{String(bId).slice(-6)}</strong></td>
                        <td>
                          <strong>{workerObj.name || b.workerName || 'Handyman'}</strong>
                          <br />
                          <small style={{ color: '#64748b' }}>{workerObj.phone || b.workerPhone || '+919876543210'}</small>
                        </td>
                        <td>{b.trade}</td>
                        <td>{b.address || 'Tamil Nadu'}</td>
                        <td>₹{b.price}</td>
                        <td>
                          <span className="badge bg-danger-subtle text-danger fw-bold px-2 py-1 rounded-pill">
                            ❌ Cancelled
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/browse?category=${encodeURIComponent(b.trade || 'all')}`}
                            className="btn btn-sm btn-outline-primary fw-bold rounded-3 d-inline-flex align-items-center gap-1"
                          >
                            <RotateCcw size={14} /> Re-Book Service
                          </Link>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger fw-bold ms-2 d-inline-flex align-items-center gap-1 rounded-3"
                            onClick={() => setSelectedBookingForDispute(b)}
                          >
                            <AlertCircle size={14} /> Report Issue
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Live Tracker Modal */}
      {selectedBookingForMap && (
        <div className="payment-modal-overlay" onClick={() => setSelectedBookingForMap(null)}>
          <div className="payment-modal-content live-tracker-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🛰️ Live GPS Map Tracker</h3>
              <button className="close-btn" onClick={() => setSelectedBookingForMap(null)}>✕</button>
            </div>
            <LiveTrackerMap
              booking={selectedBookingForMap}
              worker={selectedBookingForMap.worker || { name: selectedBookingForMap.workerName, phone: selectedBookingForMap.workerPhone, trade: selectedBookingForMap.trade }}
              userLat={selectedBookingForMap.userLat}
              userLng={selectedBookingForMap.userLng}
            />
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {selectedBookingForPayment && (
        <PaymentModal
          booking={selectedBookingForPayment}
          onClose={() => setSelectedBookingForPayment(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Rating & Review Modal */}
      {selectedBookingForRating && (
        <div className="payment-modal-overlay" onClick={() => setSelectedBookingForRating(null)}>
          <div className="payment-modal-content rating-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⭐ Rate Handyman Service</h3>
              <button className="close-btn" onClick={() => setSelectedBookingForRating(null)}>✕</button>
            </div>
            <form onSubmit={handleSubmitRating} className="rating-form">
              <p className="rating-subtitle">
                How was your service experience with <strong>{selectedBookingForRating.workerName || 'your handyman'}</strong>?
              </p>

              <div className="star-picker-row">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    className={`star-pick-btn ${ratingVal >= star ? 'active' : ''}`}
                    onClick={() => setRatingVal(star)}
                  >
                    ★
                  </button>
                ))}
              </div>

              <div className="quick-chips-container my-3">
                <small className="text-muted d-block mb-2 fw-bold">Quick Feedback Tags:</small>
                <div className="d-flex flex-wrap gap-1">
                  {['Punctual & On-time ⏰', 'Polite & Professional 🤝', 'Clean & Neat Work 🧹', 'Great Quality Repair 🌟', 'Fair Pricing 💰'].map((chip) => (
                    <button
                      type="button"
                      key={chip}
                      className="btn btn-sm btn-light border rounded-pill fw-semibold text-secondary"
                      onClick={() => setReviewText((prev) => (prev ? prev + ' • ' + chip : chip))}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="fw-bold text-dark mb-1">Write your feedback about worker and work done:</label>
                <textarea
                  rows={3}
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Tell us about the worker's behavior, work quality, and service performance..."
                  className="form-control rounded-3 p-2"
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedBookingForRating(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={ratingSubmitting}
                >
                  {ratingSubmitting ? 'Submitting Rating...' : 'Submit Rating ⭐'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
};

export default CustomerDashboard;
