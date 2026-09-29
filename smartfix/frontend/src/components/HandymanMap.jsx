import { useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker as GoogleMarker, Circle as GoogleCircle, InfoWindow } from '@react-google-maps/api';
import { MapContainer, TileLayer, Marker as LeafletMarker, Popup as LeafletPopup, Circle as LeafletCircle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Star, MapPin, Wrench, Navigation } from 'lucide-react';
import { getCityBase, getWorkerCoordinates, calculateDistance } from '../utils/distance';
import { getUserCurrentLocation } from '../utils/geolocation';
import './HandymanMap.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const hasGoogleKey = GOOGLE_MAPS_API_KEY && !GOOGLE_MAPS_API_KEY.includes('REPLACE');

const getWorkerLatLng = (worker, index) => {
  const [lat, lng] = getWorkerCoordinates(worker, index);
  return { lat, lng };
};

const createLeafletWorkerIcon = (worker, isSelected) => {
  return L.divIcon({
    className: `custom-map-pin ${isSelected ? 'pin-selected' : ''}`,
    html: `
      <div class="pin-badge ${isSelected ? 'badge-active' : ''}">
        <span class="pin-emoji">${worker.avatar || '👨‍🔧'}</span>
        <span class="pin-price">₹${worker.ratePerHour}</span>
      </div>
    `,
    iconSize: [68, 36],
    iconAnchor: [34, 36],
  });
};

