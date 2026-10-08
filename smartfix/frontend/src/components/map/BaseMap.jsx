import React, { useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { minimalMapStyle, TAMILNADU_BOUNDS, TAMILNADU_CENTER } from './mapStyle';
import { Navigation } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const libraries = ['places', 'geometry'];

const BaseMap = ({ 
  children, 
  center = TAMILNADU_CENTER, 
  zoom = 12, 
  onLoad,
  onIdle,
  onDragEnd,
  mapContainerStyle = { width: '100%', height: '100%' },
  className = '',
  hideRecenter = false,
  mapId = 'smartfix-map-id'
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
    id: 'google-map-script',
  });

  const mapRef = useRef(null);

  const handleOnLoad = useCallback((map) => {
    mapRef.current = map;
    if (onLoad) onLoad(map);
  }, [onLoad]);

  const recenter = () => {
    if (mapRef.current) {
      mapRef.current.panTo(center);
      mapRef.current.setZoom(15);
    }
  };

  if (loadError) return <div className="p-4 text-danger text-center bg-light">Failed to load Maps API. Please check your connection. / வரைபடத்தை ஏற்றுவதில் பிழை.</div>;
  if (!isLoaded) return <div className="p-4 text-center bg-light">Loading Map... / வரைபடம் ஏற்றப்படுகிறது...</div>;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} className={className}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={zoom}
        options={{
          mapId,
          styles: minimalMapStyle,
          disableDefaultUI: true,
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          restriction: {
            latLngBounds: TAMILNADU_BOUNDS,
            strictBounds: false
          },
          minZoom: 6,
        }}
        onLoad={handleOnLoad}
        onIdle={onIdle}
        onDragEnd={onDragEnd}
      >
        {children}
      </GoogleMap>

      {!hideRecenter && (
        <button
          type="button"
          onClick={recenter}
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            background: '#ffffff',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 10
          }}
          title="Recenter to my location"
        >
          <Navigation size={20} color="#2563eb" />
        </button>
      )}
    </div>
  );
};

export default BaseMap;
