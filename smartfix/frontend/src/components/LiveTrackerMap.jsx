import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker as GoogleMarker, Polyline as GooglePolyline } from '@react-google-maps/api';
import { MapContainer, TileLayer, Marker as LeafletMarker, Popup as LeafletPopup, Polyline as LeafletPolyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Phone, MessageSquare, Navigation, ShieldCheck, Clock, MapPin, Wifi, AlertTriangle } from 'lucide-react';
import { calculateDistance } from '../utils/distance';
import { apiService } from '../services/api';
import socket from '../services/socket';
import './LiveTrackerMap.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const hasGoogleKey = GOOGLE_MAPS_API_KEY && !GOOGLE_MAPS_API_KEY.includes('REPLACE');

const MAP_STYLES = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
];

// Leaflet Custom Markers
const customerLiveIcon = L.divIcon({
  className: 'live-marker customer-home-marker',
  html: `<div class="home-pin-circle">📍<span class="user-live-ring"></span></div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const handymanLiveIcon = L.divIcon({
  className: 'live-marker handyman-live-marker',
  html: `<div class="worker-pin-circle">👨‍🔧<span class="pulse-ring"></span></div>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

function LeafletCustomZoomControls() {
  const map = useMap();
  return (
    <div className="custom-map-zoom-buttons">
      <button
        type="button"
        className="zoom-btn zoom-in"
        onClick={() => map.zoomIn()}
        title="Zoom In (+)"
      >
        +
      </button>
      <button
        type="button"
        className="zoom-btn zoom-out"
        onClick={() => map.zoomOut()}
        title="Zoom Out (−)"
      >
        −
      </button>
    </div>
  );
}

function LeafletAutoCenter({ pos1, pos2 }) {
  const map = useMap();
  useEffect(() => {
    if (pos1 && pos2) {
      const bounds = L.latLngBounds([pos1, pos2]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [pos1, pos2, map]);
  return null;
}

const LiveTrackerMap = ({ booking, worker, userLat: initialUserLat, userLng: initialUserLng, slaDeadline: slaDeadlineProp }) => {
  const workerName = worker?.name || booking?.workerName || 'Handyman Pro';
  const workerTrade = worker?.trade || booking?.trade || 'Handyman';
  const phoneNum = worker?.phone || booking?.workerPhone || '+919876543210';
  const cleanPhone = phoneNum.replace(/[^0-9]/g, '');
  const bookingId = booking?._id || booking?.id;

  const defaultLat = initialUserLat || 9.8433;
  const defaultLng = initialUserLng || 78.4809;

  const [customerPos, setCustomerPos] = useState({ lat: defaultLat, lng: defaultLng });
  const [userGpsActive, setUserGpsActive] = useState(!!initialUserLat);
  const watchIdRef = useRef(null);

  const [workerPos, setWorkerPos] = useState({ lat: defaultLat + 0.018, lng: defaultLng + 0.020 });
  const [workerGpsFromBackend, setWorkerGpsFromBackend] = useState(false);
  const [socketActive, setSocketActive] = useState(false);
  const [lastWorkerUpdate, setLastWorkerUpdate] = useState(null);
  const workerSimRef = useRef({ step: 0 });

  // SLA countdown: prefer server-pushed slaTimeRemainingMs; fall back to local prop
  const [slaDeadline, setSlaDeadline] = useState(
    () => slaDeadlineProp || booking?.slaDeadline || null
  );
  const [slaTimeRemainingMs, setSlaTimeRemainingMs] = useState(null);

  // Local ticker to update countdown every second
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

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: hasGoogleKey ? GOOGLE_MAPS_API_KEY : '',
    id: 'google-map-script',
  });

  const [slaWarningActive, setSlaWarningActive] = useState(false);

  // 1. Socket.IO Real-Time Worker Location Listener
  useEffect(() => {
    if (!bookingId) return;

    socket.emit('join-booking-room', { bookingId });
    console.log(`⚡ Joined Socket.IO room for booking ${bookingId}`);

    const handleWorkerLocation = (data) => {
      if (data && data.latitude && data.longitude) {
        setWorkerPos({ lat: Number(data.latitude), lng: Number(data.longitude) });
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
    socket.on('sla-warning', handleSlaWarning);

    return () => {
      socket.emit('leave-booking', bookingId);
      socket.off('worker-location', handleWorkerLocation);
      socket.off('sla-warning', handleSlaWarning);
    };
  }, [bookingId]);

  // 2. Continuous user GPS via watchPosition
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCustomerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUserGpsActive(true);
      },
      (err) => {
        console.warn('User watchPosition error:', err.message);
        if (initialUserLat) setCustomerPos({ lat: initialUserLat, lng: initialUserLng });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // 3. ETA updates using Google Maps Distance Matrix API every 30 seconds
  const [estimatedMins, setEstimatedMins] = useState(null);
  
  useEffect(() => {
    if (!hasGoogleKey || !window.google) return;
    
    const fetchEta = () => {
      const service = new window.google.maps.DistanceMatrixService();
      service.getDistanceMatrix({
        origins: [{ lat: workerPos.lat, lng: workerPos.lng }],
        destinations: [{ lat: customerPos.lat, lng: customerPos.lng }],
        travelMode: 'DRIVING',
      }, (response, status) => {
        if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
          const durationSecs = response.rows[0].elements[0].duration.value;
          setEstimatedMins(Math.ceil(durationSecs / 60));
        }
      });
    };

    fetchEta(); // initial
    const etaInterval = setInterval(fetchEta, 30000);
    return () => clearInterval(etaInterval);
  }, [workerPos.lat, workerPos.lng, customerPos.lat, customerPos.lng]);

  // 3. Simulation fallback
  useEffect(() => {
    if (workerGpsFromBackend) return;
    const startLat = customerPos.lat + 0.018;
    const startLng = customerPos.lng + 0.020;
    const interval = setInterval(() => {
      workerSimRef.current.step = (workerSimRef.current.step + 1) % 100;
      const ratio = workerSimRef.current.step / 100;
      setWorkerPos({
        lat: startLat + (customerPos.lat - startLat) * (ratio * 0.75),
        lng: startLng + (customerPos.lng - startLng) * (ratio * 0.75),
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [customerPos, workerGpsFromBackend]);

  const liveDistance = calculateDistance(customerPos.lat, customerPos.lng, workerPos.lat, workerPos.lng);
  const finalEstimatedMins = estimatedMins !== null ? estimatedMins : Math.max(2, Math.round(liveDistance * 4));

  const whatsappMessage = encodeURIComponent(
    `Hello ${workerName}, I am tracking your live location for my ${workerTrade} booking on SmartFix.`
  );
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${customerPos.lat},${customerPos.lng}&destination=${workerPos.lat},${workerPos.lng}`;

  const containerStyle = { width: '100%', height: '320px' };
  const mapCenter = {
    lat: (customerPos.lat + workerPos.lat) / 2,
    lng: (customerPos.lng + workerPos.lng) / 2,
  };

  // Google SVG Marker icons
  const customerIcon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44">
        <circle cx="22" cy="22" r="20" fill="white" stroke="#2563eb" stroke-width="3"/>
        <text x="22" y="30" font-size="20" text-anchor="middle">📍</text>
      </svg>
    `)}`,
    scaledSize: { width: 44, height: 44 },
    anchor: { x: 22, y: 22 },
  };

  const workerIcon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48">
        <circle cx="24" cy="24" r="22" fill="#2563eb" stroke="white" stroke-width="3"/>
        <text x="24" y="33" font-size="22" text-anchor="middle">👨‍🔧</text>
      </svg>
    `)}`,
    scaledSize: { width: 48, height: 48 },
    anchor: { x: 24, y: 24 },
  };

  const [mapType, setMapType] = useState('hybrid');

  const renderLeafletTileLayer = () => {
    switch (mapType) {
      case 'satellite':
        return (
          <TileLayer
            key="satellite"
            attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP"
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
            attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Style: OpenTopoMap'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          />
        );
      case 'roadmap':
      default:
        return (
          <TileLayer
            key="roadmap"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        );
    }
  };

  return (
    <div className="live-tracker-wrapper">
      {/* HUD Header */}
      <div className="tracker-hud-header">
        <div className="hud-header-left">
          {slaTimeRemainingMs === 0 ? (
            <div className="hud-status-badge" style={{ background: '#dc2626', borderColor: '#dc2626' }}>
              <AlertTriangle size={13} /> ⚠️ SLA BREACHED
            </div>
          ) : (
            <div className="hud-status-badge"><span className="live-dot-pulse"></span> LIVE TRACKING EN ROUTE</div>
          )}
          <div className="gps-source-pills">
            <span className={`gps-pill ${userGpsActive ? 'gps-pill-active' : 'gps-pill-sim'}`}>
              📍 {userGpsActive ? 'Your GPS: LIVE' : 'Your GPS: Default'}
            </span>
            <span className={`gps-pill ${socketActive ? 'gps-pill-active' : workerGpsFromBackend ? 'gps-pill-active' : 'gps-pill-sim'}`}>
              👨‍🔧 {socketActive ? 'Worker GPS: WebSocket Live ⚡' : workerGpsFromBackend ? 'Worker GPS: REST Live' : 'Worker GPS: Simulated'}
            </span>
          </div>
        </div>
        <div className="hud-metrics">
          <div className="metric-box">
            <Clock size={16} color="#2563eb" />
            <div><span className="metric-label">Est. Arrival</span><span className="metric-value">{finalEstimatedMins} mins</span></div>
          </div>
          <div className="metric-box">
            <Navigation size={16} color="#059669" />
            <div><span className="metric-label">Live Distance</span><span className="metric-value">{liveDistance} km</span></div>
          </div>
          {/* SLA countdown metric */}
          {slaTimeRemainingMs !== null && (
            <div className="metric-box" style={(slaWarningActive || slaTimeRemainingMs < 15 * 60 * 1000) ? { background: '#fef2f2', borderColor: '#fca5a5' } : {}}>
              <Clock size={16} color={(slaWarningActive || slaTimeRemainingMs < 15 * 60 * 1000) ? '#dc2626' : '#f59e0b'} />
              <div>
                <span className="metric-label" style={(slaWarningActive || slaTimeRemainingMs < 15 * 60 * 1000) ? { color: '#dc2626' } : {}}>SLA Time Left</span>
                <span className="metric-value" style={(slaWarningActive || slaTimeRemainingMs < 15 * 60 * 1000) ? { color: '#dc2626', fontWeight: 800 } : {}}>
                  {slaTimeRemainingMs === 0
                    ? '⚠️ Expired'
                    : `${String(Math.floor(slaTimeRemainingMs / 60000)).padStart(2, '0')}:${String(Math.floor((slaTimeRemainingMs % 60000) / 1000)).padStart(2, '0')}`
                  }
                </span>
              </div>
            </div>
          )}
          {workerGpsFromBackend && lastWorkerUpdate && (
            <div className="metric-box">
              <Wifi size={16} color="#f59e0b" />
              <div><span className="metric-label">Last Update</span><span className="metric-value">{lastWorkerUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span></div>
            </div>
          )}
        </div>
      </div>

      {/* 1-Hour Arrival Bar */}
      <div className="tracker-1hr-bar">
        <Clock size={14} color="#059669" />
        <span>Worker arrival guaranteed within <strong>1 hour</strong> of booking acceptance</span>
        <span className="tracker-dist-limit">📍 5 km zone active</span>
      </div>

      {/* Live Map Display */}
      <div className="tracker-map-container" style={{ position: 'relative' }} onWheel={(e) => e.stopPropagation()}>
        {/* Map Layer Switcher Control */}
        <div className="map-layer-selector">
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'roadmap' ? 'active' : ''}`}
            onClick={() => setMapType('roadmap')}
            title="Street / Road Map View"
          >
            🗺️ Street
          </button>
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'satellite' ? 'active' : ''}`}
            onClick={() => setMapType('satellite')}
            title="Pure Satellite View"
          >
            🛰️ Satellite
          </button>
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'hybrid' ? 'active' : ''}`}
            onClick={() => setMapType('hybrid')}
            title="Satellite + Street Labels"
          >
            🌍 Hybrid
          </button>
          <button
            type="button"
            className={`map-layer-btn ${mapType === 'terrain' ? 'active' : ''}`}
            onClick={() => setMapType('terrain')}
            title="Topographic Terrain View"
          >
            🏔️ Terrain
          </button>
        </div>

        {hasGoogleKey && isLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={mapCenter}
            zoom={14}
            mapTypeId={mapType}
            options={{
              gestureHandling: 'greedy',
              scrollwheel: true,
              styles: mapType === 'roadmap' ? MAP_STYLES : [],
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: true,
              fullscreenControl: true,
              mapTypeControl: true,
            }}
          >
            <GooglePolyline
              path={[workerPos, customerPos]}
              options={{
                strokeColor: '#2563eb',
                strokeOpacity: 0.85,
                strokeWeight: 4,
                geodesic: true,
              }}
            />
            <GoogleMarker position={customerPos} icon={customerIcon} title="📍 Your Live Location" />
            <GoogleMarker position={workerPos} icon={workerIcon} title={`👨‍🔧 ${workerName} — En Route`} />
          </GoogleMap>
        ) : (
          /* Leaflet OpenStreetMap fallback when Google key is not set */
          <MapContainer
            center={[customerPos.lat, customerPos.lng]}
            zoom={13}
            scrollWheelZoom={true}
            doubleClickZoom={true}
            touchZoom={true}
            zoomControl={false}
            className="leaflet-live-map"
            style={{ width: '100%', height: '320px' }}
          >
            <LeafletAutoCenter pos1={[customerPos.lat, customerPos.lng]} pos2={[workerPos.lat, workerPos.lng]} />
            <LeafletCustomZoomControls />
            {renderLeafletTileLayer()}
            <LeafletPolyline
              positions={[[workerPos.lat, workerPos.lng], [customerPos.lat, customerPos.lng]]}
              pathOptions={{ color: '#2563eb', weight: 4, dashArray: '8, 8', opacity: 0.8 }}
            />
            <LeafletMarker position={[customerPos.lat, customerPos.lng]} icon={customerLiveIcon}>
              <LeafletPopup>
                <strong>📍 Your Live Location</strong>
                <br />
                {booking?.address || 'Service Address'}
              </LeafletPopup>
            </LeafletMarker>
            <LeafletMarker position={[workerPos.lat, workerPos.lng]} icon={handymanLiveIcon}>
              <LeafletPopup>
                <strong>{workerName}</strong> (Worker Live Location)
                <br />
                {workerTrade} • {liveDistance} km away
              </LeafletPopup>
            </LeafletMarker>
          </MapContainer>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="tracker-bottom-bar">
        <div className="worker-live-card">
          <div className="worker-live-avatar">👨‍🔧</div>
          <div>
            <h4>{workerName}</h4>
            <p className="worker-live-trade"><ShieldCheck size={13} color="#059669" /> Verified Pro • {workerTrade}</p>
            <p className="worker-live-phone"><Phone size={12} /> {phoneNum}</p>
          </div>
        </div>
        <div className="tracker-contact-actions">
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="hud-contact-btn hud-gmaps">
            <MapPin size={15} /> Google Maps
          </a>
          <a href={`tel:${phoneNum}`} className="hud-contact-btn hud-call"><Phone size={15} /> Call Pro</a>
          <a href={`https://wa.me/${cleanPhone}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer" className="hud-contact-btn hud-wa">
            <MessageSquare size={15} /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
};

export default LiveTrackerMap;
