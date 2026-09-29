import React, { useState, useEffect, useRef, useCallback } from 'react';
import BaseMap from './BaseMap';
import BottomSheet from './BottomSheet';
import { apiService, getApiBase } from '../../services/api';
import socket from '../../services/socket';

const decodePolyline = (encoded) => {
  if (!encoded || !window.google) return [];
  return window.google.maps.geometry.encoding.decodePath(encoded);
};

const getBearing = (start, end) => {
  if (!window.google) return 0;
  return window.google.maps.geometry.spherical.computeHeading(start, end);
};

const LiveTrackingMap = ({ booking, isWorker = false, onCancel, onCall }) => {
  const [mapInstance, setMapInstance] = useState(null);
  const [workerPos, setWorkerPos] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [etaText, setEtaText] = useState('');
  const [isAutoFollow, setIsAutoFollow] = useState(true);
  const [isStale, setIsStale] = useState(false);
  
  const workerMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const animationRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const currentPosRef = useRef(null);
  
  const destPos = {
    lat: booking?.customer?.locationPoint?.coordinates?.[1] || booking?.location?.coordinates?.[1],
    lng: booking?.customer?.locationPoint?.coordinates?.[0] || booking?.location?.coordinates?.[0]
  };

  const fetchRoute = useCallback(async (startLat, startLng) => {
    try {
      const token = localStorage.getItem('smartfix_token');
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/maps/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bookingId: booking._id,
          origin: { lat: startLat, lng: startLng },
          destination: destPos
        })
      });
      const data = await res.json();
      if (data.polyline) {
        setRoutePath(decodePolyline(data.polyline));
        setEtaText(data.durationText);
      }
    } catch (e) {
      console.warn('Failed to fetch route:', e);
    }
  }, [booking._id, destPos]);

  useEffect(() => {
    if (booking?.tracking?.lastLat) {
      const initial = { lat: booking.tracking.lastLat, lng: booking.tracking.lastLng };
      setWorkerPos(initial);
      currentPosRef.current = initial;
      fetchRoute(initial.lat, initial.lng);
    }

    if (socket) {
      socket.emit('join-booking-room', { bookingId: booking._id });
      
      // Backend emits 'worker-location' with { latitude, longitude, timestamp }
      const handleLocation = (payload) => {
        lastUpdateRef.current = Date.now();
        setIsStale(false);
        
        const newPos = { lat: payload.latitude, lng: payload.longitude };
        if (!currentPosRef.current) {
          setWorkerPos(newPos);
          currentPosRef.current = newPos;
          fetchRoute(newPos.lat, newPos.lng);
          return;
        }

        // Smooth animation logic
        const startPos = currentPosRef.current;
        const startPoint = new window.google.maps.LatLng(startPos.lat, startPos.lng);
        const endPoint = new window.google.maps.LatLng(newPos.lat, newPos.lng);
        
        const dist = window.google.maps.geometry.spherical.computeDistanceBetween(startPoint, endPoint);
        if (dist < 5) return; // Ignore jitter

        const bearing = getBearing(startPoint, endPoint);
        if (workerMarkerRef.current && workerMarkerRef.current.icon) {
           const icon = workerMarkerRef.current.getIcon();
           icon.rotation = bearing;
           workerMarkerRef.current.setIcon(icon);
        }

        const startTime = performance.now();
        const duration = 1500;

        const animate = (time) => {
          let elapsed = time - startTime;
          let progress = Math.min(elapsed / duration, 1);
          
          const currentLat = startPos.lat + (newPos.lat - startPos.lat) * progress;
          const currentLng = startPos.lng + (newPos.lng - startPos.lng) * progress;
          
          currentPosRef.current = { lat: currentLat, lng: currentLng };
          
          if (workerMarkerRef.current) {
            workerMarkerRef.current.setPosition(currentPosRef.current);
          }

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            setWorkerPos(newPos);
          }
        };

        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        animationRef.current = requestAnimationFrame(animate);
      };

      socket.on('worker-location', handleLocation); // matches backend emit name

      const staleCheck = setInterval(() => {
        if (Date.now() - lastUpdateRef.current > 15000) {
          setIsStale(true);
        }
      }, 5000);

      return () => {
        socket.off('worker-location', handleLocation);
        clearInterval(staleCheck);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    }
  }, [booking._id, fetchRoute]);

  useEffect(() => {
    if (mapInstance && window.google) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = new window.google.maps.Marker({
          position: destPos,
          map: mapInstance,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#ef4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }
        });
      }

      if (!workerMarkerRef.current && workerPos) {
        workerMarkerRef.current = new window.google.maps.Marker({
          position: workerPos,
          map: mapInstance,
          icon: {
            path: "M17.402,0H5.643C2.526,0,0,3.467,0,6.584v34.804c0,3.116,2.526,5.644,5.643,5.644h11.759c3.116,0,5.644-2.527,5.644-5.644 V6.584C23.044,3.467,20.518,0,17.402,0z",
            fillColor: isStale ? '#94a3b8' : '#2563eb',
            fillOpacity: 1,
            strokeWeight: 0,
            rotation: 0,
            scale: 0.8,
            anchor: new window.google.maps.Point(11.5, 23.5)
          },
          zIndex: 999
        });
      } else if (workerMarkerRef.current) {
        const icon = workerMarkerRef.current.getIcon();
        icon.fillColor = isStale ? '#94a3b8' : '#2563eb';
        workerMarkerRef.current.setIcon(icon);
      }

      if (routePath.length > 0) {
        if (polylineRef.current) polylineRef.current.setMap(null);
        polylineRef.current = new window.google.maps.Polyline({
          path: routePath,
          geodesic: true,
          strokeColor: '#3b82f6',
          strokeOpacity: 0.8,
          strokeWeight: 5,
          map: mapInstance
        });
      }

      if (isAutoFollow && workerPos) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(destPos);
        bounds.extend(workerPos);
        mapInstance.fitBounds(bounds, { bottom: 250, left: 50, right: 50, top: 50 });
      }
    }
  }, [mapInstance, workerPos, routePath, isStale, isAutoFollow, destPos]);

  const handleDrag = () => {
    setIsAutoFollow(false);
  };

  const handleRecenter = () => {
    setIsAutoFollow(true);
    if (mapInstance && workerPos) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(destPos);
      bounds.extend(workerPos);
      mapInstance.fitBounds(bounds, { bottom: 250, left: 50, right: 50, top: 50 });
    }
  };

  return (
    <div style={{ position: 'relative', height: '100dvh', width: '100%', overflow: 'hidden' }}>
      <BaseMap
        center={destPos}
        onLoad={setMapInstance}
        onDragEnd={handleDrag}
        hideRecenter={true} // custom recenter
      />
      
      {!isAutoFollow && (
        <button
          onClick={handleRecenter}
          style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: '#fff', padding: '10px 20px', borderRadius: '20px', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', fontWeight: '700', color: '#2563eb', zIndex: 10, cursor: 'pointer' }}
        >
          Resume Auto-Follow
        </button>
      )}

      {isStale && (
        <div style={{ position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)', background: '#fef08a', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '700', color: '#854d0e', zIndex: 10 }}>
          Signal lost. Last update 15s ago.
        </div>
      )}

      {/* Customer view gets the bottom sheet */}
      {!isWorker && (
        <BottomSheet 
          booking={booking} 
          worker={booking.worker} 
          etaText={etaText}
          onCancel={onCancel}
          onCall={onCall}
        />
      )}

      {/* Worker view gets a simple deep link button */}
      {isWorker && (
        <div style={{ position: 'absolute', bottom: '30px', left: '20px', right: '20px', zIndex: 10 }}>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${destPos.lat},${destPos.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#16a34a', color: '#fff', padding: '15px', borderRadius: '12px', fontWeight: '700', textDecoration: 'none', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(22, 163, 74, 0.3)' }}
          >
            Open in Google Maps ↗
          </a>
        </div>
      )}
    </div>
  );
};

export default LiveTrackingMap;
