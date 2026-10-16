import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import socket from '../services/socket';
import LiveTrackerMap from '../components/LiveTrackerMap';
import ReviewForm from '../components/ReviewForm';
import PayButton from '../components/PayButton';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  ArrowLeft,
  Navigation,
  CreditCard,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';

const CANONICAL_STEPS = [
  { key: 'pending', label: 'Pending Dispatch' },
  { key: 'accepted', label: 'Accepted by Pro' },
  { key: 'en_route', label: 'En Route' },
  { key: 'arrived', label: 'Arrived at Site' },
  { key: 'completed', label: 'Work Completed' },
  { key: 'paid', label: 'Payment Done' },
  { key: 'reviewed', label: 'Reviewed' },
];

export default function BookingStatus() {
  const { t } = useTranslation();
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // SLA countdown timer state
  const [slaCountdownSecs, setSlaCountdownSecs] = useState(null);

  const fetchBooking = async () => {
    try {
      const data = await apiService.getBooking(bookingId);
      setBooking(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    }
  }, [bookingId]);

  // Socket.IO Room Joining & Live Updates
  useEffect(() => {
    if (!socket || !bookingId) return;

    // Join dual room conventions: booking:<id> and booking-<id>
    socket.emit('join-booking-room', bookingId);
    socket.emit('join', { room: `booking:${bookingId}` });

    const handleUpdate = (data) => {
      if ((data._id || data.id || data.bookingId) === bookingId) {
        setBooking((prev) => ({ ...prev, ...data }));
      }
    };

    const handleSlaAlert = (alertData) => {
      if (alertData?.bookingId === bookingId) {
        setBooking((prev) => ({ ...prev, status: 'sla_breached' }));
      }
    };

    socket.on('booking:status-changed', handleUpdate);
    socket.on('booking:updated', handleUpdate);
    socket.on('booking:sla-breached', handleSlaAlert);

    return () => {
      socket.emit('leave-booking-room', bookingId);
      socket.off('booking:status-changed', handleUpdate);
      socket.off('booking:updated', handleUpdate);
      socket.off('booking:sla-breached', handleSlaAlert);
    };
  }, [bookingId]);

  // Compute 1-Hour SLA Countdown
  useEffect(() => {
    if (!booking) return;
    const isUnderSla = ['accepted', 'en_route'].includes(booking.status);
    if (!isUnderSla || !booking.acceptedAt) {
      setSlaCountdownSecs(null);
      return;
    }

    const acceptedTime = new Date(booking.acceptedAt).getTime();
    const oneHourMs = 60 * 60 * 1000;
    const deadline = acceptedTime + oneHourMs;

    const interval = setInterval(() => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        setSlaCountdownSecs(0);
        clearInterval(interval);
      } else {
        setSlaCountdownSecs(Math.floor(remainingMs / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [booking]);

  const handleCancelBooking = async () => {
    setCancelling(true);
    try {
      const updated = await apiService.cancelBooking(bookingId, cancelReason || 'Customer requested cancellation');
      setBooking(updated);
      setShowCancelModal(false);
    } catch (err) {
      alert(err.message || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const handleReviewFinished = (updatedBooking) => {
    setBooking(updatedBooking);
  };

  if (loading) {
    return (
      <div className="container py-5 text-center min-vh-50 d-flex flex-column justify-content-center align-items-center">
        <div className="spinner-border text-primary mb-3" role="status" />
        <p className="text-muted">{t('loading_booking_status', 'Loading live booking status & dispatch timeline...')}</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="container py-5 text-center" style={{ maxWidth: '600px' }}>
        <div className="alert alert-danger py-4 shadow-sm rounded-4">
          <AlertTriangle size={36} className="text-danger mb-2" />
          <h2 className="h5 fw-bold mb-2">{t('booking_fetch_error', 'Access Denied or Booking Not Found')}</h2>
          <p className="small mb-3">{errorMsg}</p>
          <Link to="/customer/dashboard" className="btn btn-outline-danger btn-sm">
            {t('return_to_dashboard', 'Return to My Dashboard')}
          </Link>
        </div>
      </div>
    );
  }

  const currentStatus = booking?.status || 'pending';
  const isCancelled = currentStatus === 'cancelled';
  const isSlaBreached = currentStatus === 'sla_breached';

  // State index in canonical chain
  const currentStepIndex = CANONICAL_STEPS.findIndex((s) => s.key === currentStatus);

  // Privacy Rule: Worker details revealed ONLY from 'accepted' onward (prevents fake reviews)
  const acceptedStatuses = [
    'accepted',
    'en_route',
    'arrived',
    'in_progress',
    'completed',
    'paid',
    'reviewed',
    'Accepted',
    'Confirmed',
    'EnRoute',
    'Arrived',
    'WorkInProgress',
    'Completed',
    'Paid',
    'Reviewed',
  ];
  const isWorkerRevealed =
    acceptedStatuses.includes(currentStatus) &&
    booking?.worker &&
    booking?.worker?.isAssigned !== false &&
    (booking?.worker?.name || booking?.worker?.fullName);
  const workerObj = booking?.worker;

  // Free cancellation rule: before 'en_route'
  const isFreeCancellation = ['pending', 'accepted'].includes(currentStatus);
  const isCancelAllowed = !['arrived', 'completed', 'paid', 'reviewed', 'cancelled'].includes(currentStatus);

  const formatCountdown = (totalSeconds) => {
    if (totalSeconds === null || totalSeconds === undefined) return '';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  return (
    <div className="container py-4" style={{ maxWidth: '920px', minHeight: '80vh' }}>
      {/* Top Bar */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <Link to="/my-bookings" className="text-decoration-none text-muted small d-inline-flex align-items-center gap-1 mb-1">
            <ArrowLeft size={16} />
            <span>{t('my_bookings_link', 'My Bookings')}</span>
          </Link>
          <h1 className="h3 fw-bold text-dark mb-0">
            {t('booking_status_title', 'Booking Journey')} #{bookingId.slice(-6).toUpperCase()}
          </h1>
          <p className="text-muted small mb-0">
            {t('service_booked', 'Service')}: <strong className="text-dark">{booking?.category}</strong> ({booking?.subService})
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm rounded-pill d-flex align-items-center gap-1"
          onClick={fetchBooking}
        >
          <RefreshCw size={14} />
          <span>{t('refresh_status', 'Refresh')}</span>
        </button>
      </div>

      {/* SLA Breach Alert Banner */}
      {isSlaBreached && (
        <div className="alert alert-warning border-warning shadow-sm rounded-4 p-3 mb-4 d-flex align-items-start gap-3">
          <AlertTriangle size={24} className="text-warning flex-shrink-0 mt-1" />
          <div>
            <h5 className="alert-heading fw-bold mb-1">
              {t('sla_breach_heading', '⚠️ 1-Hour SLA Arrival Window Exceeded')}
            </h5>
            <p className="small mb-1">
              {t(
                'sla_breach_body',
                'Your assigned handyman has exceeded our 1-hour arrival guarantee. SmartFix Operations Admin has been flagged for prioritized dispatch and compensation review.'
              )}
            </p>
            <span className="badge bg-warning text-dark font-monospace">STATUS: SLA_BREACHED</span>
          </div>
        </div>
      )}

      {/* SLA Countdown Timer Banner (active during accepted or en_route) */}
      {slaCountdownSecs !== null && !isSlaBreached && (
        <div className="alert alert-info border-info shadow-sm rounded-4 p-3 mb-4 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <Clock size={20} className="text-primary" />
            <div>
              <strong className="d-block text-dark small">{t('sla_guarantee_title', '1-Hour Arrival Guarantee Active')}</strong>
              <span className="text-muted small">{t('sla_guarantee_sub', 'Guaranteed pro arrival at your doorstep within 60 minutes.')}</span>
            </div>
          </div>
          <div className="badge bg-primary fs-6 px-3 py-2 rounded-pill font-monospace">
            ⏱️ {formatCountdown(slaCountdownSecs)}
          </div>
        </div>
      )}

      {/* 8-Step Canonical Timeline */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border">
        <h2 className="h6 fw-bold text-dark mb-4">{t('status_timeline_header', 'Service Progress Timeline')}</h2>

        <div className="position-relative">
          <div className="row g-2 text-center">
            {CANONICAL_STEPS.map((step, idx) => {
              const isPast = currentStepIndex > idx || currentStatus === 'reviewed';
              const isCurrent = currentStepIndex === idx;
              const isFuture = currentStepIndex < idx;

              return (
                <div key={step.key} className="col">
                  <div className="d-flex flex-column align-items-center">
                    <div
                      className={`rounded-circle d-flex align-items-center justify-content-center mb-2 shadow-sm ${
                        isCurrent
                          ? 'bg-primary text-white ring-4 ring-primary-subtle'
                          : isPast
                          ? 'bg-success text-white'
                          : 'bg-light text-muted border'
                      }`}
                      style={{ width: '38px', height: '38px', fontSize: '0.85rem' }}
                    >
                      {isPast ? <CheckCircle2 size={20} /> : idx + 1}
                    </div>
                    <span
                      className={`small ${isCurrent ? 'fw-bold text-primary' : isPast ? 'text-dark' : 'text-muted'}`}
                      style={{ fontSize: '0.72rem', lineHeight: '1.2' }}
                    >
                      {t(`status_${step.key}`, step.label)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isCancelled && (
          <div className="alert alert-danger mt-4 mb-0 py-2 px-3 small text-center rounded-3">
            <XCircle size={18} className="me-1 inline-block" />
            <strong>{t('booking_cancelled_notice', 'This booking has been cancelled.')}</strong>
          </div>
        )}
      </div>

      <div className="row g-4">
        {/* Left Column: Worker Identity (Privacy Scoped) & Service Details */}
        <div className="col-12 col-md-6">
          {/* Worker Details Card */}
          <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border">
            <h2 className="h6 fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <ShieldCheck size={18} className="text-primary" />
              <span>{t('assigned_handyman_header', 'Assigned Service Professional')}</span>
            </h2>

            {!isWorkerRevealed ? (
              /* Privacy Hidden State - Fake Reviews & Bias Protection */
              <div className="p-3 bg-light rounded-3 text-center border">
                <Clock size={28} className="text-secondary opacity-50 mb-2" />
                <h3 className="h6 fw-bold text-dark mb-1">
                  {t('worker_assigned_pending', 'Matching Nearest Available Specialist...')}
                </h3>
                <p className="text-muted small mb-2" style={{ fontSize: '0.8rem' }}>
                  {t(
                    'privacy_shield_active',
                    '🔒 Specialist identity, ratings, photo, and masked call are shielded until the specialist accepts your booking request.'
                  )}
                </p>
                <span className="badge bg-warning-subtle text-warning-emphasis small px-2 py-1">
                  🛡️ Protected against fake reviews & pre-booking bias
                </span>
              </div>
            ) : (
              /* Privacy Revealed State (accepted and onward) */
              <div className="d-flex align-items-center gap-3 p-3 bg-light rounded-3 border">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center bg-primary text-white fw-bold fs-4"
                  style={{ width: '56px', height: '56px' }}
                >
                  {(workerObj?.name || 'W').charAt(0).toUpperCase()}
                </div>
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-bold text-dark">{workerObj?.name}</span>
                    <span className="badge bg-success-subtle text-success small">
                      <ShieldCheck size={12} className="me-1 inline-block" />
                      {t('verified_partner_badge', 'Verified Pro')}
                    </span>
                  </div>
                  <div className="text-muted small mb-1">{workerObj?.trade || booking?.category}</div>
                  <div className="d-flex align-items-center gap-1 text-warning small">
                    <Star size={14} className="fill-warning" style={{ fill: '#eab308' }} />
                    <span className="fw-bold text-dark">{workerObj?.rating ? Number(workerObj.rating).toFixed(1) : '4.9'}</span>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                      ({workerObj?.completedJobs || 12} jobs)
                    </span>
                  </div>
                </div>

                {/* Masked Call Option */}
                <div>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm rounded-circle p-2"
                    title={t('masked_call_tooltip', 'Masked In-App Audio Call (Phone shielded)')}
                    onClick={() => alert(`Calling ${workerObj?.name} via SmartFix Secure In-App Bridge (Numbers Masked)...`)}
                  >
                    <Phone size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Booking Summary Card */}
          <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border">
            <h2 className="h6 fw-bold text-dark mb-3">{t('service_summary_header', 'Service & Location')}</h2>
            <div className="mb-2">
              <span className="text-muted small d-block">{t('address_label', 'Doorstep Location')}</span>
              <span className="text-dark small fw-semibold">
                📍 {booking?.address || 'Tamil Nadu'}
              </span>
            </div>
            <div className="mb-2">
              <span className="text-muted small d-block">{t('service_date_label', 'Scheduled Slot')}</span>
              <span className="text-dark small">
                {booking?.scheduledDate} ({booking?.scheduledTime || 'Immediate'})
              </span>
            </div>
            <div className="mb-3">
              <span className="text-muted small d-block">{t('estimated_fare_label', 'Standard Fare')}</span>
              <span className="fw-bold text-dark fs-5">₹{booking?.price || 350}</span>
            </div>

            {/* Cancel Button */}
            {isCancelAllowed && (
              <div className="pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm w-100"
                  onClick={() => setShowCancelModal(true)}
                >
                  {isFreeCancellation
                    ? t('cancel_booking_free', 'Cancel Booking (Free)')
                    : t('cancel_booking_admin', 'Cancel Booking (Flag for Admin)')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Tracking / Action Steps */}
        <div className="col-12 col-md-6">
          {/* Live Mutual GPS Tracker: Shown immediately once specialist accepts the request */}
          {['accepted', 'en_route', 'arrived', 'in_progress', 'Accepted', 'Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress'].includes(currentStatus) && (
            <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white border">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="d-flex align-items-center gap-2">
                  <Navigation size={18} className="text-primary" />
                  <h3 className="h6 fw-bold text-dark mb-0">{t('live_tracking_map_header', 'Live Mutual Location Tracker')}</h3>
                </div>
                <span className="badge bg-success-subtle text-success">
                  {currentStatus === 'arrived' || currentStatus === 'Arrived'
                    ? t('pro_arrived_badge', 'Arrived at Doorstep')
                    : currentStatus === 'accepted' || currentStatus === 'Accepted'
                    ? t('pro_accepted_badge', 'Accepted — Live Tracking Active')
                    : t('pro_en_route_badge', 'En Route (Live GPS)')}
                </span>
              </div>
              <div className="mb-2 p-2 bg-light rounded-3 text-muted small d-flex align-items-center justify-content-between">
                <span>📍 Doorstep Spot: <strong>{booking?.address || 'Pinned Location'}</strong></span>
                <span className="badge bg-primary font-monospace">
                  {Number(booking?.userLat || booking?.pickupLat || booking?.location?.coordinates?.[1] || 9.8433).toFixed(4)}, {Number(booking?.userLng || booking?.pickupLng || booking?.location?.coordinates?.[0] || 78.4809).toFixed(4)}
                </span>
              </div>
              <LiveTrackerMap
                booking={booking}
                worker={workerObj}
                userLat={booking?.userLat || booking?.pickupLat || booking?.location?.coordinates?.[1] || 9.8433}
                userLng={booking?.userLng || booking?.pickupLng || booking?.location?.coordinates?.[0] || 78.4809}
              />
            </div>
          )}

          {/* Step 7: Completed -> Payment CTA with Razorpay & Wallet Integration */}
          {(currentStatus === 'completed' || currentStatus === 'WorkCompleted') && (
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 text-center bg-white border">
              <CheckCircle2 size={42} className="text-success mx-auto mb-2" />
              <h3 className="h5 fw-bold text-dark mb-1">{t('work_marked_completed', 'Work Completed by Technician!')}</h3>
              <p className="text-muted small mb-3">
                {t('payment_prompt_sub', 'Please verify the repair and complete checkout via Razorpay or Wallet balance.')}
              </p>
              <div className="d-flex flex-wrap justify-content-center gap-2">
                <PayButton
                  booking={booking}
                  onRefresh={fetchBooking}
                  onSuccess={(receipt) => {
                    fetchBooking();
                  }}
                  buttonClassName="btn btn-primary py-2 px-4 rounded-3 fw-bold d-inline-flex align-items-center gap-2 shadow-sm"
                  buttonText={t('proceed_to_payment_btn', `Pay ₹${booking?.price || 350} via Razorpay / Wallet`)}
                />
                <Link
                  to={`/payment/${bookingId}`}
                  className="btn btn-outline-secondary py-2 px-3 rounded-3 small d-inline-flex align-items-center gap-1"
                >
                  <CreditCard size={16} />
                  <span>{t('detailed_checkout', 'Detailed Checkout')}</span>
                </Link>
              </div>
            </div>
          )}

          {/* Step 8: Paid -> Review Form */}
          {(currentStatus === 'paid' || currentStatus === 'reviewed') && (
            <ReviewForm booking={booking} onReviewSubmitted={handleReviewFinished} />
          )}

          {/* Pending status placeholder */}
          {(currentStatus === 'pending' || currentStatus === 'Pending' || currentStatus === 'PendingDispatch') && (
            <div className="card border-0 shadow-sm rounded-4 p-4 text-center bg-light border">
              <Navigation size={32} className="text-primary opacity-60 mx-auto mb-2" />
              <h3 className="h6 fw-bold text-dark mb-1">
                {t('waiting_for_worker_accept', 'Matching Nearest Available Professional...')}
              </h3>
              <p className="text-muted small mb-0">
                {t(
                  'dispatch_in_progress_sub',
                  'Your booking request is broadcasting to verified specialists within 5 km. Once accepted, technician details, ratings, and live tracking will appear immediately.'
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-dark">{t('confirm_cancel_title', 'Cancel Service Booking?')}</h5>
                <button type="button" className="btn-close" onClick={() => setShowCancelModal(false)} />
              </div>
              <div className="modal-body">
                <p className="small text-muted mb-3">
                  {isFreeCancellation
                    ? t('free_cancel_note', 'Technician is not yet en route. Free cancellation applies.')
                    : t('admin_flag_cancel_note', 'Technician has already set out. This cancellation will be reviewed by SmartFix Admin.')}
                </p>
                <label className="form-label small fw-semibold text-muted">
                  {t('cancel_reason_label', 'Reason for Cancellation')}
                </label>
                <select
                  className="form-select mb-2"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                >
                  <option value="">{t('select_reason_ph', '-- Select reason --')}</option>
                  <option value="Issue resolved myself">Issue resolved myself</option>
                  <option value="Booked by mistake">Booked by mistake</option>
                  <option value="Need different time slot">Need different time slot</option>
                  <option value="Emergency cancellation">Emergency cancellation</option>
                </select>
              </div>
              <div className="modal-footer border-top">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCancelModal(false)}>
                  {t('close_btn', 'Keep Booking')}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={cancelling}
                  onClick={handleCancelBooking}
                >
                  {cancelling ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                  {t('confirm_cancel_btn', 'Confirm Cancellation')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
