import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import {
  Calendar,
  Clock,
  MapPin,
  Wrench,
  ShieldCheck,
  ChevronRight,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  CreditCard,
  Star,
} from 'lucide-react';
import PayButton from '../components/PayButton';

export default function MyBookings() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed' | 'cancelled'

  const fetchBookings = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await apiService.getMyBookings();
      setBookings(data || []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="badge bg-warning-subtle text-warning border border-warning-subtle">Pending Dispatch</span>;
      case 'accepted':
        return <span className="badge bg-info-subtle text-info border border-info-subtle">Pro Accepted</span>;
      case 'en_route':
        return <span className="badge bg-primary-subtle text-primary border border-primary-subtle">En Route 🚗</span>;
      case 'arrived':
        return <span className="badge bg-purple-subtle text-purple border" style={{ background: '#f3e8ff', color: '#7e22ce' }}>Arrived at Site</span>;
      case 'completed':
        return <span className="badge bg-warning text-dark">Awaiting Payment</span>;
      case 'paid':
        return <span className="badge bg-success-subtle text-success border border-success-subtle">Paid ✅</span>;
      case 'reviewed':
        return <span className="badge bg-success text-white">Completed & Reviewed ★</span>;
      case 'sla_breached':
        return <span className="badge bg-danger text-white">SLA Breached ⚠️</span>;
      case 'cancelled':
        return <span className="badge bg-secondary text-white">Cancelled</span>;
      default:
        return <span className="badge bg-light text-dark border">{status}</span>;
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'all') return true;
    if (filter === 'active') {
      return ['pending', 'accepted', 'en_route', 'arrived', 'completed', 'sla_breached'].includes(b.status);
    }
    if (filter === 'completed') {
      return ['paid', 'reviewed'].includes(b.status);
    }
    if (filter === 'cancelled') {
      return b.status === 'cancelled';
    }
    return true;
  });

  return (
    <div className="container py-4" style={{ maxWidth: '960px', minHeight: '80vh' }}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">
            {t('my_service_bookings', 'My Service Bookings')}
          </h1>
          <p className="text-muted small mb-0">
            {t('manage_orders_sub', 'Track real-time technician dispatch, invoices, and service progress')}
          </p>
        </div>

        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm rounded-pill d-flex align-items-center gap-1"
            onClick={fetchBookings}
          >
            <RefreshCw size={14} />
            <span>{t('refresh_btn', 'Refresh')}</span>
          </button>
          <Link to="/book" className="btn btn-primary btn-sm rounded-pill d-flex align-items-center gap-1 shadow-sm">
            <PlusCircle size={16} />
            <span>{t('book_new_service', 'Book New Service')}</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="d-flex gap-2 mb-4 overflow-auto pb-1">
        {[
          { key: 'all', label: 'All Bookings' },
          { key: 'active', label: 'Active Jobs' },
          { key: 'completed', label: 'Completed' },
          { key: 'cancelled', label: 'Cancelled' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`btn btn-sm rounded-pill px-3 fw-semibold ${
              filter === tab.key ? 'btn-primary' : 'btn-light text-muted border'
            }`}
            onClick={() => setFilter(tab.key)}
          >
            {t(`filter_${tab.key}`, tab.label)}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-4">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-muted small">{t('loading_my_bookings', 'Fetching your bookings from server...')}</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white border">
          <Wrench size={42} className="text-secondary opacity-30 mx-auto mb-3" />
          <h2 className="h5 fw-bold text-dark mb-1">{t('no_bookings_found', 'No Bookings Found')}</h2>
          <p className="text-muted small mb-4">
            {t('no_bookings_sub', 'You have no service orders matching this filter.')}
          </p>
          <div>
            <Link to="/services" className="btn btn-primary rounded-3 px-4 fw-semibold">
              {t('explore_services_btn', 'Explore Services & Book')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {filteredBookings.map((b) => {
            const bookingId = b._id || b.id;
            return (
              <div
                key={bookingId}
                className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white border hover-shadow transition-all"
              >
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-2 border-bottom">
                  <div className="d-flex align-items-center gap-2">
                    <span className="fw-bold text-dark fs-6">
                      #{bookingId.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-muted small">•</span>
                    <span className="text-dark fw-semibold small">{b.category}</span>
                  </div>
                  <div>{getStatusBadge(b.status)}</div>
                </div>

                <div className="row g-3 align-items-center">
                  <div className="col-12 col-md-5">
                    <div className="text-muted small mb-1">{b.subService || 'Standard Service'}</div>
                    <div className="text-muted small d-flex align-items-center gap-1 text-truncate">
                      <MapPin size={14} className="text-secondary flex-shrink-0" />
                      <span className="text-truncate">{b.address}</span>
                    </div>
                  </div>

                  <div className="col-6 col-md-3">
                    <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                      {t('scheduled_slot', 'Slot')}
                    </div>
                    <div className="small fw-semibold text-dark">
                      {b.scheduledDate} ({b.scheduledTime || 'Immediate'})
                    </div>
                  </div>

                  <div className="col-6 col-md-2">
                    <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                      {t('amount_label', 'Fare')}
                    </div>
                    <div className="fw-bold text-dark fs-6">₹{b.price || 350}</div>
                  </div>

                  <div className="col-12 col-md-2 text-md-end">
                    {b.status === 'completed' ? (
                      <PayButton
                        booking={b}
                        onRefresh={loadBookings}
                        buttonClassName="btn btn-primary btn-sm w-100 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-sm"
                        buttonText={t('pay_now_btn', 'Pay Now')}
                      />
                    ) : b.status === 'paid' ? (
                      <Link
                        to={`/booking/${bookingId}/status`}
                        className="btn btn-outline-warning btn-sm w-100 rounded-3 fw-semibold d-flex align-items-center justify-content-center gap-1"
                      >
                        <Star size={14} />
                        <span>{t('rate_pro_btn', 'Rate Pro')}</span>
                      </Link>
                    ) : (
                      <Link
                        to={`/booking/${bookingId}/status`}
                        className="btn btn-outline-primary btn-sm w-100 rounded-3 fw-semibold d-flex align-items-center justify-content-center gap-1"
                      >
                        <span>{t('track_status_btn', 'Track')}</span>
                        <ChevronRight size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
