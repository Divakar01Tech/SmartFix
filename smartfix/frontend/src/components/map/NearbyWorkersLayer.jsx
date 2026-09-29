import React, { useState, useEffect } from 'react';
import { Marker } from '@react-google-maps/api';
import { apiService } from '../../services/api';

const SNAP_GRID_SIZE = 0.003; // Approx ~300m in degrees

// Jitter to a ~300m grid for privacy
const snapToGrid = (lat, lng) => {
  return {
    lat: Math.round(lat / SNAP_GRID_SIZE) * SNAP_GRID_SIZE,
    lng: Math.round(lng / SNAP_GRID_SIZE) * SNAP_GRID_SIZE
  };
};

const NearbyWorkersLayer = ({ category, center }) => {
  const [workers, setWorkers] = useState([]);

  useEffect(() => {
    if (!center || !center.lat) return;
    
    const fetchWorkers = async () => {
      try {
        const query = `lat=${center.lat}&lng=${center.lng}${category ? `&category=${category}` : ''}`;
        // Assumes you have an endpoint or you added one in your apiService
        const res = await apiService.getNearbyWorkers(query);
        if (res && res.workers) {
          // Snap coordinates for privacy
          const snapped = res.workers.map(w => ({
            ...w,
            locationPoint: {
              coordinates: [
                snapToGrid(w.locationPoint.coordinates[1], w.locationPoint.coordinates[0]).lng,
                snapToGrid(w.locationPoint.coordinates[1], w.locationPoint.coordinates[0]).lat
              ]
            }
          }));
          setWorkers(snapped);
        }
      } catch (e) {
        console.warn('Failed to fetch nearby workers', e);
      }
    };

    fetchWorkers();
    const interval = setInterval(fetchWorkers, 15000); // 15 seconds refresh
    
    return () => clearInterval(interval);
  }, [category, center]);

  if (workers.length === 0) return null;

  return (
    <>
      {workers.map((worker, i) => (
        <Marker
          key={`worker-${i}`}
          position={{ lat: worker.locationPoint.coordinates[1], lng: worker.locationPoint.coordinates[0] }}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }}
          options={{
            animation: window.google.maps.Animation.DROP
          }}
        />
      ))}
      <div style={{
        position: 'absolute',
        top: '70px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#fff',
        padding: '6px 12px',
        borderRadius: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        fontWeight: '700',
        color: '#1e293b',
        fontSize: '0.85rem',
        zIndex: 5,
        pointerEvents: 'none'
      }}>
        {workers.length} {category ? category : 'professionals'} near you
      </div>
    </>
  );
};

export default NearbyWorkersLayer;
