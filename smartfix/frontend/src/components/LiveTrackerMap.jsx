import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker as GoogleMarker, Polyline as GooglePolyline } from '@react-google-maps/api';
import {
  MapContainer,
  TileLayer,
  Marker as LeafletMarker,
  Popup as LeafletPopup,
  Polyline as LeafletPolyline,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import {
  Phone,
  MessageSquare,
  Navigation,
  ShieldCheck,
  Clock,
  MapPin,
  Wifi,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Crosshair,
  Compass
} from 'lucide-react';
import { calculateDistance } from '../utils/distance';
import socket from '../services/socket';
import './LiveTrackerMap.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const hasGoogleKey = GOOGLE_MAPS_API_KEY && !GOOGLE_MAPS_API_KEY.includes('REPLACE');

const MAP_STYLES = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
];

/**
 * Calculate geographical bearing angle (0° to 360°) between two coordinates
 */
const calculateBearing = (lat1, lon1, lat2, lon2) => {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

  let brng = toDeg(Math.atan2(y, x));
  return Math.round((brng + 360) % 360);
};

/**
 * Web Audio API synthesized arrival chime (zero external audio file dependency)
 */
const playArrivalChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    // Upbeat 3-tone chime (like Rapido / Red Taxi arrival tone)
    playTone(523.25, now, 0.14); // C5
    playTone(659.25, now + 0.14, 0.14); // E5
    playTone(783.99, now + 0.28, 0.24); // G5
  } catch (e) {
    // Audio context may be restricted before user gesture
  }
};

/**
 * Leaflet Dynamic Vehicle Marker Icon (with heading rotation and radar wave)
 */
const createVehicleMarkerIcon = (heading = 0, speed = 0, vehicleType = '🛵') => {
  return L.divIcon({
    className: 'live-marker rapido-vehicle-marker',
    html: `
      <div class="rapido-marker-container">
        <div class="rapido-radar-wave"></div>
        <div class="rapido-vehicle-icon" style="transform: rotate(${heading}deg);">
          <div class="vehicle-emoji">${vehicleType}</div>
        </div>
        ${speed > 0 ? `<div class="rapido-speed-pill">${Math.round(speed)} km/h</div>` : ''}
      </div>
    `,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  });
};

/**
 * Leaflet Customer Home Marker Icon
 */
const customerHomeMarkerIcon = L.divIcon({
  className: 'live-marker rapido-home-marker',
  html: `
    <div class="rapido-home-container">
      <div class="home-radar-wave"></div>
      <div class="home-icon-circle">🏠</div>
      <div class="home-label-pill">Delivery Point</div>
    </div>
  `,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
});

/**
 * Leaflet custom zoom buttons
 */
function LeafletCustomZoomControls() {
  const map = useMap();
  return (
    <div className="custom-map-zoom-buttons">
      <button type="button" className="zoom-btn zoom-in" onClick={() => map.zoomIn()} title="Zoom In (+)">
        +
      </button>
      <button type="button" className="zoom-btn zoom-out" onClick={() => map.zoomOut()} title="Zoom Out (−)">
        −
      </button>
    </div>
  );
}

/**
 * Leaflet Map Controller for focus and bounds
 */
function LeafletMapController({ workerPos, customerPos, focusTarget }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !workerPos || !customerPos) return;

    if (focusTarget === 'worker') {
      map.flyTo([workerPos.lat, workerPos.lng], 16, { animate: true, duration: 0.8 });
    } else if (focusTarget === 'customer') {
      map.flyTo([customerPos.lat, customerPos.lng], 16, { animate: true, duration: 0.8 });
    } else if (focusTarget === 'both') {
      const bounds = L.latLngBounds([
        [workerPos.lat, workerPos.lng],
        [customerPos.lat, customerPos.lng],
      ]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  }, [focusTarget, workerPos?.lat, workerPos?.lng, customerPos?.lat, customerPos?.lng, map]);

  return null;
}

