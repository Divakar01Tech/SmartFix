import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Heart, Trash2, ArrowRight, Wrench, MapPin,
  Star, ShieldCheck, Navigation, ExternalLink, Sparkles
} from 'lucide-react';
import { useComfort } from '../context/ComfortContext';
import { useLanguage } from '../context/LanguageContext';
import './SavedWorkersModal.css';

export default function SavedWorkersModal() {
  const navigate = useNavigate();
  const { isSavedModalOpen, setIsSavedModalOpen, favoriteWorkers, removeFavorite } = useComfort();
  const { t, tTrade } = useLanguage();

  if (!isSavedModalOpen) return null;

  const handleBook = (workerId) => {
    setIsSavedModalOpen(false);
    navigate(`/customer/book/${workerId}`);
  };

  return (
    <div
      className="saved-modal-backdrop animate-fade-in"
      onClick={() => setIsSavedModalOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="saved-modal-container animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="saved-modal-header">
          <div className="d-flex align-items-center gap-2">
            <div className="saved-icon-box">
              <Heart size={20} color="#ef4444" style={{ fill: '#ef4444' }} />
            </div>
            <div>
              <h5 className="saved-title mb-0">Saved Specialists</h5>
              <small className="text-muted" style={{ fontSize: '0.78rem' }}>
                {favoriteWorkers.length} favorite {favoriteWorkers.length === 1 ? 'handyman' : 'handymen'} saved for quick rebooking
              </small>
            </div>
          </div>
          <button
            type="button"
            className="saved-close-btn"
            onClick={() => setIsSavedModalOpen(false)}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="saved-modal-body">
          {favoriteWorkers.length === 0 ? (
            <div className="saved-empty-state">
              <div className="saved-empty-icon-wrap">
                <Heart size={36} className="text-danger" />
              </div>
              <h6 className="fw-bold text-dark mb-1">No Saved Specialists Yet</h6>
              <p className="text-muted small mb-4" style={{ maxWidth: '340px' }}>
                Whenever you find an electrician, plumber, or technician you trust, tap the heart (❤️) icon to save them here for 1-click rebooking!
              </p>
              <button
                type="button"
                className="btn btn-primary rounded-pill px-4 fw-bold d-flex align-items-center gap-2 shadow-sm"
                onClick={() => {
                  setIsSavedModalOpen(false);
                  navigate('/customer/experts');
                }}
              >
                Browse Nearby Specialists <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="saved-workers-list">
              {favoriteWorkers.map((worker) => {
                const workerId = worker._id || worker.id;
                const isOnline = worker.isOnline !== false;
                return (
                  <div key={workerId} className="saved-worker-card">
                    <div className="saved-worker-avatar">
                      {worker.avatar && (worker.avatar.startsWith('http') || worker.avatar.startsWith('/')) ? (
                        <img
                          src={worker.avatar}
                          alt={worker.name}
                          className="w-100 h-100 rounded-circle"
                          style={{ objectFit: 'cover' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            if (e.currentTarget.parentElement) {
                              e.currentTarget.parentElement.innerText = '👨‍🔧';
                            }
                          }}
                        />
                      ) : (
                        worker.avatar || '👨‍🔧'
                      )}
                      <span
                        className={`saved-online-dot ${isOnline ? 'online' : 'offline'}`}
                        title={isOnline ? 'Online' : 'Offline'}
                      />
                    </div>

                    <div className="saved-worker-details">
                      <div className="d-flex align-items-center gap-2">
                        <span className="saved-worker-name">{worker.name || 'Specialist'}</span>
                        <span className="badge bg-warning-subtle text-warning-emphasis fw-bold rounded-pill" style={{ fontSize: '0.65rem' }}>
                          <ShieldCheck size={11} className="me-1" /> Verified
                        </span>
                      </div>

                      <div className="saved-worker-meta">
                        <span className="badge bg-primary-subtle text-primary fw-semibold" style={{ fontSize: '0.72rem' }}>
                          <Wrench size={11} className="me-1" />
                          {tTrade(worker.trade) || worker.trade || 'Handyman'}
                        </span>
                        <span className="saved-meta-item">
                          <Star size={12} className="text-warning fill-warning" style={{ fill: '#f59e0b' }} />
                          {worker.rating || '5.0'}
                        </span>
                        <span className="saved-meta-item">
                          <MapPin size={12} className="text-secondary" />
                          {worker.location || 'Sivagangai'}
                        </span>
                      </div>

                      <div className="saved-worker-price mt-1">
                        <span className="fw-bold text-success">₹{worker.ratePerHour}</span>
                        <span className="text-muted small"> / hr</span>
                      </div>
                    </div>

                    <div className="saved-worker-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary rounded-pill px-3 fw-bold d-flex align-items-center gap-1 shadow-xs"
                        onClick={() => handleBook(workerId)}
                      >
                        Book Now <ArrowRight size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger rounded-circle p-2"
                        onClick={() => removeFavorite(workerId)}
                        title="Remove from saved"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {favoriteWorkers.length > 0 && (
          <div className="saved-modal-footer">
            <span className="text-muted small">
              Specialists stay saved on this device for instant access.
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold"
              onClick={() => {
                setIsSavedModalOpen(false);
                navigate('/customer/experts');
              }}
            >
              Find More Specialists
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
