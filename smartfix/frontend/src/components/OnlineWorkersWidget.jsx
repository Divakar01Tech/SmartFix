import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apiService } from '../services/api';
import socket from '../services/socket';
import { useCall } from '../context/CallContext';
import { getWorkerDistance } from '../utils/distance';
import { ShieldCheck, Phone, Wrench, Navigation, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import './OnlineWorkersWidget.css';

const OnlineWorkersWidget = ({ title }) => {
  const { user } = useAuth();
  const { t, tTrade } = useLanguage();
  const [onlineWorkers, setOnlineWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { startCall } = useCall();
  const displayTitle = title || `🟢 ${t('active_online_workers')}`;

  const fetchOnlineWorkers = async () => {
    try {
      const data = await apiService.getWorkers({ online: 'true' });
      if (data && Array.isArray(data)) {
        const filtered = data
          .map((w, idx) => ({ ...w, distance: getWorkerDistance(w, 9.8433, 78.4809, idx) }))
          .filter((w) => {
            if (w.isAvailable === false || w.isOnline === false) return false;
            // 5 KM DISTANCE RULE: Exclude workers beyond 5.0 km
            if (w.distance > 5.0) return false;

            // WORKER POLICY: Exclude self and same trade workers for handyman role
            if (user?.role === 'handyman') {
              const isSelf = (w._id && (w._id === user._id || w._id === user.id)) ||
                             (w.id && (w.id === user._id || w.id === user.id)) ||
                             (w.phone && user.phone && w.phone.replace(/\D/g, '') === user.phone.replace(/\D/g, ''));
              if (isSelf) return false;

              if (user.trade && w.trade) {
                const wTrade = w.trade.toLowerCase().trim();
                const uTrade = user.trade.toLowerCase().trim();
                if (wTrade === uTrade || wTrade.includes(uTrade) || uTrade.includes(wTrade)) {
                  return false;
                }
              }
            }
            return true;
          });
        setOnlineWorkers(filtered);
      }
    } catch (e) {
      console.warn('Failed to fetch online workers notice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnlineWorkers();

    if (socket) {
      const handleOnlineUpdate = () => {
        fetchOnlineWorkers();
      };
      socket.on('worker-online-update', handleOnlineUpdate);
      return () => {
        socket.off('worker-online-update', handleOnlineUpdate);
      };
    }
  }, []);

  if (loading) {
    return (
      <div className="online-workers-widget card border-0 shadow-sm rounded-4 p-4 my-4 bg-gradient-subtle">
        <div className="d-flex align-items-center gap-2 text-muted fw-semibold">
          <span className="spinner-border spinner-border-sm text-primary"></span> ...
        </div>
      </div>
    );
  }

  return (
    <div className="online-workers-widget card border-0 shadow-sm rounded-4 p-4 my-4 position-relative overflow-hidden">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 className="fw-black text-dark mb-1 d-flex align-items-center gap-2">
            <span className="pulse-dot-live"></span> {displayTitle}
          </h4>
          <p className="text-secondary small mb-0">
            {onlineWorkers.length} {t('verified_pros')}
          </p>
        </div>
        <Link to="/browse?online=true" className="btn btn-outline-primary btn-sm rounded-pill fw-bold d-flex align-items-center gap-1">
          {t('explore_services')} <ArrowRight size={14} />
        </Link>
      </div>

      <div className="row g-3">
        {onlineWorkers.slice(0, 4).map((worker, idx) => {
          const workerId = worker._id || worker.id || `w_${idx}`;
          return (
            <div key={workerId} className="col-12 col-md-6 col-lg-3">
              <div className="online-worker-mini-card p-3 rounded-3 border bg-white shadow-xs position-relative h-100 d-flex flex-column justify-content-between">
                <span className="badge bg-success text-white fw-bold position-absolute top-0 end-0 m-2 rounded-pill shadow-xs" style={{ fontSize: '0.7rem' }}>
                  🟢 {t('online_now')}
                </span>

                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="avatar-box rounded-circle bg-light border p-2 text-center" style={{ width: 44, height: 44, fontSize: '1.4rem' }}>
                    {worker.avatar || '👨‍🔧'}
                  </div>
                  <div>
                    <h6 className="fw-bold mb-0 text-dark text-truncate" style={{ maxWidth: 130 }}>{worker.name}</h6>
                    <small className="text-primary fw-semibold me-1">
                      <Wrench size={11} /> {tTrade(worker.trade) || 'Handyman'}
                    </small>
                  </div>
                </div>

                <div className="small text-secondary mb-3">
                  <span className="fw-bold text-success">₹{worker.ratePerHour || 350}/{t('per_hour')}</span> • {worker.location || 'Sivagangai'}
                </div>

                <div className="d-flex gap-2 mt-auto">
                  {/* Pre-booking calling disabled */}
                  <Link to={`/booking/${workerId}`} className="btn btn-sm btn-primary fw-bold w-100 rounded-2">
                    {t('instant_book')}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnlineWorkersWidget;
