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
