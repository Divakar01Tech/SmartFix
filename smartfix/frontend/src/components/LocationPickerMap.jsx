import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker as GoogleMarker } from '@react-google-maps/api';
import { MapContainer, TileLayer, Marker as LeafletMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { getUserCurrentLocation } from '../utils/geolocation';
import { MapPin, CheckCircle2, Navigation } from 'lucide-react';
import './LocationPickerMap.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const hasGoogleKey = GOOGLE_MAPS_API_KEY && !GOOGLE_MAPS_API_KEY.includes('REPLACE');
const DEFAULT_CENTER = { lat: 9.8433, lng: 78.4809 };

const MAP_STYLES = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

// Leaflet custom marker icon
const pinIcon = L.divIcon({
  className: 'location-picker-pin',
  html: `<div class="picker-marker"><span class="marker-pulse"></span><div class="marker-icon-wrapper">📍</div></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

function LeafletChangeCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], 15);
  }, [center, map]);
  return null;
}

function LeafletLocationClicker({ setPosition, handleSelect }) {
  useMapEvents({
    click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setPosition({ lat, lng });
      const addr = `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      handleSelect(addr, { lat, lng });
    },
  });
  return null;
}

const LocationPickerMap = ({ onAddressSelect, onLocationSelect, initialAddress }) => {
  const [position, setPosition] = useState(DEFAULT_CENTER);
  const [selectedText, setSelectedText] = useState(initialAddress || 'Current Location');
  const [locating, setLocating] = useState(false);
  const [gpsActive, setGpsActive] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: hasGoogleKey ? GOOGLE_MAPS_API_KEY : '',
    id: 'google-map-script',
  });

  const handleSelect = (addr, coords) => {
    setSelectedText(addr);
    if (onAddressSelect) onAddressSelect(addr);
    if (onLocationSelect && coords) onLocationSelect(coords);
  };

  const handleMapClick = useCallback((e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setPosition({ lat, lng });
    const addr = `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    handleSelect(addr, { lat, lng });
  }, [onAddressSelect, onLocationSelect]);

  const handleFetchLiveLocation = async () => {
    setLocating(true);
    try {
      const coords = await getUserCurrentLocation({ enableHighAccuracy: true, timeout: 8000 });
      const lat = coords.lat;
      const lng = coords.lng;
      setPosition({ lat, lng });
      setGpsActive(true);
      setLocating(false);

      const label = coords.source === 'ip' ? `Location (${coords.city || 'Tamil Nadu'})` : `Live GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      setSelectedText(label);
      handleSelect(label, { lat, lng });
    } catch (err) {
      console.warn('GPS location error:', err.message);
      setLocating(false);
      alert('Could not fetch live GPS position. Please click on the map to select location manually.');
    }
  };

  const containerStyle = { width: '100%', height: '280px', borderRadius: '14px' };

  const [mapType, setMapType] = useState('hybrid');

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
    <div className="location-picker-wrapper">
      <div className="picker-header">
        <div className="picker-title">
          <MapPin size={18} className="text-blue-600" />
          <span>Pinpoint Service Location on Map</span>
        </div>
        <button
          type="button"
          className={`fetch-gps-btn ${gpsActive ? 'active' : ''}`}
          onClick={handleFetchLiveLocation}
          disabled={locating}
        >
          <Navigation size={14} className={locating ? 'spin-icon' : ''} />
          {locating ? 'Locating GPS...' : gpsActive ? 'GPS Location Pinpointed 📍' : 'Use My Live GPS Location'}
        </button>
      </div>

      <div className="picker-map-frame" style={{ position: 'relative' }}>
        <div className="map-floating-controls" style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={`floating-gps-btn ${gpsActive ? 'active' : ''}`}
            onClick={handleFetchLiveLocation}
            disabled={locating}
            title="Center My Location"
            style={{ 
              display: 'flex', alignItems: 'center', gap: '6px', 
              background: gpsActive ? '#2563eb' : 'rgba(255, 255, 255, 0.94)', 
              color: gpsActive ? '#ffffff' : '#334155',
              border: gpsActive ? '1px solid #2563eb' : '1px solid rgba(226, 232, 240, 0.9)',
              padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
              boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)', cursor: 'pointer' 
            }}
          >
            <Navigation size={14} className={locating ? 'spin-icon' : ''} />
            <span>{locating ? 'Locating...' : 'My Location'}</span>
          </button>

          <div className="floating-layer-switcher" style={{ 
            display: 'flex', gap: '2px', background: 'rgba(255, 255, 255, 0.94)', 
            padding: '3px', borderRadius: '20px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.12)',
            border: '1px solid rgba(226, 232, 240, 0.9)' 
          }}>
            <button
              type="button"
              className={`layer-tab ${mapType === 'hybrid' ? 'active' : ''}`}
              onClick={() => setMapType('hybrid')}
              style={{
                border: 'none', background: mapType === 'hybrid' ? '#2563eb' : 'transparent',
                color: mapType === 'hybrid' ? '#ffffff' : '#64748b',
                padding: '4px 10px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🌍 Satellite Hybrid
            </button>
            <button
              type="button"
              className={`layer-tab ${mapType === 'roadmap' ? 'active' : ''}`}
              onClick={() => setMapType('roadmap')}
              style={{
                border: 'none', background: mapType === 'roadmap' ? '#2563eb' : 'transparent',
                color: mapType === 'roadmap' ? '#ffffff' : '#64748b',
                padding: '4px 10px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🗺️ Street Map
            </button>
            <button
              type="button"
              className={`layer-tab ${mapType === 'terrain' ? 'active' : ''}`}
              onClick={() => setMapType('terrain')}
              style={{
                border: 'none', background: mapType === 'terrain' ? '#2563eb' : 'transparent',
                color: mapType === 'terrain' ? '#ffffff' : '#64748b',
                padding: '4px 10px', borderRadius: '14px', fontSize: '0.78rem', fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🏔️ Terrain
            </button>
          </div>
        </div>

        {hasGoogleKey && isLoaded ? (
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={position}
            zoom={15}
            mapTypeId={mapType}
            onClick={handleMapClick}
            options={{
              styles: mapType === 'roadmap' ? MAP_STYLES : [],
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: true,
              fullscreenControl: false,
              mapTypeControl: true,
            }}
          >
            <GoogleMarker
              position={position}
              draggable={true}
              onDragEnd={(e) => {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                setPosition({ lat, lng });
                handleSelect(`Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, { lat, lng });
              }}
            />
          </GoogleMap>
        ) : (
          /* Leaflet OpenStreetMap fallback when Google key is not set */
          <MapContainer
            center={[position.lat, position.lng]}
            zoom={13}
            scrollWheelZoom={false}
            className="picker-map"
            style={{ height: '280px', width: '100%', borderRadius: '14px' }}
          >
            <LeafletChangeCenter center={position} />
            {renderLeafletTileLayer()}
            <LeafletLocationClicker setPosition={setPosition} handleSelect={handleSelect} />
            <LeafletMarker position={[position.lat, position.lng]} icon={pinIcon} />
          </MapContainer>
        )}
      </div>

      {selectedText && (
        <div className="selected-location-bar">
          <CheckCircle2 size={16} color="#059669" />
          <span>Selected Address: <strong>{selectedText}</strong></span>
        </div>
      )}

      <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
        📌 Click on the map or use GPS to pinpoint your exact service location.
      </p>
    </div>
  );
};

export default LocationPickerMap;
