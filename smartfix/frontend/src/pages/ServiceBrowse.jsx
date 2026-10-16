import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { Wrench, Zap, Wind, Refrigerator, Disc, Droplets, ArrowRight, Search, ShieldCheck, CheckCircle } from 'lucide-react';

const CATEGORY_ICONS = {
  Plumbing: Wrench,
  'Electrical Repairs': Zap,
  'AC Service and Repair': Wind,
  'Refrigerator Repair': Refrigerator,
  'Washing Machine Repair': Disc,
  'Water Purifier Service': Droplets,
};

export default function ServiceBrowse() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadCategories = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiService.getCategories();
        setCategories(data || []);
        if (data && data.length > 0) {
          setSelectedCategory(data[0]);
        }
      } catch (err) {
        setError(err.message || 'Failed to load service categories');
      } finally {
        setLoading(false);
      }
    };
    loadCategories();
  }, []);

  const filteredCategories = categories.filter((cat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchName = cat.name.toLowerCase().includes(q);
    const matchSub = (cat.subServices || []).some(
      (s) => (typeof s === 'string' ? s : s.name || '').toLowerCase().includes(q)
    );
    return matchName || matchSub;
  });

  const handleSelectSubService = (catName, sub) => {
    const subName = typeof sub === 'string' ? sub : sub.name || '';
    navigate(`/book?category=${encodeURIComponent(catName)}&subService=${encodeURIComponent(subName)}`);
  };

  const handleBookCategory = (catName) => {
    navigate(`/book?category=${encodeURIComponent(catName)}`);
  };

  return (
    <div className="container py-5" style={{ minHeight: '80vh' }}>
      {/* Header Banner */}
      <div className="text-center mb-5">
        <div className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill mb-2 fw-semibold">
          <ShieldCheck size={16} className="me-1 inline-block align-text-bottom" />
          {t('verified_professionals_tn', 'Tamil Nadu Verified Service Experts')}
        </div>
        <h1 className="display-6 fw-bold text-dark mb-2">
          {t('explore_our_services', 'Choose Your Repair Category')}
        </h1>
        <p className="text-muted lead fs-6 mx-auto" style={{ maxWidth: '640px' }}>
          {t(
            'services_desc',
            'Select from our 6 certified home repair trades. Instant 5 km dispatch across Tamil Nadu.'
          )}
        </p>

        {/* Search bar */}
        <div className="mx-auto mt-4" style={{ maxWidth: '520px' }}>
          <div className="input-group input-group-lg shadow-sm rounded-4 overflow-hidden border">
            <span className="input-group-text bg-white border-0 ps-3">
              <Search size={20} className="text-muted" />
            </span>
            <input
              type="text"
              className="form-control border-0 ps-2"
              placeholder={t('search_services_ph', 'Search plumbing, AC gas, motor leak, etc...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="btn btn-white text-muted border-0"
                onClick={() => setSearchQuery('')}
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="d-flex flex-column justify-content-center align-items-center py-5">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }} />
          <p className="text-muted">{t('loading_services_from_db', 'Fetching live service catalog from database...')}</p>
        </div>
      )}

      {error && (
        <div className="alert alert-danger text-center max-w-md mx-auto my-4" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="row g-4">
          {filteredCategories.map((cat) => {
            const IconComp = CATEGORY_ICONS[cat.name] || Wrench;
            const subList = cat.subServices || [];

            return (
              <div key={cat.name} className="col-12 col-md-6 col-lg-4">
                <div className="card h-100 border-0 shadow-sm rounded-4 hover-shadow transition-all overflow-hidden d-flex flex-column"
                     style={{ border: '1px solid rgba(226, 232, 240, 0.8)', background: '#ffffff' }}>
                  <div className="card-body p-4 d-flex flex-column">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div
                        className="rounded-3 p-3 d-flex align-items-center justify-content-center text-primary"
                        style={{ background: '#eff6ff', width: '56px', height: '56px' }}
                      >
                        <IconComp size={28} />
                      </div>
                      <div>
                        <h2 className="h5 fw-bold mb-0 text-dark">{cat.name}</h2>
                        <span className="badge bg-secondary-subtle text-secondary small">
                          {subList.length} {t('options_available', 'sub-services')}
                        </span>
                      </div>
                    </div>

                    <p className="text-muted small mb-3 flex-grow-0">
                      {cat.description || t('standard_service_guarantee', '100% background-checked certified Tamil Nadu technicians with upfront pricing.')}
                    </p>

                    <div className="mt-auto">
                      <h3 className="small fw-bold text-uppercase text-muted mb-2" style={{ letterSpacing: '0.05em', fontSize: '0.75rem' }}>
                        {t('sub_services_title', 'Available Sub-Services')}
                      </h3>
                      <div className="d-flex flex-wrap gap-1 mb-4">
                        {subList.map((sub, idx) => {
                          const subName = typeof sub === 'string' ? sub : sub.name || '';
                          return (
                            <button
                              key={idx}
                              type="button"
                              className="btn btn-sm btn-light border text-dark fw-normal rounded-pill px-2 py-1 text-truncate"
                              style={{ fontSize: '0.8rem', maxWidth: '100%' }}
                              onClick={() => handleSelectSubService(cat.name, sub)}
                            >
                              <CheckCircle size={12} className="me-1 text-success inline-block" />
                              {subName}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary w-100 rounded-3 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                        onClick={() => handleBookCategory(cat.name)}
                      >
                        <span>{t('book_service_btn', 'Book This Trade')}</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
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