const LiveTrackerMap = ({
  booking,
  worker,
  userLat: initialUserLat,
  userLng: initialUserLng,
  slaDeadline: slaDeadlineProp,
}) => {
  const workerName = worker?.name || booking?.workerName || 'Muthu';
  const workerTrade = worker?.trade || booking?.trade || 'Electrician';
  const phoneNum = worker?.phone || booking?.workerPhone || '+919876543210';
  const cleanPhone = phoneNum.replace(/[^0-9]/g, '');
  const bookingId = booking?._id || booking?.id;
  const bookingOtp = String(bookingId || '4092').slice(-4);

  // Default coordinate center (Sivagangai area)
  const defaultLat = initialUserLat || 9.8433;
  const defaultLng = initialUserLng || 78.4809;

  const [customerPos, setCustomerPos] = useState({ lat: defaultLat, lng: defaultLng });
  const [userGpsActive, setUserGpsActive] = useState(!!initialUserLat);

  // Worker position and heading state
  const [workerPos, setWorkerPos] = useState({
    lat: defaultLat + 0.012,
    lng: defaultLng + 0.015,
  });
  const [workerHeading, setWorkerHeading] = useState(45);
  const [workerSpeed, setWorkerSpeed] = useState(28);
  const [workerGpsFromBackend, setWorkerGpsFromBackend] = useState(false);
  const [socketActive, setSocketActive] = useState(false);
  const [lastWorkerUpdate, setLastWorkerUpdate] = useState(null);

  // Road Routing state (OSRM road geometry)
  const [roadRoute, setRoadRoute] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeDistanceKm, setRouteDistanceKm] = useState(null);
  const [routeDurationMins, setRouteDurationMins] = useState(null);

  // Map Controls State
  const [mapType, setMapType] = useState('roadmap'); // roadmap | satellite | hybrid | terrain
  const [focusTarget, setFocusTarget] = useState('both'); // both | worker | customer

  // Rapido Simulation Mode (Turn-by-turn road drive)
  const [simulating, setSimulating] = useState(false);
  const simStepRef = useRef(0);
  const simIntervalRef = useRef(null);

  // Arrival state
  const [hasArrived, setHasArrived] = useState(false);
  const chimePlayedRef = useRef(false);

  // SLA countdown state
  const [slaDeadline] = useState(() => slaDeadlineProp || booking?.slaDeadline || null);
  const [slaTimeRemainingMs, setSlaTimeRemainingMs] = useState(null);
  const [slaWarningActive, setSlaWarningActive] = useState(false);

  // Ticker for SLA
  useEffect(() => {
    const tick = () => {
      if (slaDeadline) {
        setSlaTimeRemainingMs(Math.max(0, new Date(slaDeadline).getTime() - Date.now()));
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [slaDeadline]);

  // Google Maps SDK loader
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: hasGoogleKey ? GOOGLE_MAPS_API_KEY : '',
    id: 'google-map-script',
  });

  // =========================================================================
  // 1. Fetch Real Road Geometry via OSRM (Turn-by-Turn Road Snapping)
  // =========================================================================
  const fetchRoadGeometry = useCallback(async (start, end) => {
    if (!start || !end) return;
    setLoadingRoute(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('OSRM routing network error');
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        setRoadRoute(coords);
        setRouteDistanceKm((data.routes[0].distance / 1000).toFixed(1));
        setRouteDurationMins(Math.max(1, Math.ceil(data.routes[0].duration / 60)));
      }
    } catch (err) {
      console.warn('OSRM routing fallback:', err.message);
      // Fallback straight line
      setRoadRoute([
        [start.lat, start.lng],
        [end.lat, end.lng],
      ]);
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  // Fetch initial route when positions are established
  useEffect(() => {
    fetchRoadGeometry(workerPos, customerPos);
  }, []); // Run on initial mount

  // =========================================================================
  // 2. Real-Time Socket.IO Worker Location Listener
  // =========================================================================
  useEffect(() => {
    if (!bookingId) return;

    socket.emit('join-booking-room', { bookingId });

    const handleWorkerLocation = (data) => {
      if (data && data.latitude && data.longitude) {
        const newLat = Number(data.latitude);
        const newLng = Number(data.longitude);
        const newHeading =
          data.heading !== undefined
            ? Number(data.heading)
            : calculateBearing(workerPos.lat, workerPos.lng, newLat, newLng);

        setWorkerHeading(newHeading || 0);
        setWorkerPos({ lat: newLat, lng: newLng });
        if (data.speed !== undefined) setWorkerSpeed(Math.round(data.speed));
        setWorkerGpsFromBackend(true);
        setSocketActive(true);
        setLastWorkerUpdate(new Date(data.timestamp || Date.now()));
      }
    };

    const handleSlaWarning = (data) => {
      if (data.bookingId === bookingId) {
        setSlaWarningActive(true);
      }
    };

    socket.on('worker-location', handleWorkerLocation);
    socket.on('worker:location-update', handleWorkerLocation);
    socket.on('sla-warning', handleSlaWarning);

    return () => {
      socket.emit('leave-booking', bookingId);
      socket.off('worker-location', handleWorkerLocation);
      socket.off('worker:location-update', handleWorkerLocation);
      socket.off('sla-warning', handleSlaWarning);
    };
  }, [bookingId, workerPos.lat, workerPos.lng]);

  // =========================================================================
  // 3. Continuous Customer GPS via watchPosition
  // =========================================================================
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCustomerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUserGpsActive(true);
      },
      (err) => {
        console.warn('Customer GPS watch error:', err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Distance calculation
  const liveDistance = calculateDistance(customerPos.lat, customerPos.lng, workerPos.lat, workerPos.lng);
  const finalDistanceKm = routeDistanceKm || liveDistance;
  const finalEstimatedMins =
    routeDurationMins !== null ? routeDurationMins : Math.max(2, Math.round(Number(finalDistanceKm) * 3));

  // Check arrival threshold (< 60 meters)
  useEffect(() => {
    if (liveDistance <= 0.06 && !hasArrived) {
      setHasArrived(true);
      if (!chimePlayedRef.current) {
        chimePlayedRef.current = true;
        playArrivalChime();
      }
    } else if (liveDistance > 0.08 && hasArrived) {
      setHasArrived(false);
      chimePlayedRef.current = false;
    }
  }, [liveDistance, hasArrived]);

  // =========================================================================
  // 4. Interactive Rapido Ride Simulator Mode (Turn-by-turn road animation)
  // =========================================================================
  const toggleSimulation = () => {
    if (simulating) {
      // Pause
      clearInterval(simIntervalRef.current);
      setSimulating(false);
    } else {
      // Start or resume
      if (roadRoute.length < 2) {
        fetchRoadGeometry(workerPos, customerPos);
      }
      setSimulating(true);
    }
  };

  const resetSimulation = () => {
    clearInterval(simIntervalRef.current);
    setSimulating(false);
    simStepRef.current = 0;
    const resetLat = customerPos.lat + 0.012;
    const resetLng = customerPos.lng + 0.015;
    setWorkerPos({ lat: resetLat, lng: resetLng });
    setWorkerHeading(45);
    setHasArrived(false);
    chimePlayedRef.current = false;
    fetchRoadGeometry({ lat: resetLat, lng: resetLng }, customerPos);
  };

  useEffect(() => {
    if (!simulating || roadRoute.length < 2) return;

    simIntervalRef.current = setInterval(() => {
      simStepRef.current += 1;
      if (simStepRef.current >= roadRoute.length) {
        // Reached destination
        clearInterval(simIntervalRef.current);
        setSimulating(false);
        setHasArrived(true);
        playArrivalChime();
        return;
      }

      const nextCoord = roadRoute[simStepRef.current];
      const prevCoord = roadRoute[simStepRef.current - 1];

      if (nextCoord && prevCoord) {
        const nextLat = nextCoord[0];
        const nextLng = nextCoord[1];
        const newHeading = calculateBearing(prevCoord[0], prevCoord[1], nextLat, nextLng);

        setWorkerPos({ lat: nextLat, lng: nextLng });
        setWorkerHeading(newHeading);
        setWorkerSpeed(32); // 32 km/h simulated ride speed

        // Broadcast over Socket.IO so other browser windows receive update
        if (socket && bookingId) {
          socket.emit('location-update', {
            bookingId,
            latitude: nextLat,
            longitude: nextLng,
            heading: newHeading,
            speed: 32,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }, 750); // Move every 750ms

    return () => clearInterval(simIntervalRef.current);
  }, [simulating, roadRoute, bookingId]);

  // Leaflet tile layer selector
  const renderLeafletTileLayer = () => {
    switch (mapType) {
      case 'satellite':
        return (
          <TileLayer
            key="satellite"
            attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        );
      case 'hybrid':
        return (
          <>
            <TileLayer
              key="hybrid-base"
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <TileLayer
              key="hybrid-labels"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            />
          </>
        );
      case 'terrain':
        return (
          <TileLayer
            key="terrain"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          />
        );
      case 'roadmap':
      default:
        return (
          <TileLayer
            key="roadmap"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        );
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hello ${workerName}, I am tracking your live location on SmartFix. Booking ID: #${String(bookingId).slice(-6)}`
  );
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${workerPos.lat},${workerPos.lng}&destination=${customerPos.lat},${customerPos.lng}`;

  const polylinePositions =
    roadRoute.length > 0
      ? roadRoute
      : [
          [workerPos.lat, workerPos.lng],
          [customerPos.lat, customerPos.lng],
        ];

  return (
    <div className="live-tracker-wrapper">
      {/* ---------------------------------------------------------------------
          1. HUD Header (Live Status, Speeds, and SLA)
          --------------------------------------------------------------------- */}
      <div className="tracker-hud-header">
        <div className="hud-header-left">
          {hasArrived ? (
            <div className="hud-status-badge" style={{ background: '#10b981', color: '#ffffff' }}>
              <span className="live-dot-pulse" style={{ background: '#ffffff' }}></span> 🎉 CAPTAIN HAS ARRIVED
            </div>
          ) : slaTimeRemainingMs === 0 ? (
            <div className="hud-status-badge" style={{ background: '#dc2626', borderColor: '#dc2626' }}>
              <AlertTriangle size={13} /> ⚠️ SLA BREACHED
            </div>
          ) : (
            <div className="hud-status-badge">
              <span className="live-dot-pulse"></span> RAPIDO LIVE TRACKING
            </div>
          )}

          <div className="gps-source-pills">
            <span className={`gps-pill ${userGpsActive ? 'gps-pill-active' : 'gps-pill-sim'}`}>
              📍 {userGpsActive ? 'Home GPS: Active' : 'Home GPS: Default'}
            </span>
            <span className={`gps-pill ${socketActive ? 'gps-pill-active' : 'gps-pill-sim'}`}>
              🛵 {socketActive ? 'Captain: Live WebSocket ⚡' : simulating ? 'Captain: Simulating Drive 🎮' : 'Captain: Ready'}
            </span>
            <span className="gps-pill gps-pill-active" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7' }}>
              🚀 {workerSpeed} km/h • Bearing: {workerHeading}°
            </span>
          </div>
        </div>

        <div className="hud-metrics">
          <div className="metric-box">
            <Clock size={16} color="#3b82f6" />
            <div>
              <span className="metric-label">Est. Arrival</span>
              <span className="metric-value">{hasArrived ? 'Arrived!' : `${finalEstimatedMins} mins`}</span>
            </div>
          </div>
          <div className="metric-box">
            <Navigation size={16} color="#10b981" />
            <div>
              <span className="metric-label">Road Distance</span>
              <span className="metric-value">{hasArrived ? 'At Doorstep' : `${finalDistanceKm} km`}</span>
            </div>
          </div>
          {slaTimeRemainingMs !== null && (
            <div
              className="metric-box"
              style={slaWarningActive || slaTimeRemainingMs < 15 * 60 * 1000 ? { background: '#fef2f2', borderColor: '#fca5a5' } : {}}
            >
              <Clock size={16} color={slaWarningActive || slaTimeRemainingMs < 15 * 60 * 1000 ? '#dc2626' : '#f59e0b'} />
              <div>
                <span className="metric-label" style={slaWarningActive || slaTimeRemainingMs < 15 * 60 * 1000 ? { color: '#dc2626' } : {}}>
                  SLA Timer
                </span>
                <span className="metric-value" style={slaWarningActive || slaTimeRemainingMs < 15 * 60 * 1000 ? { color: '#dc2626', fontWeight: 800 } : {}}>
                  {slaTimeRemainingMs === 0
                    ? '⚠️ Expired'
                    : `${String(Math.floor(slaTimeRemainingMs / 60000)).padStart(2, '0')}:${String(Math.floor((slaTimeRemainingMs % 60000) / 1000)).padStart(2, '0')}`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          2. Arrival Guarantee & Street Info Bar
          --------------------------------------------------------------------- */}
      <div className="tracker-1hr-bar">
        <div className="d-flex align-items-center gap-2">
          <ShieldCheck size={16} color="#059669" />
          <span>Real-time road routing active in Sivagangai District</span>
        </div>
        <span className="tracker-dist-limit">📍 Verified Turn-by-Turn GPS</span>
      </div>

      {/* ---------------------------------------------------------------------
          3. Live Interactive Map Container (Leaflet / Google Maps)
          --------------------------------------------------------------------- */}
      <div className="tracker-map-container" onWheel={(e) => e.stopPropagation()}>
        {/* Layer Selector */}
        <div className="map-layer-selector">
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'roadmap' ? 'active' : ''}`}
            onClick={() => setMapType('roadmap')}
            title="Street Map"
          >
            🗺️ Street
          </button>
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'satellite' ? 'active' : ''}`}
            onClick={() => setMapType('satellite')}
            title="Satellite"
          >
            🛰️ Satellite
          </button>
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'hybrid' ? 'active' : ''}`}
            onClick={() => setMapType('hybrid')}
            title="Hybrid"
          >
            🌍 Hybrid
          </button>
        </div>

        {/* Floating Rapido Map Focus Controls */}
        <div className="rapido-map-tools">
          <button
            type="button"
            className={`rapido-tool-btn ${focusTarget === 'worker' ? 'active' : ''}`}
            onClick={() => setFocusTarget('worker')}
            title="Center on Captain"
          >
            🛵
          </button>
          <button
            type="button"
            className={`rapido-tool-btn ${focusTarget === 'customer' ? 'active' : ''}`}
            onClick={() => setFocusTarget('customer')}
            title="Center on Home"
          >
            🏠
          </button>
          <button
            type="button"
            className={`rapido-tool-btn ${focusTarget === 'both' ? 'active' : ''}`}
            onClick={() => setFocusTarget('both')}
            title="Fit Entire Route"
          >
            <Crosshair size={18} />
          </button>
        </div>

        {/* Map Rendering */}
        {hasGoogleKey && isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '380px' }}
            center={{ lat: (customerPos.lat + workerPos.lat) / 2, lng: (customerPos.lng + workerPos.lng) / 2 }}
            zoom={14}
            mapTypeId={mapType}
            options={{
              gestureHandling: 'greedy',
              scrollwheel: true,
              styles: mapType === 'roadmap' ? MAP_STYLES : [],
              disableDefaultUI: false,
              zoomControl: true,
            }}
          >
            <GooglePolyline
              path={roadRoute.length > 0 ? roadRoute.map(([lat, lng]) => ({ lat, lng })) : [workerPos, customerPos]}
              options={{
                strokeColor: '#2563eb',
                strokeOpacity: 0.9,
                strokeWeight: 6,
                geodesic: true,
              }}
            />
            <GoogleMarker position={customerPos} title="📍 Your Live Location" />
            <GoogleMarker position={workerPos} title={`🛵 ${workerName} — Live Captain`} />
          </GoogleMap>
        ) : (
          /* High-Performance Leaflet OpenStreetMap */
          <MapContainer
            center={[customerPos.lat, customerPos.lng]}
            zoom={14}
            scrollWheelZoom={true}
            doubleClickZoom={true}
            touchZoom={true}
            zoomControl={false}
            className="leaflet-live-map"
          >
            <LeafletMapController workerPos={workerPos} customerPos={customerPos} focusTarget={focusTarget} />
            <LeafletCustomZoomControls />
            {renderLeafletTileLayer()}

            {/* Road Route Double Polyline (Outer Dark Casing + Inner Vibrant Line) */}
            <LeafletPolyline
              positions={polylinePositions}
              pathOptions={{
                color: '#1e3a8a',
                weight: 8,
                opacity: 0.5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <LeafletPolyline
              positions={polylinePositions}
              pathOptions={{
                color: '#2563eb',
                weight: 5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />

            {/* Customer Home Marker */}
            <LeafletMarker position={[customerPos.lat, customerPos.lng]} icon={customerHomeMarkerIcon}>
              <LeafletPopup>
                <strong>📍 Service Destination</strong>
                <br />
                {booking?.address || 'Customer Location'}
              </LeafletPopup>
            </LeafletMarker>

            {/* Smooth Rotating Vehicle Marker */}
            <LeafletMarker
              position={[workerPos.lat, workerPos.lng]}
              icon={createVehicleMarkerIcon(workerHeading, workerSpeed, '🛵')}
            >
              <LeafletPopup>
                <strong>🛵 {workerName} (Captain)</strong>
                <br />
                {workerTrade} • Speed: {workerSpeed} km/h
                <br />
                {hasArrived ? '🎉 Arrived at destination!' : `Heading towards destination (${finalDistanceKm} km)`}
              </LeafletPopup>
            </LeafletMarker>
          </MapContainer>
        )}
      </div>

      {/* ---------------------------------------------------------------------
          4. Arrival Banner when Captain Reaches Customer
          --------------------------------------------------------------------- */}
      {hasArrived && (
        <div className="rapido-arrival-banner">
          <div className="arrival-banner-text">
            <Volume2 size={20} className="pulse-icon" />
            <span>🎉 Captain {workerName} has arrived at your doorstep!</span>
          </div>
          <span className="arrival-badge">Ready for Service</span>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          5. Rapido Simulator & Presentation Controls (One-Click Road Demo)
          --------------------------------------------------------------------- */}
      <div className="rapido-simulator-bar">
        <div className="sim-info">
          <span className="sim-badge">🎮 DEMO SIMULATOR</span>
          <span>Experience turn-by-turn live ride movement along actual roads</span>
        </div>
        <div className="sim-actions">
          <button
            type="button"
            className={`sim-btn ${simulating ? 'sim-btn-pause' : 'sim-btn-play'}`}
            onClick={toggleSimulation}
          >
            {simulating ? (
              <>
                <Pause size={14} />
                <span>Pause Ride</span>
              </>
            ) : (
              <>
                <Play size={14} />
                <span>Simulate Rapido Ride</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="sim-btn sim-btn-reset"
            onClick={resetSimulation}
            title="Reset position back to start"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          6. Bottom Ride Card (Rapido & Red Taxi Driver Sheet)
          --------------------------------------------------------------------- */}
      <div className="tracker-bottom-bar">
        <div className="worker-live-card">
          <div className="worker-live-avatar">
            👨‍🔧
            <span className="captain-verified-badge" title="Verified Technician">
              ✓
            </span>
          </div>
          <div className="worker-info-content">
            <h4>
              <span>{workerName}</span>
              <span className="captain-rating-tag">★ 4.9 (148)</span>
            </h4>
            <div className="worker-vehicle-tag">
              <span>🛵 Hero Splendor • TN 63 SmartFix Pro</span>
            </div>
            <div className="d-flex align-items-center gap-2 mt-1">
              <span className="worker-otp-pill">Job OTP: {bookingOtp}</span>
              <span className="text-muted small" style={{ fontSize: '0.74rem' }}>
                • Share with technician on arrival
              </span>
            </div>
          </div>
        </div>

        <div className="tracker-contact-actions">
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="hud-contact-btn hud-gmaps">
            <MapPin size={15} /> Google Maps
          </a>
          <a href={`tel:${phoneNum}`} className="hud-contact-btn hud-call">
            <Phone size={15} /> Call Captain
          </a>
          <a
            href={`https://wa.me/${cleanPhone}?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hud-contact-btn hud-wa"
          >
            <MessageSquare size={15} /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};

export default LiveTrackerMap;
