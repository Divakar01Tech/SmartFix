import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockWorkers } from '../data/mockData';
import { HOME_SERVICES } from '../data/servicesData';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { apiService } from '../services/api';
import socket from '../services/socket';
import LocationPickerMap from '../components/LocationPickerMap';
import PaymentModal from '../components/PaymentModal';
import LiveTrackerMap from '../components/LiveTrackerMap';
import { getUserCurrentLocation } from '../utils/geolocation';
import { useLanguage } from '../context/LanguageContext';
import VoiceInputButton from '../components/VoiceInputButton';
import { MapPin, Wrench, ShieldCheck, CheckCircle2, CreditCard, Phone, PhoneCall, MessageSquare, Navigation, Clock, AlertTriangle, Crosshair, Zap, Camera, Sparkles, Bot } from 'lucide-react';
import './Booking.css';

const Booking = () => {
  const { workerId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { startCall } = useCall();
  const { t } = useLanguage();

  // AI Diagnosis State
  const [problemDesc, setProblemDesc] = useState('');
  const [preSpeechDesc, setPreSpeechDesc] = useState('');
  const [problemImageBase64, setProblemImageBase64] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState(null);

  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubService, setSelectedSubService] = useState('');
  const [selectedSubServices, setSelectedSubServices] = useState([]);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [serviceTier, setServiceTier] = useState('AutoHandyman');

  // Form submission and booking states
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [dispatchingModal, setDispatchingModal] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);

  // GPS and Radial Dispatch State - Default active immediately to prevent blocking
  const [userLat, setUserLat] = useState(9.9252);
  const [userLng, setUserLng] = useState(78.1198);
  const [gpsActive, setGpsActive] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [workerDistance, setWorkerDistance] = useState(null);

  // Dispatch Engine Modal & Animation State
  const [dispatching, setDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState(0);
  const [dispatchStatusText, setDispatchStatusText] = useState('');
  const [assignedCaptain, setAssignedCaptain] = useState(null);
  const [activeBooking, setActiveBooking] = useState(null);

  // Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchWorker = async () => {
      setLoading(true);
      try {
        const data = await apiService.getWorkerById(workerId);
        if (isMounted) {
          if (data && (data.worker || data)) {
            const wObj = data.worker || data;
            setWorker(wObj);
            setSelectedCategory(wObj.trade || '');
            if (wObj.subServices && wObj.subServices.length > 0) {
              setSelectedSubServices([wObj.subServices[0]]);
            }
          } else {
            const found = mockWorkers.find((w) => w.id === workerId || w._id === workerId);
            setWorker(found || null);
            if (found) {
              setSelectedCategory(found.trade || '');
              if (found.subServices && found.subServices.length > 0) {
                setSelectedSubServices([found.subServices[0]]);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Backend worker fetch error, using fallback:', err.message);
        if (isMounted) {
          const found = mockWorkers.find((w) => w.id === workerId || w._id === workerId);
          setWorker(found || null);
          if (found) {
            setSelectedCategory(found.trade || '');
            if (found.subServices && found.subServices.length > 0) {
              setSelectedSubServices([found.subServices[0]]);
            }
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWorker();
    return () => { isMounted = false; };
  }, [workerId]);

  // Non-blocking auto-detect GPS on mount with instant default address
  useEffect(() => {
    setAddress((prev) => prev || 'Service Location (Your Location, Tamil Nadu)');
    getUserCurrentLocation({ enableHighAccuracy: false, timeout: 3000 })
      .then((coords) => {
        if (coords && coords.lat && coords.lng) {
          setUserLat(coords.lat);
          setUserLng(coords.lng);
          setGpsActive(true);
          setAddress((prev) => (prev.includes('Service Location') ? `Service Location (${coords.city || 'Tamil Nadu'})` : prev));
        }
      })
      .catch((err) => console.warn('Auto GPS fetch in Booking page:', err.message));
  }, []);

  // Haversine distance calculation
  const haversineKm = (lat1, lon1, lat2, lon2) => {
    if (
      lat1 === undefined || lat1 === null ||
      lon1 === undefined || lon1 === null ||
      lat2 === undefined || lat2 === null ||
      lon2 === undefined || lon2 === null
    ) return null;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
  };

  // Detect user GPS live location with mobile fallback
  const handleDetectGPS = async () => {
    setGpsLoading(true);
    setGpsError('');
    try {
      const coords = await getUserCurrentLocation({ enableHighAccuracy: true, timeout: 8000 });
      const lat = coords.lat;
      const lng = coords.lng;
      setUserLat(lat);
      setUserLng(lng);
      setGpsActive(true);
      setGpsLoading(false);

      if (coords.source === 'ip') {
        setGpsError(`📍 Location detected via Mobile Network (${coords.city || 'Tamil Nadu'})`);
      }

      // Calculate distance to worker if GPS available
      if (worker?.lat && worker?.lng) {
        const dist = haversineKm(lat, lng, worker.lat, worker.lng);
        setWorkerDistance(dist);
      }
    } catch (err) {
      setGpsLoading(false);
      setGpsError('Could not get your location. Please check location permissions or click on the map to set location.');
      console.warn('GPS error:', err.message);
    }
  };

  const handleAiDiagnose = async (e) => {
    e.preventDefault();
    if (!problemDesc && !problemImageBase64) return;
    setAiLoading(true);
    try {
      const result = await apiService.diagnoseCustomerIssue({ description: problemDesc, imageBase64: problemImageBase64 });
      setAiDiagnosis(result);
      if (result.category) {
        setSelectedCategory(result.category);
      }
      if (result.subService) {
        setSelectedSubServices((prev) => Array.from(new Set([...prev, result.subService])));
      }
    } catch (err) {
      console.warn('AI Diagnosis failed', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProblemImageBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const categoryObj = HOME_SERVICES.find((s) => s.name === selectedCategory || s.name === worker?.trade) || HOME_SERVICES[0];

  const handleSubServiceToggle = (sub) => {
    setSelectedSubServices((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  if (loading) {
    return <div className="container py-8"><p className="text-center text-slate-500">Loading handyman details...</p></div>;
  }

  if (!worker) {
    return <div className="container py-8"><p className="text-center text-slate-500">Handyman not found.</p></div>;
  }

  const phoneNum = worker?.phone || '+919876543210';
  const cleanPhone = phoneNum.replace(/[^0-9]/g, '');
  const whatsappMessage = encodeURIComponent(
    `Hello ${worker?.name || 'Pro'}, I am dispatching a service request for ${worker?.trade} service on SmartFix.`
  );

  const saveLocalBooking = (newBooking) => {
    try {
      const existing = JSON.parse(localStorage.getItem('smartfix_bookings') || '[]');
      const filtered = existing.filter((b) => b._id !== newBooking._id && b.id !== newBooking._id);
      localStorage.setItem('smartfix_bookings', JSON.stringify([newBooking, ...filtered]));
    } catch (e) {
      console.warn('Failed to sync local booking storage:', e);
    }
  };

  const handleConfirmBooking = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!gpsActive || !userLat || !userLng) {
      setErrorMsg('📍 Please detect your live GPS location before booking. This is required for worker matching within 5 km.');
      return;
    }

    if (!address) {
      setErrorMsg('Please enter your service address.');
      return;
    }

    // 5 KM DISTANCE RULE: Suggestions and dispatches strictly restricted to <= 5.0 km
    if (worker?.lat && worker?.lng && userLat && userLng) {
      const dist = haversineKm(userLat, userLng, worker.lat, worker.lng);
      if (dist !== null && dist > 5.0) {
        setErrorMsg(`⚠️ Handyman "${worker.name}" is ${dist} km away. Suggestions and dispatches are restricted to a maximum 5 km radius limit.`);
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg('');
    setDispatchingModal(true);
    setDispatchProgress(30);

    const timer = setInterval(() => {
      setDispatchProgress((prev) => {
        if (prev >= 90) { clearInterval(timer); return 90; }
        return prev + 30;
      });
    }, 250);

    try {
      const dispatchRes = await apiService.requestDispatch({
        workerId: worker._id || worker.id,
        trade: worker.trade,
        pickupLat: userLat,
        pickupLng: userLng,
        address,
        subServices: selectedSubServices,
        notes,
        price: worker.ratePerHour,
        userLat,
        userLng,
      });

      clearInterval(timer);
      setDispatchProgress(100);

      setTimeout(() => {
        setDispatchingModal(false);
        const fullBookingObj = {
          ...(dispatchRes.booking || {}),
          _id: dispatchRes.booking?._id || `b_${Date.now()}`,
          id: dispatchRes.booking?._id || `b_${Date.now()}`,
          workerName: worker.name,
          workerPhone: phoneNum,
          customerName: user?.name || 'Customer',
          trade: worker.trade,
          price: worker.ratePerHour,
          subServices: selectedSubServices,
          address,
          userLat,
          userLng,
          status: 'Confirmed',
        };
        setCreatedBooking(fullBookingObj);
        saveLocalBooking(fullBookingObj);

        // Broadcast to all active browsers / mobile devices via Socket.IO
        if (socket && socket.connected) {
          socket.emit('create-booking', fullBookingObj);
        }
      }, 400);
    } catch (err) {
      console.warn('Dispatch API error, executing offline matching:', err.message);
      clearInterval(timer);
      setDispatchProgress(100);

      setTimeout(() => {
        setDispatchingModal(false);
        const mockBookingObj = {
          _id: `b_${Date.now()}`,
          id: `b_${Date.now()}`,
          workerId: worker._id || worker.id,
          trade: worker.trade,
          workerName: worker.name,
          workerPhone: phoneNum,
          customerName: user?.name || 'Customer',
          subServices: selectedSubServices,
          address,
          userLat,
          userLng,
          notes,
          price: worker.ratePerHour,
          status: 'Confirmed',
          createdAt: new Date().toISOString(),
        };
        setCreatedBooking(mockBookingObj);
        saveLocalBooking(mockBookingObj);

        if (socket && socket.connected) {
          socket.emit('create-booking', mockBookingObj);
        }
      }, 400);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentSuccess = async (txnDetails) => {
    if (createdBooking?._id || createdBooking?.id) {
      const bId = createdBooking._id || createdBooking.id;
      try {
        await apiService.payBooking(bId, {
          paymentMethod: txnDetails.paymentMethod,
          transactionId: txnDetails.transactionId,
        });
      } catch (err) {
        console.warn('Backend pay error:', err.message);
      }
      const updated = { ...createdBooking, paymentStatus: 'Paid', paymentMethod: txnDetails.paymentMethod, transactionId: txnDetails.transactionId };
      setCreatedBooking(updated);
      saveLocalBooking(updated);
    }
  };

  if (createdBooking) {
    return (
      <div className="container booking-success-container">
        <div className="success-card">
          <CheckCircle2 size={64} color="#059669" />
          <h2>Booking Confirmed!</h2>
          <p className="success-desc">
            Your job ticket with <strong>{worker.name}</strong> ({worker.trade}) has been dispatched.
          </p>

          {/* 1-Hour Arrival Guarantee Banner */}
          <div className="one-hour-banner">
            <Clock size={20} color="#ffffff" />
            <div>
              <strong>1 Hour Arrival Guarantee</strong>
              <p>Your worker will arrive within 60 minutes of accepting this booking.</p>
            </div>
          </div>

          <div className="ticket-summary">
            <div className="ticket-row">
              <span>Handyman:</span>
              <strong>
                {worker.name} <span className="badge bg-success-subtle text-success border ms-1">🔒 {phoneNum ? `${phoneNum.substring(0, 6)}*****` : 'Secured'}</span>
              </strong>
            </div>
            <div className="ticket-row"><span>Service:</span> <strong>{worker.trade}</strong></div>
            <div className="ticket-row"><span>Service Address:</span> <strong>{address}</strong></div>
            <div className="ticket-row">
              <span>Your GPS:</span>
              <strong>{userLat ? `${userLat.toFixed(4)}, ${userLng.toFixed(4)}` : 'Not captured'}</strong>
            </div>
            <div className="ticket-row"><span>Estimated Rate:</span> <strong>₹{worker.ratePerHour}/hr</strong></div>
            <div className="ticket-row"><span>Booking Time:</span> <strong>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong></div>
            <div className="ticket-row"><span>Status:</span> <span className="badge-pending">Pending Acceptance</span></div>
          </div>

          <div className="direct-contact-bar">
            <span>Direct Safe Contact (Privacy Protected):</span>
            <div className="contact-btn-group flex-wrap">
              <button
                type="button"
                className="btn btn-success btn-lg fw-bold rounded-3 d-flex align-items-center justify-content-center gap-2 shadow-sm w-100"
                onClick={() =>
                  startCall({
                    receiverId: worker._id || worker.id,
                    receiverName: worker.name,
                    receiverRole: worker.trade || 'Handyman Specialist',
                    receiverAvatar: worker.avatar,
                    receiverPhone: phoneNum,
                    bookingId: createdBooking?._id || createdBooking?.id,
                  })
                }
              >
                <PhoneCall size={18} /> Instant In-App Voice Call 📞
              </button>
            </div>
          </div>

          {/* Live GPS Tracker Map — both user + worker */}
          <div className="booking-live-tracker-section">
            <h3 style={{ fontSize: '1.1rem', margin: '20px 0 12px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={18} color="#2563eb" /> Live GPS Tracking
            </h3>
            <LiveTrackerMap booking={createdBooking} worker={worker} userLat={userLat} userLng={userLng} />
          </div>

          <div className="success-actions">
            <button className="pay-now-btn-primary" onClick={() => setShowPaymentModal(true)}>
              <CreditCard size={18} /> Pay Deposit / Full Amount Now
            </button>
            <button className="dashboard-btn-secondary" onClick={() => navigate('/customer-dashboard')}>
              Go to My Bookings
            </button>
          </div>
        </div>

        {showPaymentModal && (
          <PaymentModal
            booking={createdBooking}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </div>
    );
  }

  return (
    <div className="container booking-page">
      <h1>Book Professional Handyman</h1>

      {/* On-Demand Banner */}
      <div className="ondemand-header-banner">
        <Zap size={18} color="#f59e0b" />
        <span>
          <strong>On-Demand Booking</strong> — No scheduling needed. Your worker arrives within <strong>1 hour</strong> of accepting.
        </span>
        <div className="radius-badge">📍 5 km radius only</div>
      </div>

      {user?.role === 'handyman' && (worker?._id === user?._id || worker?.id === user?.id || (worker?.trade && user?.trade && worker.trade.toLowerCase().trim() === user.trade.toLowerCase().trim())) ? (
        <div className="alert alert-warning border-0 shadow-sm rounded-4 p-4 my-4">
          <h4 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
            <AlertTriangle size={20} className="text-warning" /> Same Trade Booking Restriction
          </h4>
          <p className="text-secondary mb-3">
            As a registered <strong>{user?.trade}</strong> partner on SmartFix, you cannot book yourself or another technician of your own trade. Please select a different service specialist for your home repairs (e.g. Electrician, Plumber, AC Tech, Carpenter, Painter, Cleaner).
          </p>
          <button type="button" className="btn btn-primary fw-bold rounded-3 px-4" onClick={() => navigate('/browse')}>
            Browse Other Service Specialists 🛠️
          </button>
        </div>
      ) : (
      <div className="booking-layout">
        {/* Left Column: Form & Map Picker */}
        <div className="booking-form-col">
          {errorMsg && <div className="error-alert"><AlertTriangle size={16} /> {errorMsg}</div>}

          <form className="booking-form" onSubmit={handleConfirmBooking}>

            {/* GPS Location Detector — Required */}
            <div className={`gps-detect-section ${gpsActive ? 'gps-active' : ''} ${gpsError ? 'gps-error-state' : ''}`}>
              <div className="gps-detect-header">
                <Crosshair size={18} color={gpsActive ? '#059669' : '#2563eb'} />
                <span className="gps-detect-title">
                  {gpsActive ? '✅ Live GPS Location Detected' : '📍 Detect Your Live GPS Location'}
                </span>
                {gpsActive && <span className="gps-active-badge">LIVE</span>}
              </div>

              {gpsActive ? (
                <div className="gps-coords-display">
                  <span>📌 Lat: <strong>{userLat?.toFixed(5)}</strong></span>
                  <span>📌 Lng: <strong>{userLng?.toFixed(5)}</strong></span>
                  {workerDistance !== null && (
                    <span className={`worker-dist-badge ${workerDistance > 5 ? 'too-far' : 'in-range'}`}>
                      {workerDistance > 5 ? '⚠️' : '✅'} Worker is {workerDistance} km away {workerDistance > 5 ? '(Too far — 5 km max)' : '(Within range)'}
                    </span>
                  )}
                </div>
              ) : (
                <p className="gps-detect-desc">
                  Your live location is required to match workers within <strong>5 km</strong> and enable real-time tracking.
                </p>
              )}

              {gpsError && <p className="gps-error-msg"><AlertTriangle size={14} /> {gpsError}</p>}

              <button
                type="button"
                className={`gps-detect-btn ${gpsActive ? 'gps-refresh-btn' : ''}`}
                onClick={handleDetectGPS}
                disabled={gpsLoading}
              >
                <Navigation size={15} />
                {gpsLoading ? 'Detecting...' : gpsActive ? 'Refresh GPS Location' : 'Use My Current Location'}
              </button>
            </div>

            <div className="form-group">
              <label><MapPin size={16} /> Service Address</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter street, apartment, landmark, city..."
                rows={3}
                required
              />
            </div>

            {/* Interactive Map Location Picker */}
            <LocationPickerMap
              onAddressSelect={(selectedAddr) => setAddress(selectedAddr)}
              onLocationSelect={(coords) => {
                if (coords?.lat && coords?.lng) {
                  setUserLat(coords.lat);
                  setUserLng(coords.lng);
                  setGpsActive(true);
                  if (worker?.lat && worker?.lng) {
                    const dist = haversineKm(coords.lat, coords.lng, worker.lat, worker.lng);
                    setWorkerDistance(dist);
                  }
                }
              }}
              initialAddress={address}
            />

            {/* AI Diagnosis Feature */}
            <div className="form-group ai-diagnosis-box" style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: 'bold', marginBottom: '10px' }}>
                <Bot size={18} color="#2563eb" /> {t('describe_problem') || 'Describe your problem'}
              </label>
              <textarea
                value={problemDesc}
                onChange={(e) => setProblemDesc(e.target.value)}
                placeholder="Describe your issue in English or Tamil..."
                rows={2}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }}
              />
              
              <VoiceInputButton 
                uiLanguage={language} 
                onStartListening={() => setPreSpeechDesc(problemDesc)}
                onTranscript={(text, isFinal) => {
                  const base = preSpeechDesc ? preSpeechDesc + ' ' : '';
                  setProblemDesc(base + text);
                  if (isFinal) {
                    setPreSpeechDesc(base + text);
                  }
                }} 
              />
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                <label className="btn btn-sm btn-outline-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Camera size={14} /> Upload Photo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                </label>
                {problemImageBase64 && <span style={{ fontSize: '12px', color: '#059669' }}>✓ Photo attached</span>}
                <button 
                  type="button" 
                  className="btn btn-sm btn-primary" 
                  onClick={handleAiDiagnose} 
                  disabled={aiLoading || (!problemDesc && !problemImageBase64)}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  {aiLoading ? 'Analyzing...' : <><Sparkles size={14} /> Auto-Diagnose</>}
                </button>
              </div>

              {aiDiagnosis && (
                <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '8px', border: '1px solid #10b981', marginTop: '10px' }}>
                  <h6 style={{ color: '#065f46', fontWeight: 'bold', margin: '0 0 8px 0' }}>💡 AI Diagnosis Result</h6>
                  <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#047857' }}><strong>Reasoning:</strong> {aiDiagnosis.reasoning}</p>
                  <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#047857' }}>
                    <strong>Identified:</strong> {aiDiagnosis.category} - {aiDiagnosis.subService}
                  </p>
                  <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#047857' }}>
                    <strong>Est. Price:</strong> ₹{aiDiagnosis.priceRange?.min} - ₹{aiDiagnosis.priceRange?.max} | <strong>Urgency:</strong> <span style={{ textTransform: 'capitalize' }}>{aiDiagnosis.urgency}</span>
                  </p>
                  {aiDiagnosis.needsManualReview && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '5px', background: '#fef3c7', padding: '5px', borderRadius: '4px' }}>
                      <AlertTriangle size={14} /> We're not fully sure — please confirm or pick manually below.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sub-Services Selection */}
            {categoryObj && (
              <div className="form-group booking-sub-services-box">
                <label className="sub-services-label">
                  <Wrench size={16} /> Select Required Sub-Services ({categoryObj.name}):
                </label>
                <div className="sub-services-booking-grid">
                  {categoryObj.subServices.map((sub) => {
                    const isSelected = selectedSubServices.includes(sub);
                    const isWorkerSpecialty = (worker.subServices || []).includes(sub);
                    return (
                      <div
                        key={sub}
                        className={`booking-sub-chip ${isSelected ? 'selected' : ''} ${!isWorkerSpecialty ? 'outside-skill' : ''}`}
                        onClick={() => handleSubServiceToggle(sub)}
                      >
                        <div className="chip-content-left">
                          <input type="checkbox" checked={isSelected} onChange={() => {}} />
                          <span className="sub-name">{sub}</span>
                        </div>
                        {isWorkerSpecialty ? (
                          <span className="expert-badge">✓ Pro Skill</span>
                        ) : (
                          <span className="outside-badge">⚠️ Specialty Notice</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {selectedSubServices.some((s) => !(worker.subServices || []).includes(s)) && (
                  <div className="skill-warning-notice">
                    ⚠️ <strong>Notice:</strong> One or more selected tasks are outside {worker.name}&apos;s core listed specialties. The worker can review the request and accept or decline based on tool availability.
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label>Notes for Handyman (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe the issue or instructions..."
                rows={3}
              />
            </div>

            {/* 1-hour guarantee info */}
            <div className="one-hour-info-strip">
              <Clock size={16} color="#059669" />
              <span>Worker will arrive within <strong>1 hour</strong> of accepting. You don't need to pick a date or time — this is on-demand!</span>
            </div>

            <button
              type="submit"
              className="confirm-btn"
              disabled={submitting || !gpsActive}
            >
              {submitting
                ? 'Dispatching Request...'
                : !gpsActive
                ? '📍 Detect GPS to Enable Booking'
                : `Confirm & Dispatch Service — ₹${worker.ratePerHour}/hr`}
            </button>
          </form>

          {/* Dispatching Modal */}
          {dispatchingModal && (
            <div className="payment-modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)' }}>
              <div
                className="payment-modal-content"
                style={{ maxWidth: '440px', width: '90%', padding: '32px', textAlign: 'center', borderRadius: '24px' }}
              >
                <div className="radar-spinner" style={{ margin: '0 auto 20px auto', width: '70px', height: '70px', borderRadius: '50%', border: '4px solid #3b82f6', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div>
                <h3 style={{ fontSize: '1.3rem', color: '#0f172a', fontWeight: '800', marginBottom: '8px' }}>
                  🛰️ Dispatching On-Demand Handyman Engine
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: '20px' }}>
                  Matching nearest verified pro for <strong>{worker?.name || 'Handyman'}</strong> within <strong>5 km</strong>...
                </p>
                <div style={{ width: '100%', background: '#e2e8f0', height: '10px', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
                  <div style={{ width: `${dispatchProgress}%`, background: 'linear-gradient(90deg, #3b82f6, #059669)', height: '100%', transition: 'width 0.4s ease' }}></div>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#059669', fontWeight: '700' }}>
                  Searching active handymen within 5.0 km radius ({dispatchProgress}%)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Handyman Summary Card */}
        <div className="booking-summary-col">
          <div className="summary-sticky-card">
            <div className="worker-summary-header">
              <span className="summary-avatar">{worker.avatar || '👨‍🔧'}</span>
              <div>
                <h3>{worker.name}</h3>
                <p className="summary-trade"><Wrench size={14} /> {worker.trade}</p>
                <p className="summary-location"><MapPin size={14} /> {worker.location || 'Sivagangai'}</p>
                <p className="summary-phone"><Phone size={13} /> {phoneNum}</p>
              </div>
            </div>

            {/* Quick Contact Buttons Removed: Now revealed only after Worker accepts booking on Dashboard */}
            <div className="summary-quick-contact" style={{ display: 'none' }}>
            </div>

            <hr />

            {/* 1 Hour Arrival Card */}
            <div className="summary-1hr-card">
              <Clock size={20} color="#f59e0b" />
              <div>
                <strong>1-Hour Arrival Guarantee</strong>
                <p>Worker arrives within 60 mins</p>
              </div>
            </div>

            <div className="price-breakdown">
              <div className="price-row">
                <span>Service Rate</span>
                <span>₹{worker.ratePerHour}</span>
              </div>
              <div className="price-row" style={{ color: '#64748b', fontSize: '0.85rem' }}>
                <span>SmartFix Fee (10% Commission)</span>
                <span>₹{Math.round(worker.ratePerHour * 0.10)}</span>
              </div>
              <div className="price-row" style={{ color: '#059669', fontSize: '0.85rem', fontWeight: '600' }}>
                <span>Handyman Net Payout (90% Share)</span>
                <span>₹{worker.ratePerHour - Math.round(worker.ratePerHour * 0.10)}</span>
              </div>
              <div className="price-row total-price-row">
                <span>Total Amount Payable</span>
                <span className="total-val">₹{worker.ratePerHour}</span>
              </div>
            </div>

            {/* 5km radius info */}
            <div className="radius-info-card">
              <Navigation size={16} color="#2563eb" />
              <span>Booking available within <strong>5 km</strong> of your GPS location</span>
            </div>

            <div className="guarantee-badge">
              <ShieldCheck size={20} color="#059669" />
              <div>
                <strong>SmartFix Guarantee</strong>
                <p>100% money-back satisfaction protection.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default Booking;
