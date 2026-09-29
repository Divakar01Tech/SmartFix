import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { HOME_SERVICES } from '../data/servicesData';
import { apiService } from '../services/api';
import OnlineWorkersWidget from '../components/OnlineWorkersWidget';
import HandymanMap from '../components/HandymanMap';
import { Search, ShieldCheck, Clock, Star, ArrowRight, CheckCircle2, Sparkles, UserPlus, HeartHandshake, Zap, MapPin, DollarSign, Wrench, Map, Eye, X, ChevronRight, Layers, Tag } from 'lucide-react';
import './Home.css';

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Senthil Nathan',
    town: 'Karaikudi, Tamil Nadu',
    rating: 5,
    role: 'Homeowner',
    review: 'Booked a plumber for pipe leak emergency in Karaikudi. Technician Ramesh arrived in 25 mins with proper tools and fixed it. Transparent pricing and polite service!',
    avatar: '👨‍💼',
  },
  {
    id: 2,
    name: 'Kavitha Subramanian',
    town: 'Sivagangai Town',
    rating: 5,
    role: 'Customer',
    review: 'AC gas refilling was done perfectly. I loved the live GPS tracking and upfront price estimation. Highly recommended for families in Sivagangai district!',
    avatar: '👩‍💼',
  },
  {
    id: 3,
    name: 'Murugan V',
    town: 'Devakottai',
    rating: 5,
    role: 'Verified Master Electrician (Worker)',
    review: 'As an electrician, SmartFix gives me direct local customer jobs with 0% platform fee on my first 10 jobs and instant UPI bank payout. Proud to be a SmartFix partner!',
    avatar: '👨‍🔧',
  },
];

