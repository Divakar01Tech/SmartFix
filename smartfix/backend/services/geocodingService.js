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
const TN_DISTRICTS_LIST = [
  'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore', 'Dharmapuri',
  'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram', 'Kanyakumari', 'Karur',
  'Krishnagiri', 'Madurai', 'Mayiladuthurai', 'Nagapattinam', 'Namakkal', 'Nilgiris',
  'Perambalur', 'Pudukkottai', 'Ramanathapuram', 'Ranipet', 'Salem', 'Sivagangai',
  'Tenkasi', 'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
  'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur', 'Vellore',
  'Viluppuram', 'Virudhunagar'
];

const OTHER_INDIAN_STATES = [
  'karnataka', 'kerala', 'andhra pradesh', 'telangana', 'maharashtra',
  'delhi', 'uttar pradesh', 'gujarat', 'rajasthan', 'madhya pradesh',
  'west bengal', 'bihar', 'punjab', 'haryana', 'odisha'
];

/**
 * Checks whether a given lat/lng pair or address falls within Tamil Nadu.
 * Validates administrative_area_level_1 is Tamil Nadu and extracts administrative_area_level_2 district.
 *
 * @param {Number} lat
 * @param {Number} lng
 * @param {String} addressText Optional address string
 * @returns {Promise<{ valid: Boolean, message?: String, state?: String, district?: String, resolvedDistrict?: String }>}
 */
async function validateTamilNaduLocation(lat, lng, addressText = '') {
  const pLat = Number(lat);
  const pLng = Number(lng);
  const text = (addressText || '').trim();
  const textLower = text.toLowerCase();

  // 1. Check if the address explicitly names another state
  if (text) {
    const isOtherState = OTHER_INDIAN_STATES.some(st => textLower.includes(st));
    const mentionsTN = textLower.includes('tamil nadu') || textLower.includes('tamilnadu');
    if (isOtherState && !mentionsTN) {
      return {
        valid: false,
        message: '📍 Selected address is outside Tamil Nadu. SmartFix services are strictly restricted to Tamil Nadu.',
      };
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
        message: '📍 Location coordinates are outside Tamil Nadu. SmartFix service is currently available only in Tamil Nadu.',
      };
    }

    // 3. Geocode check via Google Maps API (administrative_area_level_1 and administrative_area_level_2)
    let extractedDistrict = 'Sivagangai';
    let extractedState = 'Tamil Nadu';

    try {
      const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GMAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const googleRes = await reverseGeocodeGoogle(pLat, pLng, apiKey);
        if (googleRes) {
          const stateObj = googleRes.address_components?.find((c) =>
            c.types.includes('administrative_area_level_1')
          );
          const districtObj = googleRes.address_components?.find((c) =>
            c.types.includes('administrative_area_level_2')
          );

          if (stateObj && stateObj.long_name !== 'Tamil Nadu') {
            return {
              valid: false,
              message: `📍 Resolved location (${stateObj.long_name}) is outside Tamil Nadu. SmartFix operates exclusively within Tamil Nadu.`,
            };
          }

          if (districtObj?.long_name) {
            extractedDistrict = districtObj.long_name.replace(/ district/i, '').trim();
          }
        }
      } else {
        const geoResult = await reverseGeocodeNominatim(pLat, pLng);
        if (geoResult) {
          const stateName = (geoResult.state || '').toLowerCase();
          if (stateName && !stateName.includes('tamil nadu')) {
            return {
              valid: false,
              message: `📍 Resolved location (${geoResult.state}) is outside Tamil Nadu. SmartFix operates exclusively within Tamil Nadu.`,
            };
          }
          if (geoResult.county || geoResult.state_district || geoResult.district) {
            extractedDistrict = (geoResult.county || geoResult.state_district || geoResult.district)
              .replace(/ district/i, '')
              .trim();
          }
        }
      }
    } catch (err) {
      console.warn('Reverse geocoding notice:', err.message);
    }

    // Fallback: check if address text mentions a known district
    for (const dist of TN_DISTRICTS_LIST) {
      if (textLower.includes(dist.toLowerCase())) {
        extractedDistrict = dist;
        break;
      }
    }

    return {
      valid: true,
      state: extractedState,
      district: extractedDistrict,
      resolvedDistrict: extractedDistrict,
    };
  }

  // 4. If no coordinates provided, check address text
  if (text) {
    const isOtherState = OTHER_INDIAN_STATES.some(st => textLower.includes(st));
    const mentionsTN = textLower.includes('tamil nadu') || textLower.includes('tamilnadu');
    const matchedDistrict = TN_DISTRICTS_LIST.find(d => textLower.includes(d.toLowerCase()));

    if (isOtherState && !mentionsTN) {
      return {
        valid: false,
        message: '📍 Address is outside Tamil Nadu. SmartFix is available exclusively in Tamil Nadu.',
      };
    }

    if (!mentionsTN && !matchedDistrict) {
      return {
        valid: false,
        message: '📍 Address must be within Tamil Nadu. Please specify a valid Tamil Nadu district or location.',
      };
    }

    const resolvedDistrict = matchedDistrict || 'Sivagangai';
    return {
      valid: true,
      state: 'Tamil Nadu',
      district: resolvedDistrict,
      resolvedDistrict,
    };
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
