import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import LocationPickerMap from '../components/LocationPickerMap';
import NearbyWorkers from '../components/NearbyWorkers';
import { Wrench, MapPin, Calendar, Clock, AlertCircle, CheckCircle2, ShieldCheck, ArrowLeft, Send } from 'lucide-react';

export default function BookingForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const queryCategory = searchParams.get('category') || '';
  const querySubService = searchParams.get('subService') || '';

  // Catalog State
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);

  // Form Fields
  const [selectedCategory, setSelectedCategory] = useState(queryCategory);
  const [selectedSubService, setSelectedSubService] = useState(querySubService);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: 9.8433, lng: 78.4809 }); // Default Tamil Nadu (Sivagangai center)

  // Scheduling
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('Immediate (within 1 hour)');

  // Submission & State Machine
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [geoError, setGeoError] = useState('');

  // Load Categories from Database
  useEffect(() => {
    const loadCategories = async () => {
      setCatLoading(true);
      try {
        const list = await apiService.getCategories();
        setCategories(list || []);
        if (!selectedCategory && list && list.length > 0) {
          setSelectedCategory(list[0].name);
        }
      } catch (err) {
        console.warn('Failed to load categories:', err.message);
      } finally {
        setCatLoading(false);
      }
    };
    loadCategories();
  }, []);

  // Update selected subservice if category changes
  const activeCategoryObj = categories.find((c) => c.name === selectedCategory);
  const availableSubServices = activeCategoryObj?.subServices || [];

  const handleLocationPicked = (coords) => {
    if (coords?.lat && coords?.lng) {
      setCoordinates({ lat: coords.lat, lng: coords.lng });
      setGeoError('');
    }
  };

  const handleAddressPicked = (addr) => {
    if (addr) {
      setAddress(addr);
      setGeoError('');
    }
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setGeoError('');

    if (!selectedCategory) {
      setErrorMessage(t('select_category_err', 'Please select a service category.'));
      return;
    }
    if (!address.trim()) {
      setErrorMessage(t('enter_address_err', 'Please pin your doorstep location on the map or enter your address.'));
      return;
    }

    setSubmitting(true);

    try {
      const bookingData = {
        category: selectedCategory,
        trade: selectedCategory,
        subService: selectedSubService || (availableSubServices[0]?.name || availableSubServices[0] || selectedCategory),
        description: description.trim() || `${selectedCategory} service request`,
        address: address.trim(),
        state: 'Tamil Nadu',
        pickupLat: coordinates.lat,
        pickupLng: coordinates.lng,
        userLat: coordinates.lat,
        userLng: coordinates.lng,
        location: {
          type: 'Point',
          coordinates: [coordinates.lng, coordinates.lat],
        },
        scheduledDate,
        scheduledTime,
      };

      const createdBooking = await apiService.createBooking(bookingData);
      const bookingId = createdBooking._id || createdBooking.id;

      // Navigate to Booking Status / Timeline Journey page
      navigate(`/booking/${bookingId}/status`);
    } catch (err) {
      // Check for Tamil Nadu geographic boundary rejection
      const msg = err.message || '';
      if (
        msg.toLowerCase().includes('tamil nadu') ||
        msg.toLowerCase().includes('outside') ||
        msg.toLowerCase().includes('geocod')
      ) {
        setGeoError(msg);
      } else {
        setErrorMessage(msg || t('booking_create_failed', 'Unable to create booking. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: '960px', minHeight: '80vh' }}>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <Link to="/services" className="text-decoration-none text-muted small d-inline-flex align-items-center gap-1 mb-1">
            <ArrowLeft size={16} />
            <span>{t('back_to_services', 'Back to Service Catalog')}</span>
          </Link>
          <h1 className="h3 fw-bold text-dark mb-0">
            {t('book_home_service', 'Schedule On-Demand Service')}
          </h1>
          <p className="text-muted small mb-0">
            {t('step3_desc', 'Step 3 of 8: Confirm service location & dispatch certified nearby worker')}
          </p>
        </div>
        <div className="d-none d-md-block text-end">
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill">
            <ShieldCheck size={16} className="me-1 inline-block" />
            {t('tn_service_zone', 'Tamil Nadu Zone Protected')}
          </span>
        </div>
      </div>

      {/* Tamil Nadu Geocoding Error Banner */}
      {geoError && (
        <div className="alert alert-danger shadow-sm border-danger rounded-3 d-flex align-items-start gap-3 p-3 mb-4" role="alert">
          <AlertCircle size={24} className="text-danger flex-shrink-0 mt-1" />
          <div>
            <h5 className="alert-heading fw-bold mb-1">
              {t('outside_tn_title', 'Geographic Boundary Error')}
            </h5>
            <p className="mb-1 small">{geoError}</p>
            <p className="mb-0 small text-muted">
              {t('tn_restriction_note', 'SmartFix operates exclusively inside Tamil Nadu state districts (e.g. Sivagangai, Madurai, Chennai). Please pin a location inside Tamil Nadu.')}
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-warning py-2 px-3 small d-flex align-items-center gap-2 mb-4">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmitBooking}>
        <div className="row g-4">
          {/* Left Column: Form Details */}
          <div className="col-12 col-lg-7">
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
              <h2 className="h5 fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                <Wrench size={20} className="text-primary" />
                <span>{t('service_details_header', '1. Select Category & Service')}</span>
              </h2>

              {/* Service Category */}
              <div className="mb-3">
                <label className="form-label small fw-semibold text-muted">
                  {t('select_category_label', 'Service Trade')}
                </label>
                {catLoading ? (
                  <div className="text-muted small">{t('loading_categories', 'Loading trade categories...')}</div>
                ) : (
                  <select
                    className="form-select"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedSubService('');
                    }}
                    required
                  >
                    <option value="">-- {t('select_trade', 'Select Trade')} --</option>
                    {categories.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Sub Service from DB */}
              {availableSubServices.length > 0 && (
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">
                    {t('sub_service_label', 'Specific Sub-Service')}
                  </label>
                  <select
                    className="form-select"
                    value={selectedSubService}
                    onChange={(e) => setSelectedSubService(e.target.value)}
                  >
                    <option value="">{t('general_repair_option', 'General Inspection & Repair')}</option>
                    {availableSubServices.map((sub, idx) => {
                      const subName = typeof sub === 'string' ? sub : sub.name || '';
                      return (
                        <option key={idx} value={subName}>
                          {subName}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Issue Description */}
              <div className="mb-3">
                <label className="form-label small fw-semibold text-muted">
                  {t('issue_description_label', 'Describe the Problem / Symptoms')}
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder={t(
                    'issue_desc_ph',
                    'E.g. Main tap dripping continuously, water leakage near sink valve, please bring pipe sealant.'
                  )}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Scheduling */}
              <div className="row g-2 mb-2">
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-semibold text-muted">
                    {t('booking_date_label', 'Service Date')}
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={scheduledDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    required
                  />
                </div>
                <div className="col-12 col-sm-6">
                  <label className="form-label small fw-semibold text-muted">
                    {t('booking_time_label', 'Preferred Arrival Slot')}
                  </label>
                  <select
                    className="form-select"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  >
                    <option value="Immediate (within 1 hour)">Immediate (1-Hour Arrival Guarantee)</option>
                    <option value="09:00 AM - 12:00 PM">Morning (09:00 AM - 12:00 PM)</option>
                    <option value="12:00 PM - 03:00 PM">Afternoon (12:00 PM - 03:00 PM)</option>
                    <option value="03:00 PM - 06:00 PM">Evening (03:00 PM - 06:00 PM)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Live Map Location & Doorstep Pinning (Replaces District/Taluk/City) */}
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h2 className="h5 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <MapPin size={20} className="text-primary" />
                  <span>{t('service_location_header', '2. Live Doorstep Location (Map & GPS)')}</span>
                </h2>
                <span className="badge bg-success-subtle text-success small px-2 py-1 rounded-pill">
                  Live GPS Navigation
                </span>
              </div>
              <p className="text-muted small mb-3">
                {t(
                  'live_spot_helper',
                  'Pin your exact location on the map below. The worker will use this live spot for direct Google Maps doorstep navigation (district, taluk & city are auto-detected).'
                )}
              </p>

              {/* Interactive Live Spot Map */}
              <div className="border rounded-4 overflow-hidden mb-3 shadow-xs">
                <LocationPickerMap
                  onLocationSelect={handleLocationPicked}
                  onAddressSelect={handleAddressPicked}
                  initialAddress={address}
                />
              </div>

              {/* Coordinates & Doorstep / Landmark Address Input */}
              <div className="p-3 bg-light rounded-3 border mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small fw-bold text-dark">📍 Doorstep Spot Coordinates:</span>
                  <span className="badge bg-primary font-monospace px-2 py-1">
                    {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
                  </span>
                </div>

                <label className="form-label small fw-semibold text-muted mb-1">
                  {t('detailed_address_label', 'House / Flat / Street / Landmark Details')}
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t(
                    'address_placeholder',
                    'E.g. Flat 4B, Kaveri Street, Opp. Main Bus Stand'
                  )}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
                <span className="form-text small text-muted">
                  {t(
                    'address_helper',
                    'Provide any specific apartment, gate, or landmark instructions to help the worker reach your spot effortlessly.'
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary, Anonymous Nearby Workers & Submit */}
          <div className="col-12 col-lg-5">
            {/* Anonymous Nearby Workers Widget */}
            <div className="mb-4">
              <NearbyWorkers
                lat={coordinates.lat}
                lng={coordinates.lng}
                category={selectedCategory}
              />
            </div>

            {/* Quick Summary Card */}
            <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white border">
              <h3 className="h6 fw-bold text-dark mb-3">📋 Booking Dispatch Summary</h3>
              <div className="d-flex justify-content-between small text-muted mb-2">
                <span>Selected Trade:</span>
                <span className="fw-semibold text-dark">{selectedCategory || 'Not Selected'}</span>
              </div>
              <div className="d-flex justify-content-between small text-muted mb-2">
                <span>Arrival Guarantee:</span>
                <span className="fw-semibold text-success">Within 60 Minutes ⏱️</span>
              </div>
              <div className="d-flex justify-content-between small text-muted mb-2">
                <span>Live Spot Pinned:</span>
                <span className="fw-semibold text-primary font-monospace">
                  {coordinates.lat.toFixed(3)}, {coordinates.lng.toFixed(3)}
                </span>
              </div>
              <div className="d-flex justify-content-between small text-muted mb-3">
                <span>Privacy Shield:</span>
                <span className="badge bg-info-subtle text-info-emphasis">Worker revealed upon acceptance</span>
              </div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between align-items-center pt-1">
                <span className="fw-bold text-dark">Estimated Service Rate:</span>
                <span className="h5 fw-bold text-primary mb-0">₹350 - ₹500</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary w-100 py-3 rounded-4 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" />
                  <span>{t('dispatching_worker', 'Validating Address & Dispatching...')}</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>{t('confirm_and_book', 'Confirm Booking (Dispatch Pro)')}</span>
                </>
              )}
            </button>
            <p className="text-center text-muted small mt-2 mb-0" style={{ fontSize: '0.8rem' }}>
              {t('booking_terms_privacy', 'Status will start as "Pending". Free cancellation before technician is En Route.')}
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
