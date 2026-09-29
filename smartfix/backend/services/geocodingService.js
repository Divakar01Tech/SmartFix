const https = require('https');
const { SIVAGANGAI_TALUKS } = require('../config/serviceCategories');

// Sivagangai District bounding box — synced with frontend mapStyle.js
const SIVAGANGAI_BOUNDS = {
  minLat: 9.68,
  maxLat: 10.33,
  minLng: 78.10,
  maxLng: 78.91,
};

/**
 * Checks whether a given lat/lng pair falls within Sivagangai District.
 * Uses bounding box check + OpenStreetMap Nominatim reverse geocoding.
 *
 * @param {Number} lat
 * @param {Number} lng
 * @param {String} addressText Optional address string
 * @returns {Promise<{ valid: Boolean, message?: String, resolvedDistrict?: String }>}
 */
async function validateSivagangaiLocation(lat, lng, addressText = '') {
  const pLat = Number(lat);
  const pLng = Number(lng);

  // 1. Text-based taluk / district check if provided
  if (addressText && typeof addressText === 'string') {
    const textLower = addressText.toLowerCase();
    const matchesTaluk = SIVAGANGAI_TALUKS.some((t) => textLower.includes(t.toLowerCase()));
    const matchesDistrict = textLower.includes('sivaganga') || textLower.includes('sivagangai');
    if (matchesTaluk || matchesDistrict) {
      return { valid: true, resolvedDistrict: 'Sivagangai' };
    }
  }

  // 2. Bounding box check for coordinates
  if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
    if (
      pLat < SIVAGANGAI_BOUNDS.minLat ||
      pLat > SIVAGANGAI_BOUNDS.maxLat ||
      pLng < SIVAGANGAI_BOUNDS.minLng ||
      pLng > SIVAGANGAI_BOUNDS.maxLng
    ) {
      return {
        valid: false,
        message: '📍 Location is outside Sivagangai District. SmartFix service is currently available only in Sivagangai District.',
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
          const isSivagangai = distName.includes('sivaganga') || distName.includes('sivagangai');
          if (!isSivagangai && distName) {
            return {
              valid: false,
              message: `📍 Resolved location (${districtObj.long_name}) is outside Sivagangai District.`,
            };
          }
        }
      } else {
        const geoResult = await reverseGeocodeNominatim(pLat, pLng);
        if (geoResult) {
          const districtName = (geoResult.county || geoResult.state_district || geoResult.district || geoResult.display_name || '').toLowerCase();
          const isSivagangai = districtName.includes('sivaganga') || districtName.includes('sivagangai');
          if (!isSivagangai && (geoResult.county || geoResult.state_district)) {
            return {
              valid: false,
              message: `📍 Resolved location (${geoResult.county || geoResult.state_district}) is outside Sivagangai District.`,
            };
          }
        }
      }
    } catch (err) {
      console.warn('Reverse geocoding network notice:', err.message);
    }

    return { valid: true, resolvedDistrict: 'Sivagangai' };
  }

  // If no lat/lng provided, check address text again or fallback
  if (addressText) {
    const isSivagangai = SIVAGANGAI_TALUKS.some((t) => addressText.toLowerCase().includes(t.toLowerCase())) ||
      addressText.toLowerCase().includes('sivaganga') ||
      addressText.toLowerCase().includes('sivagangai');

    if (!isSivagangai) {
      return {
        valid: false,
        message: '📍 Address must be within Sivagangai District (Sivagangai, Karaikudi, Devakottai, Manamadurai, Ilayangudi, Singampunari, Tirupattur, Kalayarkoil).',
      };
    }
    return { valid: true, resolvedDistrict: 'Sivagangai' };
  }

  return {
    valid: false,
    message: '📍 Valid location coordinates or address in Sivagangai District are required.',
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
 * Validates handyman registration taluk location
 */
function validateHandymanTaluk(locationText) {
  if (!locationText || typeof locationText !== 'string') {
    return {
      valid: false,
      message: `Handyman registration is restricted to Sivagangai District. Please specify one of the valid taluks: ${SIVAGANGAI_TALUKS.join(', ')}.`,
    };
  }
  const locLower = locationText.toLowerCase();
  const matchedTaluk = SIVAGANGAI_TALUKS.find((t) => locLower.includes(t.toLowerCase()));
  if (!matchedTaluk && !locLower.includes('sivaganga') && !locLower.includes('sivagangai')) {
    return {
      valid: false,
      message: `Handyman signup is restricted to Sivagangai District taluks only: ${SIVAGANGAI_TALUKS.join(', ')}.`,
    };
  }
  return { valid: true, taluk: matchedTaluk || 'Sivagangai' };
}

module.exports = {
  SIVAGANGAI_BOUNDS,
  validateSivagangaiLocation,
  validateHandymanTaluk,
};
