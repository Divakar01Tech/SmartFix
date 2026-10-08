import { Link } from 'react-router-dom';
import { MapPin, Wrench, ShieldCheck, Phone, MessageSquare, Navigation, Lock, Award, Sparkles, PhoneCall } from 'lucide-react';
import { getWorkerDistance } from '../utils/distance';
import { useCall } from '../context/CallContext';
import { useLanguage } from '../context/LanguageContext';
import './WorkerCard.css';

const WorkerCard = ({ worker = {}, index = 0, confirmedBooking = false }) => {
  const { startCall } = useCall();
  const { t, tTrade, language } = useLanguage();
  const safeWorker = worker || {};
  const workerId = safeWorker._id || safeWorker.id || 'w1';
  const ratingVal = Number(safeWorker.rating) || 0;
  const ratingCountVal = Number(safeWorker.ratingCount) || 0;
  const phoneNum = safeWorker.phone || '';
  const cleanPhone = String(phoneNum).replace(/[^0-9]/g, '') || '9876543210';
  const distanceKm = safeWorker.distance || getWorkerDistance(safeWorker, 9.8433, 78.4809, index) || 2.5;

  const whatsappMessage = encodeURIComponent(
    `Hello ${safeWorker.name || 'Specialist'}, I saw your ${safeWorker.trade || 'service'} profile on SmartFix. Are you available for service?`
  );

  const isWorkerOnline = safeWorker.isAvailable !== false && safeWorker.isOnline !== false;

  const experienceDisplay =
    typeof safeWorker.experience === 'string'
      ? safeWorker.experience
      : typeof safeWorker.experienceYears === 'number' || typeof safeWorker.experienceYears === 'string'
      ? `${safeWorker.experienceYears} years exp`
      : '5+ years exp';

  return (
    <div className="card h-100 border-0 shadow-sm rounded-4 p-3 worker-card-bootstrap transition-all animate-scale-up">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="d-flex align-items-center gap-1">
          {distanceKm <= 3.0 ? (
            <span className="badge bg-success-subtle text-success fw-bold px-2 py-1 rounded-pill">
              <Navigation size={11} /> {distanceKm} km
            </span>
          ) : (
            <span className="badge bg-light text-secondary border px-2 py-1 rounded-pill">
              📍 {distanceKm} km
            </span>
          )}
          {isWorkerOnline ? (
            <span className="badge bg-success text-white fw-bold px-2 py-1 rounded-pill d-inline-flex align-items-center gap-1 shadow-xs">
              🟢 {t('online_now')}
            </span>
          ) : (
            <span className="badge bg-secondary-subtle text-secondary border fw-bold px-2 py-1 rounded-pill">
              🔴 {t('offline')}
            </span>
          )}
        </div>
        <div className="badge bg-warning-subtle text-warning-emphasis fw-bold px-2 py-1 rounded-pill border border-warning">
          <ShieldCheck size={13} color="#d97706" /> {t('verified_badge')}
        </div>
      </div>

      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="worker-avatar-circle bg-light rounded-circle border p-2 d-flex align-items-center justify-content-center shadow-sm position-relative" style={{ width: 56, height: 56, fontSize: '1.8rem' }}>
          {safeWorker.avatar || '👨‍🔧'}
          <span className={`position-absolute bottom-0 end-0 border border-white rounded-circle p-1 ${isWorkerOnline ? 'bg-success' : 'bg-secondary'}`} title={isWorkerOnline ? "Online" : "Offline"}></span>
        </div>
        <div>
          <h5 className="fw-bold text-dark mb-0">{typeof safeWorker.name === 'string' ? safeWorker.name : 'Specialist'}</h5>
          <span className="badge bg-primary-subtle text-primary fw-semibold me-1">
            <Wrench size={12} /> {tTrade(safeWorker.trade) || 'Handyman'}
          </span>
          <small className="text-muted d-block mt-1">
            <Award size={12} /> {experienceDisplay}
          </small>
        </div>
      </div>

      <div className="worker-info-details mb-3">
        <p className="text-secondary small mb-1">
          <MapPin size={13} color="#2563eb" /> {worker.location || 'Tamil Nadu, Tamil Nadu'}
        </p>

        <p className="text-success small fw-semibold mb-2 d-flex align-items-center gap-1">
          <Phone size={13} />
          <span className="badge bg-success-subtle text-success border rounded-pill fw-bold" style={{ fontSize: '0.74rem' }}>
            🔒 {phoneNum ? `${phoneNum.substring(0, 6)}*****` : t('secured_number')}
          </span>
        </p>

        {worker.subServices && worker.subServices.length > 0 && (
          <div className="d-flex flex-wrap gap-1 mb-2">
            {worker.subServices.slice(0, 3).map((sub) => (
              <span key={sub} className="badge bg-light text-dark border fw-normal" style={{ fontSize: '0.76rem' }}>
                ✓ {sub}
              </span>
            ))}
            {worker.subServices.length > 3 && (
              <span className="badge bg-light text-secondary border" style={{ fontSize: '0.76rem' }}>
                +{worker.subServices.length - 3} more
              </span>
            )}
          </div>
        )}

        {confirmedBooking ? (
          (ratingCountVal > 0 && ratingVal > 0) ? (
            <div className="text-warning small fw-bold">
              {'★'.repeat(Math.round(ratingVal))} {ratingVal} <span className="text-muted fw-normal">({ratingCountVal} reviews)</span>
            </div>
          ) : (
            <div className="badge bg-success-subtle text-success border border-success-subtle fw-bold small">
              ✨ New Provider
            </div>
          )
        ) : (
          <div className="text-muted small d-flex align-items-center gap-1">
            <Lock size={12} /> <span>{t('rating_revealed_on_booking')}</span>
          </div>
        )}

        {confirmedBooking && (language === 'ta' && safeWorker.bioTa ? safeWorker.bioTa : safeWorker.bioEn) && (
          <div className="mt-2 p-2 bg-light rounded text-secondary" style={{ fontSize: '0.8rem', fontStyle: 'italic', borderLeft: '3px solid #cbd5e1' }}>
            "{language === 'ta' && safeWorker.bioTa ? safeWorker.bioTa : safeWorker.bioEn}"
          </div>
        )}

        {confirmedBooking && safeWorker.reviewSummary && (language === 'ta' && safeWorker.reviewSummary.ta ? safeWorker.reviewSummary.ta : safeWorker.reviewSummary.en) && (
          <div className="mt-2 p-2 rounded" style={{ fontSize: '0.8rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <strong style={{ display: 'block', color: '#0f172a', marginBottom: '4px' }}>✨ AI summary of customer reviews:</strong>
            <span style={{ color: '#475569' }}>
              {language === 'ta' && safeWorker.reviewSummary.ta ? safeWorker.reviewSummary.ta : safeWorker.reviewSummary.en}
            </span>
          </div>
        )}
      </div>

      {/* Quick Contact Buttons Removed: Contact only allowed post-booking */}

      <div className="mt-auto d-flex justify-content-between align-items-center border-top pt-3">
        <div>
          <span className="fs-5 fw-extrabold text-success">₹{worker.ratePerHour}</span>
          <span className="text-muted small"> / {t('per_hour')}</span>
        </div>
        <Link to={`/booking/${workerId}`} className="btn btn-primary fw-bold px-3 py-2 rounded-3 shadow-sm">
          {t('instant_book')}
        </Link>
      </div>
    </div>
  );
};

export default WorkerCard;
