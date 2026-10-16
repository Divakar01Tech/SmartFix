import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { ShieldCheck, MapPin, Clock, Users, Wrench, CheckCircle } from 'lucide-react';

export default function NearbyWorkers({ lat, lng, category }) {
  const { t } = useTranslation();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lat || !lng) return;

    let isMounted = true;
    const fetchNearby = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiService.getNearbyWorkers(lat, lng, category || '');
        if (isMounted) setWorkers(data || []);
      } catch (err) {
        if (isMounted) setError(err.message || 'Unable to scan for nearby workers');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchNearby();

    return () => {
      isMounted = false;
    };
  }, [lat, lng, category]);

  if (!lat || !lng) {
    return (
      <div className="alert alert-light border text-muted small d-flex align-items-center gap-2 mb-3">
        <MapPin size={18} className="text-secondary" />
        <span>{t('select_location_to_view_workers', 'Select or pin your location to view available nearby technicians.')}</span>
      </div>
    );
  }

  return (
    <div className="card border-0 shadow-sm rounded-4 mb-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div className="card-body p-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="d-flex align-items-center gap-2">
            <Users size={18} className="text-primary" />
            <h3 className="h6 fw-bold mb-0 text-dark">
              {t('nearby_verified_partners', 'Nearby Available Technicians (< 5 km)')}
            </h3>
          </div>
          <span className="badge bg-success-subtle text-success border border-success-subtle">
            {workers.length} {t('active_now', 'Active Now')}
          </span>
        </div>

        <p className="text-muted small mb-3">
          {t('privacy_notice_anonymous', '🔒 Technicians are anonymized for safety until booking acceptance.')}
        </p>

        {loading && (
          <div className="d-flex align-items-center gap-2 py-3 text-muted small">
            <div className="spinner-border spinner-border-sm text-primary" role="status" />
            <span>{t('scanning_5km_radius', 'Scanning 5 km radius in Tamil Nadu...')}</span>
          </div>
        )}

        {error && (
          <div className="alert alert-warning py-2 px-3 small mb-2">
            {error}
          </div>
        )}

        {!loading && workers.length === 0 && (
          <div className="text-center py-3 text-muted small">
            <Wrench size={24} className="mb-2 text-secondary opacity-50" />
            <p className="mb-0">{t('no_workers_immediate', 'No verified technician immediately within 5 km. Our dispatch pool will assign the closest available pro.')}</p>
          </div>
        )}

        {!loading && workers.length > 0 && (
          <div className="row g-2">
            {workers.map((w, idx) => (
              <div key={idx} className="col-12 col-md-6">
                <div className="p-2 bg-white rounded-3 border d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold"
                      style={{ width: '36px', height: '36px', background: '#eff6ff' }}
                    >
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="d-flex align-items-center gap-1">
                        <span className="fw-semibold text-dark small">
                          {w.trade || category || t('service_expert', 'Expert Technician')}
                        </span>
                        <ShieldCheck size={14} className="text-primary" />
                      </div>
                      <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '0.75rem' }}>
                        <span className="d-flex align-items-center gap-1">
                          <MapPin size={12} />
                          {w.distanceKm ? `${w.distanceKm} km` : t('within_range', 'Within range')}
                        </span>
                        <span>•</span>
                        <span className="d-flex align-items-center gap-1">
                          <Clock size={12} />
                          {w.estimatedArrivalMinutes ? `${w.estimatedArrivalMinutes} mins ETA` : t('15_min_dispatch', 'Fast arrival')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="badge bg-success-subtle text-success" style={{ fontSize: '0.7rem' }}>
                    {t('available_status', 'Available')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
