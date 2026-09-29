import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { categories } from '../data/mockData';
import { HOME_SERVICES } from '../data/servicesData';
import WorkerCard from '../components/WorkerCard';
import HandymanMap from '../components/HandymanMap';
import OnlineWorkersWidget from '../components/OnlineWorkersWidget';
import { apiService } from '../services/api';
import { getWorkerDistance, getCityBase } from '../utils/distance';
import { getUserCurrentLocation } from '../utils/geolocation';
import { Search, MapPin, Map, LayoutGrid, RotateCcw, Navigation, Wrench, Sparkles, Info } from 'lucide-react';
import './Browse.css';

const Browse = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';
  const initialQuery = searchParams.get('q') || '';
  const initialOnline = searchParams.get('online') === 'true';

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [selectedSubService, setSelectedSubService] = useState('all');
  const [location, setLocation] = useState('all');
  const [within5km, setWithin5km] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(initialOnline);
  const [viewMode, setViewMode] = useState('grid');
  const [userGps, setUserGps] = useState(null);
  const [locatingGps, setLocatingGps] = useState(false);

  // Get sub-services for the currently selected category
  const activeCategorySubServices = useMemo(() => {
    if (!category || category === 'all') return [];
    const found = HOME_SERVICES.find(
      (c) => c.name.toLowerCase() === category.toLowerCase() || c.name.toLowerCase().includes(category.toLowerCase())
    );
    return found ? found.subServices : [];
  }, [category]);

  const fetchWorkersData = async () => {
    setLoading(true);
    const apiWorkers = await apiService.getWorkers();
    if (apiWorkers && Array.isArray(apiWorkers)) {
      setWorkers(apiWorkers);
    } else {
      setWorkers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkersData();
  }, []);

  const handleFetchUserGps = async () => {
    setLocatingGps(true);
    try {
      const coords = await getUserCurrentLocation({ enableHighAccuracy: true, timeout: 8000 });
      setUserGps({ lat: coords.lat, lng: coords.lng });
      setLocatingGps(false);
    } catch (err) {
      console.warn('GPS location error:', err.message);
      setLocatingGps(false);
      alert('Unable to fetch live GPS position. Please ensure location permissions are granted.');
    }
  };

  const displayCategories = useMemo(() => {
    if (user?.role === 'handyman' && user.trade) {
      const uTradeClean = user.trade.toLowerCase().trim();
      return categories.filter((c) => {
        const cNameClean = c.name.toLowerCase().trim();
        return !(cNameClean === uTradeClean || cNameClean.includes(uTradeClean) || uTradeClean.includes(cNameClean));
      });
    }
    return categories;
  }, [user]);

  const locations = useMemo(() => {
    const locSet = new Set(workers.map((w) => w.location).filter(Boolean));
    const sivagangaiTowns = [
      'Sivagangai Town',
      'Karaikudi',
      'Devakottai',
      'Manamadurai',
      'Kalayarkoil',
      'Tiruppattur',
      'Singampunari',
      'Ilayangudi',
      'Thirupuvanam',
    ];
    sivagangaiTowns.forEach((town) => locSet.add(town));
    return ['all', ...Array.from(locSet)];
  }, [workers]);

  const filteredWorkers = useMemo(() => {
    let centerLat = 9.8433;
    let centerLng = 78.4809;

    if (userGps) {
      centerLat = userGps.lat;
      centerLng = userGps.lng;
    } else if (location && location !== 'all') {
      const cityCoords = getCityBase(location);
      if (cityCoords) {
        centerLat = cityCoords[0];
        centerLng = cityCoords[1];
      }
    }

    let result = workers
      .map((w, idx) => {
        const dist = getWorkerDistance(w, centerLat, centerLng, idx);
        return { ...w, distance: dist };
      })
      .filter((w) => {
        // WORKER PRIVACY & SAME-TRADE POLICY:
        // A worker user should never see themselves, nor other workers in their OWN trade!
        if (user?.role === 'handyman') {
          const isSelf = (w._id && (w._id === user._id || w._id === user.id)) ||
                         (w.id && (w.id === user._id || w.id === user.id)) ||
                         (w.phone && user.phone && String(w.phone).replace(/\D/g, '') === String(user.phone).replace(/\D/g, ''));
          if (isSelf) return false;

          if (user.trade && w.trade) {
            const wTrade = String(w.trade).toLowerCase().trim();
            const uTrade = String(user.trade).toLowerCase().trim();
            if (wTrade === uTrade || wTrade.includes(uTrade) || uTrade.includes(wTrade)) {
              return false;
            }
          }
        }

        const catLower = (category || '').toLowerCase();
        const matchesCategory =
          category === 'all' ||
          !category ||
          (w.trade && typeof w.trade === 'string' && (w.trade.toLowerCase().includes(catLower) || catLower.includes(w.trade.toLowerCase()))) ||
          (Array.isArray(w.subServices) && w.subServices.some((s) => typeof s === 'string' && (s.toLowerCase().includes(catLower) || catLower.includes(s.toLowerCase()))));

        const matchesQuery =
          !query ||
          (typeof w.name === 'string' && w.name.toLowerCase().includes(query.toLowerCase())) ||
          (typeof w.trade === 'string' && w.trade.toLowerCase().includes(query.toLowerCase())) ||
          (typeof w.location === 'string' && w.location.toLowerCase().includes(query.toLowerCase())) ||
          (Array.isArray(w.subServices) && w.subServices.some((s) => typeof s === 'string' && s.toLowerCase().includes(query.toLowerCase())));

        const matchesLocation =
          location === 'all' ||
          (typeof w.location === 'string' &&
            (w.location.toLowerCase().includes(location.toLowerCase()) ||
              location.toLowerCase().includes(w.location.toLowerCase())));

        // Proximity Rule: <= 5.0 km when within5km toggle active
        const matchesProximity = within5km ? w.distance <= 5.0 : true;

        const isOnline = w.isAvailable !== false && w.isOnline !== false;
        const matchesOnline = !onlineOnly || isOnline;

        const matchesSubService =
          selectedSubService === 'all' ||
          !selectedSubService ||
          (Array.isArray(w.subServices) && w.subServices.some((s) => typeof s === 'string' && s.toLowerCase() === selectedSubService.toLowerCase()));

        return matchesCategory && matchesQuery && matchesLocation && matchesProximity && matchesOnline && matchesSubService;
      });

    if (userGps || within5km) {
      result.sort((a, b) => a.distance - b.distance);
    }

    return result;
  }, [workers, category, query, location, within5km, onlineOnly, userGps, user, selectedSubService]);

  const handleCategoryChange = (id) => {
    setCategory(id);
    setSelectedSubService('all');
    setSearchParams(id === 'all' ? {} : { category: id });
  };

  const handleReset = () => {
    setCategory('all');
    setQuery('');
    setLocation('all');
    setWithin5km(false);
    setOnlineOnly(false);
    setSelectedSubService('all');
    setUserGps(null);
    setSearchParams({});
  };


  return (
    <div className="browse-page container py-4 animate__animated animate__fadeIn">
      {/* Header Banner */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="fw-extrabold text-dark display-6 mb-1">{t('all_experts')}</h1>
          <p className="text-secondary mb-0">{t('hero_subtitle')}</p>
        </div>

        {/* View Mode Toggle */}
        <div className="btn-group p-1 bg-light rounded-3 shadow-xs border" role="group">
          <button
            type="button"
            className={`btn btn-sm fw-bold rounded-2 d-flex align-items-center gap-1 ${viewMode === 'grid' ? 'btn-white shadow-sm text-primary' : 'btn-light text-secondary'}`}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid size={16} /> Grid
          </button>
          <button
            type="button"
            className={`btn btn-sm fw-bold rounded-2 d-flex align-items-center gap-1 ${viewMode === 'split' ? 'btn-white shadow-sm text-primary' : 'btn-light text-secondary'}`}
            onClick={() => setViewMode('split')}
          >
            <Sparkles size={16} /> Split View
          </button>
          <button
            type="button"
            className={`btn btn-sm fw-bold rounded-2 d-flex align-items-center gap-1 ${viewMode === 'map' ? 'btn-white shadow-sm text-primary' : 'btn-light text-secondary'}`}
            onClick={() => setViewMode('map')}
          >
            <Map size={16} /> Full Map
          </button>
        </div>
      </div>

      {user?.role === 'handyman' && (
        <div className="alert alert-info border-0 shadow-xs rounded-4 p-3 mb-4 d-flex align-items-center gap-3" style={{ background: '#e0f2fe', color: '#0369a1' }}>
          <Info size={22} className="flex-shrink-0" />
          <div>
            <strong className="d-block">👨‍🔧 Worker Home Service Mode Active</strong>
            <small>You are viewing service specialists for your home. Your profile and other <strong>{user.trade}</strong> technicians are hidden from your list.</small>
          </div>
        </div>
      )}

      {/* Fixed Category Bar (5 for workers, 6 for customers) */}
      <div className={`row row-cols-2 row-cols-md-3 row-cols-lg-${displayCategories.length} g-2 mb-4`}>
        {displayCategories.map((c) => {
          const isSelected = category.toLowerCase() === c.name.toLowerCase();
          return (
            <div className="col" key={c.id}>
              <button
                type="button"
                className={`btn w-100 fw-bold rounded-3 py-2 px-2 text-truncate text-center d-flex align-items-center justify-content-center gap-1 shadow-xs border ${
                  isSelected ? 'btn-primary text-white shadow-sm' : 'btn-white text-dark bg-white'
                }`}
                onClick={() => handleCategoryChange(isSelected ? 'all' : c.name)}
                title={c.name}
              >
                <span>{c.icon}</span>
                <span className="text-truncate">{c.name}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Sub-service filter chips — only shown when a specific category is selected */}
      {activeCategorySubServices.length > 0 && (
        <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
          <span className="text-muted small fw-semibold me-1"><Wrench size={13} className="me-1" />Sub-service:</span>
          <button
            type="button"
            className={`btn btn-sm rounded-pill fw-semibold ${
              selectedSubService === 'all' ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={() => setSelectedSubService('all')}
          >
            All
          </button>
          {activeCategorySubServices.map((sub) => (
            <button
              key={sub}
              type="button"
              className={`btn btn-sm rounded-pill fw-semibold ${
                selectedSubService === sub ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => setSelectedSubService(selectedSubService === sub ? 'all' : sub)}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Bootstrap Filter Card */}
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
        <div className="row g-3 align-items-center">
          {/* Search Input */}
          <div className="col-12 col-lg-5">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <Search size={18} />
              </span>
              <input
                type="text"
                className="form-control bg-light border-start-0 py-2 shadow-none"
                placeholder="Search by handyman name or skill..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Location Select */}
          <div className="col-12 col-md-6 col-lg-3">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <MapPin size={16} />
              </span>
              <select
                className="form-select bg-light border-start-0 py-2 shadow-none"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="all">All Locations</option>
                {locations
                  .filter((loc) => loc !== 'all')
                  .map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* GPS Proximity & Online Toggles */}
          <div className="col-12 col-md-6 col-lg-4 d-flex gap-2 flex-wrap align-items-center justify-content-lg-end">
            <button
              type="button"
              className={`btn btn-sm fw-bold rounded-3 py-2 d-flex align-items-center gap-1 ${onlineOnly ? 'btn-success text-white shadow-xs' : 'btn-outline-success'}`}
              onClick={() => setOnlineOnly(!onlineOnly)}
            >
              🟢 {onlineOnly ? 'Online Only (Active)' : 'Online Handymen'}
            </button>

            <button
              type="button"
              className={`btn btn-sm fw-bold rounded-3 py-2 d-flex align-items-center gap-1 ${userGps ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={handleFetchUserGps}
              disabled={locatingGps}
            >
              <Navigation size={14} className={locatingGps ? 'animate-spin' : ''} />
              {locatingGps ? 'Locating...' : userGps ? 'GPS Active 📍' : 'Use Live GPS'}
            </button>

            <button
              type="button"
              className={`btn btn-sm fw-bold rounded-3 py-2 d-flex align-items-center gap-1 ${within5km ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setWithin5km(!within5km)}
            >
              <Navigation size={14} />
              {within5km ? '≤ 5 km Radial Active' : 'Within 5 km'}
            </button>


            <button
              type="button"
              className="btn btn-sm btn-light border fw-bold text-secondary rounded-3 py-2 d-flex align-items-center gap-1"
              onClick={handleReset}
            >
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-secondary small">
          Showing <strong className="text-dark fs-6">{filteredWorkers.length}</strong> verified handymen
        </span>
      </div>

      {/* Main Content Area */}
      {viewMode === 'split' ? (
        <div className="row g-4 mb-4">
          <div className="col-12 col-lg-7">
            <div className="sticky-top" style={{ top: '90px', zIndex: 10 }}>
              <HandymanMap workers={filteredWorkers} selectedLocation={location} />
            </div>
          </div>
          <div className="col-12 col-lg-5">
            <div className="d-flex flex-column gap-3" style={{ maxHeight: '720px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredWorkers.map((w, idx) => (
                <WorkerCard key={w._id || w.id} worker={w} index={idx} />
              ))}
            </div>
          </div>
        </div>
      ) : viewMode === 'map' ? (
        <HandymanMap workers={filteredWorkers} selectedLocation={location} />
      ) : loading ? (
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="col">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 skeleton-card"></div>
            </div>
          ))}
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="alert alert-light border shadow-sm rounded-4 p-5 text-center my-4">
          <Wrench size={54} className="text-muted mb-3 mx-auto" />
          <h4 className="fw-bold text-dark mb-2">No Verified Handymen Found</h4>
          <p className="text-secondary max-w-md mx-auto mb-3">
            Try adjusting your search query, category, or location filter. Service providers can register via the Partner App.
          </p>
          <button className="btn btn-primary fw-bold rounded-3 px-4 py-2" onClick={handleReset}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
          {filteredWorkers.map((w, idx) => (
            <div key={w._id || w.id} className="col">
              <WorkerCard worker={w} index={idx} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Browse;