const Home = () => {
  const { user } = useAuth();
  const { t, tTrade } = useLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [workers, setWorkers] = useState([]);
  const [selectedModalCategory, setSelectedModalCategory] = useState(null);

  const displayHomeServices = useMemo(() => {
    if (user?.role === 'handyman' && user.trade) {
      const uTradeClean = user.trade.toLowerCase().trim();
      return HOME_SERVICES.filter((c) => {
        const cNameClean = c.name.toLowerCase().trim();
        return !(cNameClean === uTradeClean || cNameClean.includes(uTradeClean) || uTradeClean.includes(cNameClean));
      });
    }
    return HOME_SERVICES;
  }, [user]);

  useEffect(() => {
    const loadHomeWorkers = async () => {
      try {
        const data = await apiService.getWorkers();
        if (data && Array.isArray(data)) {
          setWorkers(data);
        }
      } catch (e) {}
    };
    loadHomeWorkers();
  }, []);

  const handleHeroSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/browse?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className="home-page animate__animated animate__fadeIn">
      {/* Traditional Warm Welcome Top Bar */}
      <div className="traditional-top-welcome-bar py-2 shadow-sm">
        <div className="container d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-warning text-dark fw-bold px-3 py-2 rounded-pill d-flex align-items-center gap-1 shadow-sm">
              <Sparkles size={14} /> {t('welcome_label')}
            </span>
            <span className="text-light fw-medium d-none d-md-inline" style={{ fontSize: '0.9rem' }}>
              {t('verified_pros')}
            </span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <Link to="/browse" className="badge bg-light text-dark fw-bold text-decoration-none px-3 py-2 rounded-pill border">
              {t('radial_dispatch_badge')}
            </Link>
            <Link
              to="/login?role=handyman"
              className="btn btn-sm btn-outline-light fw-bold rounded-pill px-3"
            >
              {t('worker_join_badge')}
            </Link>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container hero-container">
          <div className="hero-content">
            <div className="hero-badge animate__animated animate__pulse animate__infinite">
              <ShieldCheck size={16} /> <span>{t('hero_badge')}</span>
            </div>
            <h1>{t('hero_title')}</h1>
            <p className="hero-subtitle">{t('hero_subtitle')}</p>

            {/* Main Search Bar Form */}
            <form className="hero-search-box shadow-lg" onSubmit={handleHeroSearch}>
              <Search className="hero-search-icon" size={22} />
              <input
                type="text"
                placeholder={t('hero_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="hero-search-btn">
                {t('search_btn')}
              </button>
            </form>

            <div className="hero-features">
              <span><CheckCircle2 size={16} color="#10b981" /> {t('feat_ver_techs')}</span>
              <span><CheckCircle2 size={16} color="#10b981" /> {t('feat_upfront_pricing')}</span>
              <span><CheckCircle2 size={16} color="#10b981" /> {t('feat_same_day')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Handyman Partner Banner for Pros */}
      {user?.role === 'handyman' && (
        <section className="handyman-welcome-banner py-4 bg-primary text-white shadow-sm">
          <div className="container d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <h4 className="fw-extrabold mb-1 d-flex align-items-center gap-2">
                <Wrench size={22} /> Welcome, Partner {user.name}!
              </h4>
              <p className="mb-0 text-white-50" style={{ fontSize: '0.92rem' }}>
                You are registered as a <strong>{user.trade}</strong> Specialist in <strong>{user.location}</strong>. 
                Explore customer requests or switch your availability status.
              </p>
            </div>
            <div className="d-flex gap-2">
              <Link to="/handyman-dashboard" className="btn btn-warning fw-extrabold rounded-pill px-4 shadow-sm">
                Go to Partner Dashboard 🛠️
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Modern Glassmorphic Categories Section */}
      <section className="services-section section-padding">
        <div className="container">
          <div className="section-title text-center">
            <span className="modern-section-badge mb-2">
              <Sparkles size={14} /> CORE REPAIR SERVICES
            </span>
            <h2>{user?.role === 'handyman' ? 'Explore Other Home Services' : t('services_title')}</h2>
            <p>{t('services_subtitle')}</p>
          </div>

          <div className="services-grid">
            {displayHomeServices.map((cat) => (
              <div
                key={cat.id}
                className="service-card modern-glass-card"
                style={{ '--cat-color': cat.color }}
                onClick={() => navigate(`/browse?category=${encodeURIComponent(cat.name)}`)}
              >
                {/* Dynamic Top Accent Bar */}
                <div className="service-card-accent-bar" style={{ background: `linear-gradient(90deg, ${cat.color}, ${cat.color}88)` }}></div>

                <div className="service-card-header-row">
                  <div className="service-icon-wrapper" style={{ background: `linear-gradient(135deg, ${cat.color}22 0%, ${cat.color}08 100%)`, color: cat.color }}>
                    <span className="category-emoji-icon">{cat.icon}</span>
                  </div>
                  <span className="starting-price-badge">
                    {t('starts_at')} ₹{cat.startingPrice}
                  </span>
                </div>

                <div className="service-card-body">
                  <h3>{tTrade(cat.name)}</h3>
                  <p>{cat.desc}</p>

                  {/* Sub-services Preview Pills */}
                  {cat.subServices && cat.subServices.length > 0 && (
                    <div className="subservices-preview-list">
                      {cat.subServices.slice(0, 3).map((sub, idx) => (
                        <span key={idx} className="subservice-pill-tag">
                          {sub}
                        </span>
                      ))}
                      {cat.subServices.length > 3 && (
                        <span className="subservice-pill-more">
                          +{cat.subServices.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="service-card-footer">
                  <button
                    type="button"
                    className="quick-view-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedModalCategory(cat);
                    }}
                  >
                    <Eye size={15} /> Quick View
                  </button>
                  <div className="book-category-btn">
                    <span>Book</span>
                    <ArrowRight size={15} className="arrow-icon" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Quick View Service Modal */}
      {selectedModalCategory && (
        <div
          className="service-modal-backdrop"
          onClick={() => setSelectedModalCategory(null)}
        >
          <div
            className="service-modal-card animate__animated animate__fadeInUp"
            onClick={(e) => e.stopPropagation()}
            style={{ '--cat-color': selectedModalCategory.color }}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => setSelectedModalCategory(null)}
            >
              <X size={18} />
            </button>

            <div className="service-modal-header d-flex align-items-center gap-3 mb-4">
              <div
                className="service-modal-icon"
                style={{
                  background: `linear-gradient(135deg, ${selectedModalCategory.color}25 0%, ${selectedModalCategory.color}10 100%)`,
                  color: selectedModalCategory.color,
                }}
              >
                <span>{selectedModalCategory.icon}</span>
              </div>
              <div>
                <span className="badge bg-primary-subtle text-primary rounded-pill mb-1 fw-bold px-3 py-1" style={{ fontSize: '0.78rem' }}>
                  SmartFix Certified Trade
                </span>
                <h3 className="fw-extrabold mb-0" style={{ fontSize: '1.45rem' }}>
                  {tTrade(selectedModalCategory.name)}
                </h3>
              </div>
            </div>

            <p className="service-modal-desc text-muted mb-4" style={{ fontSize: '0.94rem', lineHeight: '1.6' }}>
              {selectedModalCategory.description || selectedModalCategory.desc}
            </p>

            <div className="service-modal-pricing-box p-3 rounded-4 mb-4 d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <Tag size={18} color="var(--primary-color)" />
                <div>
                  <div className="fw-bold text-dark" style={{ fontSize: '0.88rem' }}>Starting Rate</div>
                  <div className="text-muted" style={{ fontSize: '0.78rem' }}>Upfront estimated pricing</div>
                </div>
              </div>
              <div className="fw-extrabold fs-4 text-primary">
                ₹{selectedModalCategory.startingPrice}
              </div>
            </div>

            <h4 className="fw-bold fs-6 mb-3 d-flex align-items-center gap-2">
              <Layers size={16} color={selectedModalCategory.color} /> Available Sub-services & Tasks ({selectedModalCategory.subServices?.length || 0})
            </h4>

            <div className="subservices-grid mb-4">
              {selectedModalCategory.subServices?.map((sub, i) => (
                <div key={i} className="subservice-grid-item">
                  <CheckCircle2 size={16} color={selectedModalCategory.color} />
                  <span>{sub}</span>
                </div>
              ))}
            </div>

            <div className="service-modal-actions d-flex gap-2">
              <button
                type="button"
                className="btn btn-light rounded-pill flex-grow-1 fw-bold py-2 border"
                onClick={() => setSelectedModalCategory(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary rounded-pill flex-grow-2 fw-bold py-2 px-4 shadow-md d-flex align-items-center justify-content-center gap-2"
                style={{ backgroundColor: selectedModalCategory.color, borderColor: selectedModalCategory.color }}
                onClick={() => {
                  const catName = selectedModalCategory.name;
                  setSelectedModalCategory(null);
                  navigate(`/browse?category=${encodeURIComponent(catName)}`);
                }}
              >
                <span>Find Technicians</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Handyman Dispatch Radar & Map Section */}
      <section className="map-section section-padding bg-light border-top border-bottom">
        <div className="container">
          <div className="section-title text-center mb-4">
            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 bg-primary-subtle text-primary fw-bold rounded-pill mb-2" style={{ fontSize: '0.85rem' }}>
              <Map size={16} /> Real-Time Sivagangai Handyman Network
            </div>
            <h2>Live Technician Availability & Dispatch Map</h2>
            <p>View verified plumbers, electricians, and technicians active in Sivagangai District.</p>
          </div>

          <div className="card shadow-md border-0 rounded-4 overflow-hidden mb-4">
            <div className="card-header bg-dark text-white p-3 d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <span className="spinner-grow spinner-grow-sm text-success" role="status"></span>
                <span className="fw-bold" style={{ fontSize: '0.9rem' }}>Live GPS Radar: Sivagangai District</span>
              </div>
              <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill fw-bold">
                {workers.filter(w => w.isOnline !== false).length} Active Technicians Online
              </span>
            </div>
            <div className="card-body p-0" style={{ height: '420px', position: 'relative' }}>
              <HandymanMap workers={workers} height="100%" />
            </div>
          </div>
        </div>
      </section>

      {/* Online Active Workers Quick Dispatch Carousel */}
      <OnlineWorkersWidget />


      {/* Local Sivagangai District Testimonials */}
      <section className="testimonials-section section-padding bg-light border-top">
        <div className="container">
          <div className="section-title text-center">
            <h2>Local Customer Testimonials</h2>
            <p>Real reviews from homeowners and service technicians in Sivagangai district.</p>
          </div>

          <div className="testimonials-grid">
            {TESTIMONIALS.map((test) => (
              <div key={test.id} className="testimonial-card shadow-xs">
                <div className="testimonial-header">
                  <span className="avatar-emoji">{test.avatar}</span>
                  <div>
                    <h4>{test.name}</h4>
                    <span className="town-badge"><MapPin size={12} /> {test.town}</span>
                  </div>
                </div>
                <div className="star-rating my-2">
                  {[...Array(test.rating)].map((_, i) => (
                    <Star key={i} size={15} color="#f59e0b" fill="#f59e0b" />
                  ))}
                </div>
                <p className="review-text">"{test.review}"</p>
                <div className="role-tag">{test.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