const userLeafletIcon = L.divIcon({
  className: 'user-gps-marker',
  html: `
    <div class="user-pin-circle">
      <span class="user-pin-icon">📍</span>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
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

function LeafletChangeView({ center, zoom = 13 }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.lat, center.lng], zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

const HandymanMap = ({ workers = [], selectedLocation = 'all', onSelectWorker }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedWorkerPos, setSelectedWorkerPos] = useState(null);
  const [mapType, setMapType] = useState('hybrid'); // Default to Google Satellite Hybrid
  const [userPos, setUserPos] = useState(null);
  const [locatingGps, setLocatingGps] = useState(false);

  // Filter out self and same trade workers if user is handyman
  const displayWorkers = workers.filter((w) => {
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

  const getDynamicCenter = () => {
    if (userPos) return userPos;
    if (selectedLocation && selectedLocation !== 'all') {
      const [lat, lng] = getCityBase(selectedLocation);
      return { lat, lng };
    }
    if (workers.length > 0) {
      const [lat, lng] = getWorkerCoordinates(workers[0], 0);
      return { lat, lng };
    }
    return { lat: 9.8433, lng: 78.4809 };
  };

  const currentCenter = getDynamicCenter();

  const handleFetchUserGps = async () => {
    setLocatingGps(true);
    try {
      const coords = await getUserCurrentLocation({ enableHighAccuracy: true, timeout: 8000 });
      setUserPos({ lat: coords.lat, lng: coords.lng });
      setLocatingGps(false);
    } catch (err) {
      console.warn('GPS Error:', err.message);
      setLocatingGps(false);
    }
  };

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: hasGoogleKey ? GOOGLE_MAPS_API_KEY : '',
    id: 'google-map-script',
  });

  const containerStyle = { width: '100%', height: '520px', borderRadius: '16px' };

  const renderLeafletTileLayer = () => {
    switch (mapType) {
      case 'roadmap':
        return (
          <TileLayer
            key="google-roadmap"
            attribution="&copy; Google Maps"
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          />
        );
      case 'satellite':
        return (
          <TileLayer
            key="google-satellite"
            attribution="&copy; Google Maps"
            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
          />
        );
      case 'terrain':
        return (
          <TileLayer
            key="google-terrain"
            attribution="&copy; Google Maps"
            url="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
          />
        );
      case 'hybrid':
      default:
        return (
          <TileLayer
            key="google-hybrid"
            attribution="&copy; Google Maps"
            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
          />
        );
    }
  };

  return (
    <div className="clean-map-wrapper" onWheel={(e) => e.stopPropagation()}>
      {/* Floating Map Controls overlay */}
      <div className="map-floating-controls">
        <button
          type="button"
          className={`floating-gps-btn ${userPos ? 'active' : ''}`}
          onClick={handleFetchUserGps}
          disabled={locatingGps}
          title="Center My Location"
        >
          <Navigation size={14} className={locatingGps ? 'spin-icon' : ''} />
          <span>{locatingGps ? 'Locating...' : 'My Location'}</span>
        </button>

        <div className="floating-layer-switcher">
          <button
            type="button"
            className={`layer-tab ${mapType === 'hybrid' ? 'active' : ''}`}
            onClick={() => setMapType('hybrid')}
          >
            🌍 Satellite Hybrid
          </button>
          <button
            type="button"
            className={`layer-tab ${mapType === 'roadmap' ? 'active' : ''}`}
            onClick={() => setMapType('roadmap')}
          >
            🗺️ Street Map
          </button>
          <button
            type="button"
            className={`layer-tab ${mapType === 'terrain' ? 'active' : ''}`}
            onClick={() => setMapType('terrain')}
          >
            🏔️ Terrain
          </button>
        </div>
      </div>

      {/* Map Display */}
      {hasGoogleKey && isLoaded ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={currentCenter}
          zoom={13}
          mapTypeId={mapType}
          options={{
            gestureHandling: 'greedy',
            scrollwheel: true,
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: true,
            fullscreenControl: true,
            mapTypeControl: false,
          }}
        >
          {userPos && (
            <GoogleMarker
              position={userPos}
              title="Your Location"
              icon={{
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                    <circle cx="18" cy="18" r="14" fill="#0284c7" stroke="white" stroke-width="3"/>
                  </svg>
                `)}`,
                scaledSize: { width: 36, height: 36 },
                anchor: { x: 18, y: 18 },
              }}
            />
          )}

          {displayWorkers.map((worker, idx) => {
            const position = getWorkerLatLng(worker, idx);
            const isSelected = selectedWorker && (selectedWorker._id || selectedWorker.id) === (worker._id || worker.id);
            return (
              <GoogleMarker
                key={worker._id || worker.id || idx}
                position={position}
                onClick={() => {
                  setSelectedWorker(worker);
                  setSelectedWorkerPos(position);
                  if (onSelectWorker) onSelectWorker(worker);
                }}
                icon={{
                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="68" height="36">
                      <rect rx="10" ry="10" width="68" height="36" fill="${isSelected ? '#10b981' : '#2563eb'}" stroke="white" stroke-width="2"/>
                      <text x="34" y="23" font-family="Arial" font-size="13" font-weight="bold" fill="white" text-anchor="middle">₹${worker.ratePerHour}</text>
                    </svg>
                  `)}`,
                  scaledSize: { width: 68, height: 36 },
                  anchor: { x: 34, y: 36 },
                }}
              />
            );
          })}

          {selectedWorker && selectedWorkerPos && (
            <InfoWindow
              position={selectedWorkerPos}
              onCloseClick={() => { setSelectedWorker(null); setSelectedWorkerPos(null); }}
            >
              <div className="clean-gmap-popup">
                <div className="popup-head">
                  <span className="popup-avatar">{selectedWorker.avatar || '👨‍🔧'}</span>
                  <div>
                    <h4>{selectedWorker.name}</h4>
                    <p className="popup-trade"><Wrench size={12} /> {selectedWorker.trade}</p>
                  </div>
                </div>
                <div className="popup-body">
                  <span className="popup-rate">₹{selectedWorker.ratePerHour}/hr</span>
                  <span className="popup-dist"><MapPin size={12} /> {calculateDistance(currentCenter.lat, currentCenter.lng, selectedWorkerPos.lat, selectedWorkerPos.lng)} km</span>
                </div>
                <button
                  className="popup-btn"
                  onClick={() => navigate(`/booking/${selectedWorker._id || selectedWorker.id}`)}
                >
                  Book Now
                </button>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      ) : (
        <MapContainer
          center={[currentCenter.lat, currentCenter.lng]}
          zoom={13}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          touchZoom={true}
          zoomControl={false}
          className="clean-leaflet-map"
          style={{ width: '100%', height: '520px', borderRadius: '16px' }}
        >
          <LeafletChangeView center={currentCenter} />
          <LeafletCustomZoomControls />
          {renderLeafletTileLayer()}

          {userPos && (
            <LeafletMarker position={[userPos.lat, userPos.lng]} icon={userLeafletIcon}>
              <LeafletPopup>📍 Your Location</LeafletPopup>
            </LeafletMarker>
          )}

          {displayWorkers.map((worker, idx) => {
            const pos = getWorkerLatLng(worker, idx);
            const isSelected = selectedWorker && (selectedWorker._id || selectedWorker.id) === (worker._id || worker.id);
            const dist = calculateDistance(currentCenter.lat, currentCenter.lng, pos.lat, pos.lng);

            return (
              <LeafletMarker
                key={worker.id || worker._id || idx}
                position={[pos.lat, pos.lng]}
                icon={createLeafletWorkerIcon(worker, isSelected)}
                eventHandlers={{
                  click: () => {
                    setSelectedWorker(worker);
                    if (onSelectWorker) onSelectWorker(worker);
                  },
                }}
              >
                <LeafletPopup className="clean-leaflet-popup">
                  <div className="clean-popup-card">
                    <div className="popup-head">
                      <span className="popup-avatar">{worker.avatar || '👨‍🔧'}</span>
                      <div>
                        <h4>{worker.name}</h4>
                        <p className="popup-trade"><Wrench size={12} /> {worker.trade}</p>
                      </div>
                    </div>
                    <div className="popup-body">
                      <span className="popup-rate">₹{worker.ratePerHour}/hr</span>
                      <span className="popup-dist"><MapPin size={12} /> {dist} km</span>
                    </div>
                    <button
                      className="popup-btn"
                      onClick={() => navigate(`/booking/${worker.id || worker._id}`)}
                    >
                      Book Now
                    </button>
                  </div>
                </LeafletPopup>
              </LeafletMarker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
};

export default HandymanMap;
