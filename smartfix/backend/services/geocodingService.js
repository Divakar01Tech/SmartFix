const https = require('https');
const { TAMILNADU_TALUKS } = require('../config/serviceCategories');

// Tamil Nadu bounding box — synced with frontend mapStyle.js
const TAMILNADU_BOUNDS = {
  minLat: 8.0,
  maxLat: 13.5,
  minLng: 76.2,
  maxLng: 80.3,
};

/**
 * Checks whether a given lat/lng pair falls within Tamil Nadu.
 * Uses bounding box check + OpenStreetMap Nominatim reverse geocoding.
 *
 * @param {Number} lat
 * @param {Number} lng
 * @param {String} addressText Optional address string
 * @returns {Promise<{ valid: Boolean, message?: String, resolvedDistrict?: String }>}
 */
async function validateTamilNaduLocation(lat, lng, addressText = '') {
  const pLat = Number(lat);
  const pLng = Number(lng);

  // 1. Text-based taluk / district check if provided
  if (addressText && typeof addressText === 'string') {
    const textLower = addressText.toLowerCase().replace(/\s/g, '');
    const matchesDistrict = textLower.includes('tamilnadu');
    if (matchesDistrict) {
      return { valid: true, resolvedDistrict: 'Tamil Nadu' };
    }
  }

  // 2. Bounding box check for coordinates
  if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
    if (
      pLat < TAMILNADU_BOUNDS.minLat ||
      pLat > TAMILNADU_BOUNDS.maxLat ||
      pLng < TAMILNADU_BOUNDS.minLng ||
      pLng > TAMILNADU_BOUNDS.maxLng
    ) {
      return {
        valid: false,
        message: '📍 Location is outside Tamil Nadu. SmartFix service is currently available only in Tamil Nadu.',
      };
    }

    // 3. Geocode check via Google Maps API (administrative_area_level_2) or OpenStreetMap Nominatim
    try {
      const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GMAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const googleRes = await reverseGeocodeGoogle(pLat, pLng, apiKey);
        if (googleRes) {
          const districtObj = googleRes.address_components?.find((c) =>
            c.types.includes('administrative_area_level_2') || c.types.includes('administrative_area_level_1')
          );
          const distName = (districtObj?.long_name || '').toLowerCase();
          const isTamilNadu = distName.includes('tamil nadu');
          if (!isTamilNadu && distName) {
            return {
              valid: false,
              message: `📍 Resolved location (${districtObj.long_name}) is outside Tamil Nadu.`,
            };
          }
        }
      } else {
        const geoResult = await reverseGeocodeNominatim(pLat, pLng);
        if (geoResult) {
          const districtName = (geoResult.county || geoResult.state_district || geoResult.district || geoResult.display_name || '').toLowerCase();
          const isTamilNadu = districtName.includes('tamil nadu');
          if (!isTamilNadu && (geoResult.county || geoResult.state_district || geoResult.state)) {
            return {
              valid: false,
              message: `📍 Resolved location (${geoResult.county || geoResult.state_district}) is outside Tamil Nadu.`,
            };
          }
        }
      }
    } catch (err) {
      console.warn('Reverse geocoding network notice:', err.message);
    }

    return { valid: true, resolvedDistrict: 'Tamil Nadu' };
  }

  // If no lat/lng provided, check address text again or fallback
  if (addressText) {
    const isTamilNadu = addressText.toLowerCase().replace(/\s/g, '').includes('tamilnadu');

    if (!isTamilNadu) {
      return {
        valid: false,
        message: '📍 Address must be within Tamil Nadu.',
      };
    }
    return { valid: true, resolvedDistrict: 'Tamil Nadu' };
  }

  return {
    valid: false,
    message: '📍 Valid location coordinates or address in Tamil Nadu are required.',
  };
}

/**
 * Perform HTTPS request to OpenStreetMap Nominatim API for reverse geocoding
 */
function reverseGeocodeNominatim(lat, lng) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const req = https.get(
      url,
      {
        headers: { 'User-Agent': 'SmartFixApp/1.0 (contact@smartfix.com)' },
        timeout: 3500,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(data?.address ? { ...data.address, display_name: data.display_name } : null);
          } catch (e) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Perform HTTPS request to Google Maps Reverse Geocoding API for administrative_area_level_2 district check
 */
function reverseGeocodeGoogle(lat, lng, apiKey) {
  return new Promise((resolve) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const req = https.get(url, { timeout: 3500 }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data?.results?.[0] || null);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Perform HTTPS request to Google Maps Geocoding API for forward geocoding
 */
function geocodeAddressString(address, apiKey) {
  return new Promise((resolve) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const req = https.get(url, { timeout: 3500 }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data?.results?.[0] || null);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Validates handyman registration taluk location
 */
function validateHandymanTaluk(locationText) {
  if (!locationText || typeof locationText !== 'string') {
    return {
      valid: false,
      message: `Handyman registration is restricted to Tamil Nadu.`,
    };
  }
  const locLower = locationText.toLowerCase().replace(/\s/g, '');
  if (!locLower.includes('tamilnadu')) {
    return {
      valid: false,
      message: `Handyman signup is restricted to Tamil Nadu only.`,
    };
  }
  return { valid: true, taluk: 'Tamil Nadu' };
}

module.exports = {
  TAMILNADU_BOUNDS,
  validateTamilNaduLocation,
  validateHandymanTaluk,
  reverseGeocodeGoogle,
  reverseGeocodeNominatim,
  geocodeAddressString,
};
