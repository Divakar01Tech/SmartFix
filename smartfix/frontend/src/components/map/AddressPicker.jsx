import React, { useState, useEffect, useRef, useCallback } from 'react';
import BaseMap from './BaseMap';
import { TAMILNADU_CENTER, TAMILNADU_BOUNDS } from './mapStyle';
import { Autocomplete } from '@react-google-maps/api';
import { MapPin, Search, CheckCircle2, AlertTriangle, Navigation } from 'lucide-react';
import { apiService, getApiBase } from '../../services/api';

const TAMILNADU_ALIASES = ['tamilnadu', 'tamil nadu'];

const AddressPicker = ({ onConfirm, initialLocation }) => {
  const [mapInstance, setMapInstance] = useState(null);
  const [center, setCenter] = useState(initialLocation || TAMILNADU_CENTER);
  const [addressDetails, setAddressDetails] = useState({ formattedAddress: '', taluk: '', district: '' });
  const [landmark, setLandmark] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValidLocation, setIsValidLocation] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [autocomplete, setAutocomplete] = useState(null);
  
  const geocoderRef = useRef(null);
  const timeoutRef = useRef(null);
  const centerPointRef = useRef(center);

  useEffect(() => {
    if (!initialLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => setValidationError('Location access denied. Please drag the map manually. / இருப்பிட அணுகல் மறுக்கப்பட்டது. வரைபடத்தை நகர்த்தவும்.')
        );
      }
    }
  }, [initialLocation]);

  const validateServerSide = async (lat, lng, addressData) => {
    try {
      const token = localStorage.getItem('smartfix_token');
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/location/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ lat, lng })
      });
      const data = await res.json();
      return data.isValid;
    } catch (e) {
      console.warn('Server validation failed, falling back to client:', e);
      // Fallback to client check
      const state = (addressData.state || '').toLowerCase().replace(/\s/g, '');
      const district = (addressData.district || '').toLowerCase();
      const isStateValid = TAMILNADU_ALIASES.some(a => state.includes(a.replace(/\s/g, '')));
      // As a fallback, if we can't reliably get state, we assume valid if they picked something
      return isStateValid || (district && district.length > 3);
    }
  };

  const reverseGeocode = useCallback(async (latLngObj) => {
    if (!window.google) return;
    if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder();
    
    setIsValidating(true);
    try {
      const response = await geocoderRef.current.geocode({ location: latLngObj });
      if (response.results && response.results.length > 0) {
        const result = response.results[0];
        let district = '';
        let taluk = '';
        
        result.address_components.forEach(comp => {
          if (comp.types.includes('administrative_area_level_2')) district = comp.long_name;
          if (comp.types.includes('administrative_area_level_3')) taluk = comp.long_name;
          if (!district && comp.types.includes('locality')) district = comp.long_name;
        });

        const distLower = district.toLowerCase().replace(/\s/g, '');
        const clientValidDist = TAMILNADU_ALIASES.some(a => distLower.includes(a));

        if (!clientValidDist) {
          setIsValidLocation(false);
          setValidationError('Service available only in Tamil Nadu / சிவகங்கை மாவட்டத்தில் மட்டுமே சேவை உள்ளது');
          setAddressDetails({ formattedAddress: result.formatted_address, district, taluk });
          setIsValidating(false);
          return;
        }

        // Server validation (double check)
        const serverValid = await validateServerSide(latLngObj.lat, latLngObj.lng, { district, taluk });
        
        if (serverValid) {
          setIsValidLocation(true);
          setValidationError('');
        } else {
          setIsValidLocation(false);
          setValidationError('Location outside service area / உங்கள் பகுதி சேவைக்கு வெளியே உள்ளது');
        }
        
        setAddressDetails({ formattedAddress: result.formatted_address, district, taluk });
      }
    } catch (e) {
      setIsValidLocation(false);
      setValidationError('Could not find address details / முகவரியை கண்டுபிடிக்க முடியவில்லை');
    }
    setIsValidating(false);
  }, []);

  const handleIdle = () => {
    if (!mapInstance) return;
    const newCenter = mapInstance.getCenter();
    const latLngObj = { lat: newCenter.lat(), lng: newCenter.lng() };
    centerPointRef.current = latLngObj;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      reverseGeocode(latLngObj);
    }, 600); // Debounce 600ms
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setCenter({ lat, lng });
        if (mapInstance) {
          mapInstance.panTo({ lat, lng });
          mapInstance.setZoom(16);
        }
      }
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Search Bar Overlay */}
      <div style={{ position: 'absolute', top: 15, left: 15, right: 15, zIndex: 10 }}>
        <Autocomplete
          onLoad={(ac) => setAutocomplete(ac)}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: 'in' },
            bounds: TAMILNADU_BOUNDS,
            strictBounds: true
          }}
        >
          <div style={{ display: 'flex', background: '#fff', borderRadius: '8px', padding: '10px 15px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <Search size={20} color="#64748b" style={{ marginRight: '10px', marginTop: '2px' }} />
            <input
              type="text"
              placeholder="Search address... / முகவரியை தேடவும்..."
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '15px' }}
            />
          </div>
        </Autocomplete>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <BaseMap 
          center={center}
          zoom={15}
          onLoad={(map) => setMapInstance(map)}
          onIdle={handleIdle}
          hideRecenter={false}
        />
        
        {/* Fixed Center Pin Overlay */}
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -100%)', 
          zIndex: 5,
          pointerEvents: 'none'
        }}>
          <MapPin size={40} color={isValidLocation ? "#2563eb" : "#ef4444"} fill={isValidLocation ? "#dbeafe" : "#fee2e2"} strokeWidth={1.5} />
          <div style={{ 
            width: '8px', 
            height: '8px', 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: '50%', 
            margin: '0 auto', 
            marginTop: '-4px' 
          }}></div>
        </div>
      </div>

      {/* Bottom Card */}
      <div style={{ background: '#fff', padding: '20px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', boxShadow: '0 -4px 15px rgba(0,0,0,0.05)', zIndex: 10 }}>
        {isValidating ? (
          <div style={{ textAlign: 'center', padding: '10px', color: '#64748b' }}>Locating... / இருப்பிடம் தேடப்படுகிறது...</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '15px' }}>
              <div style={{ marginTop: '4px' }}>
                {isValidLocation ? <CheckCircle2 size={24} color="#16a34a" /> : <AlertTriangle size={24} color="#dc2626" />}
              </div>
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '1rem', marginBottom: '4px' }}>
                  {addressDetails.formattedAddress || 'Drag map to select location'}
                </div>
                {validationError && (
                  <div style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: '500' }}>
                    {validationError}
                  </div>
                )}
              </div>
            </div>

            <input
              type="text"
              className="form-control mb-3"
              placeholder="Landmark (Optional) / அடையாளம் (விருப்பத்தேர்வு)"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              style={{ borderRadius: '8px', padding: '12px' }}
            />

            <button
              onClick={() => onConfirm({
                lat: centerPointRef.current.lat,
                lng: centerPointRef.current.lng,
                formattedAddress: addressDetails.formattedAddress,
                landmark,
                taluk: addressDetails.taluk
              })}
              disabled={!isValidLocation}
              style={{
                width: '100%',
                padding: '14px',
                background: isValidLocation ? '#2563eb' : '#94a3b8',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '1rem'
              }}
            >
              Confirm Location
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AddressPicker;
