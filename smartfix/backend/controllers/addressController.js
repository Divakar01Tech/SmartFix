const { askGroqJSON, aiRateLimiter } = require('../services/aiService');
const { geocodeAddressString, reverseGeocodeGoogle } = require('../services/geocodingService');
const Location = require('../models/Location');
const serviceAreaConfig = require('../config/serviceArea');

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const normalizeAddress = async (req, res) => {
  try {
    const { districtId, talukId, villageId, freeText } = req.body;
    if (!districtId || !talukId || !villageId) {
      return res.status(400).json({ success: false, message: 'Missing location IDs.' });
    }

    const [district, taluk, village] = await Promise.all([
      Location.findById(districtId),
      Location.findById(talukId),
      Location.findById(villageId)
    ]);

    if (!district || !taluk || !village) {
      return res.status(400).json({ success: false, message: 'Invalid location selection.' });
    }

    let doorNo = null;
    let street = null;
    let landmark = null;
    let pincode = village.pincode || null;
    let mentionedPlace = null;
    let mismatchWarning = false;
    let confidence = 50;
    let aiCleaned = false;

    if (freeText && typeof freeText === 'string' && freeText.trim().length > 0) {
      const systemPrompt = `You are an address normalization AI for Tamil Nadu.
The selected verified location is:
- District: ${district.name.en}
- Taluk: ${taluk.name.en}
- Village/Town/City: ${village.name.en}

The user provided this free-text:
Extract ONLY the following fields from the free-text (doorNo, street, landmark, pincode).
Never invent values; use null when unsure.
Understand Tamil script, English, and Tanglish (e.g. "pillaiyar koil pakkam" -> landmark "Near Pillayar Koil").
Detect if the text names a DIFFERENT taluk, village, or town than the selected one (${village.name.en}). If so, return it in mentionedPlace and set mismatchWarning to true.
Reply with JSON ONLY: { "doorNo": string|null, "street": string|null, "landmark": string|null, "pincode": string|null, "mentionedPlace": string|null, "mismatchWarning": boolean, "confidence": number }`;

      try {
        const extracted = await askGroqJSON({
          system: systemPrompt,
          user: `Address text: "${freeText}"`,
          maxTokens: 300,
        });
        
        doorNo = extracted.doorNo || null;
        street = extracted.street || null;
        landmark = extracted.landmark || null;
        if (extracted.pincode) pincode = extracted.pincode;
        mentionedPlace = extracted.mentionedPlace || null;
        mismatchWarning = !!extracted.mismatchWarning;
        confidence = extracted.confidence || 80;
        aiCleaned = true;
      } catch (err) {
        console.warn('AI Address Cleanup Failed:', err.message);
        street = freeText; // Fallback
      }
    }

    // Build query string
    const queryParts = [];
    if (doorNo) queryParts.push(doorNo);
    if (street) queryParts.push(street);
    if (landmark) queryParts.push(landmark);
    queryParts.push(village.name.en);
    queryParts.push(taluk.name.en);
    queryParts.push(district.name.en);
    queryParts.push(serviceAreaConfig.STATE_NAME);
    queryParts.push(serviceAreaConfig.COUNTRY);
    if (pincode) queryParts.push(pincode);

    const queryString = queryParts.join(', ');

    const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GMAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    
    let lat = village.lat;
    let lng = village.lng;
    let needsPinAdjust = true;
    let mapMismatch = false;
    let districtMismatchWarning = false;
    let normalizedAddressEn = `${doorNo ? doorNo + ', ' : ''}${street ? street + ', ' : ''}${landmark ? landmark + ', ' : ''}${village.name.en}, ${taluk.name.en}, ${district.name.en}`;
    let normalizedAddressTa = `${doorNo ? doorNo + ', ' : ''}${street ? street + ', ' : ''}${landmark ? landmark + ', ' : ''}${village.name.ta}, ${taluk.name.ta}, ${district.name.ta}`;

    if (apiKey) {
      const geoRes = await geocodeAddressString(queryString, apiKey);
      if (geoRes && geoRes.geometry?.location) {
        lat = geoRes.geometry.location.lat;
        lng = geoRes.geometry.location.lng;
        if (geoRes.geometry.location_type === 'ROOFTOP' || geoRes.geometry.location_type === 'RANGE_INTERPOLATED') {
          needsPinAdjust = false;
        }

        // Validate state
        const stateObj = geoRes.address_components?.find(c => c.types.includes('administrative_area_level_1'));
        const stateName = (stateObj?.long_name || '').toLowerCase();
        if (!stateName.includes(serviceAreaConfig.STATE_NAME.toLowerCase())) {
          return res.status(400).json({
            success: false,
            message: `Service available only in ${serviceAreaConfig.STATE_NAME}. The geocoded location is outside.`
          });
        }

        // Validate district soft check
        const distObj = geoRes.address_components?.find(c => c.types.includes('administrative_area_level_2') || c.types.includes('locality'));
        const distName = (distObj?.long_name || '').toLowerCase();
        
        let districtMatch = distName.includes(district.name.en.toLowerCase());
        if (!districtMatch && district.aliases) {
          districtMatch = district.aliases.some(alias => distName.includes(alias.toLowerCase()));
        }
        if (!districtMatch) {
          districtMismatchWarning = true;
        }

        // Validate taluk proximity
        if (taluk.lat && taluk.lng) {
          const distKm = haversineDistance(taluk.lat, taluk.lng, lat, lng);
          const maxRadius = taluk.radiusKm || serviceAreaConfig.DEFAULT_TALUK_RADIUS_KM;
          if (distKm > maxRadius) {
            mapMismatch = true;
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      normalizedAddress: { en: normalizedAddressEn, ta: normalizedAddressTa },
      doorNo, street, landmark, pincode,
      lat, lng,
      needsPinAdjust,
      mapMismatch,
      districtMismatchWarning,
      mismatchWarning,
      mentionedPlace,
      confidence,
      aiCleaned,
      districtName: district.name,
      talukName: taluk.name,
      villageName: village.name
    });

  } catch (error) {
    console.error('AI Address Normalization Error:', error);
    res.status(500).json({ success: false, message: 'Failed to normalize address' });
  }
};

const reverseGeocode = async (req, res) => {
  try {
    const { lat, lng, districtId, talukId } = req.body;
    const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GMAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      return res.status(200).json({ success: true, valid: true });
    }

    const geoRes = await reverseGeocodeGoogle(lat, lng, apiKey);
    if (!geoRes) {
      return res.status(400).json({ success: false, message: 'Reverse geocoding failed.' });
    }

    const stateObj = geoRes.address_components?.find(c => c.types.includes('administrative_area_level_1'));
    const stateName = (stateObj?.long_name || '').toLowerCase();
    if (!stateName.includes(serviceAreaConfig.STATE_NAME.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Service available only in ${serviceAreaConfig.STATE_NAME}. Location is outside.`
      });
    }

    let districtMismatchWarning = false;
    let mapMismatch = false;

    if (districtId) {
      const district = await Location.findById(districtId);
      const distObj = geoRes.address_components?.find(c => c.types.includes('administrative_area_level_2') || c.types.includes('locality'));
      const distName = (distObj?.long_name || '').toLowerCase();
      
      let districtMatch = distName.includes(district.name.en.toLowerCase());
      if (!districtMatch && district.aliases) {
        districtMatch = district.aliases.some(alias => distName.includes(alias.toLowerCase()));
      }
      if (!districtMatch) {
        districtMismatchWarning = true;
      }
    }

    if (talukId) {
      const taluk = await Location.findById(talukId);
      if (taluk && taluk.lat && taluk.lng) {
        const distKm = haversineDistance(taluk.lat, taluk.lng, lat, lng);
        const maxRadius = taluk.radiusKm || serviceAreaConfig.DEFAULT_TALUK_RADIUS_KM;
        if (distKm > maxRadius) {
          mapMismatch = true;
        }
      }
    }

    res.status(200).json({
      success: true,
      valid: true,
      address: geoRes.formatted_address,
      districtMismatchWarning,
      mapMismatch
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during reverse geocoding.' });
  }
};

const confirmAddress = async (req, res) => {
  try {
    const { districtId, talukId, villageId, lat, lng, doorNo, street, landmark, pincode, normalizedAddress, aiCleaned } = req.body;
    
    // Strict verification
    const [district, taluk, village] = await Promise.all([
      Location.findById(districtId),
      Location.findById(talukId),
      Location.findById(villageId)
    ]);

    if (!district || !taluk || !village) {
      return res.status(400).json({ success: false, code: 'INVALID_HIERARCHY', message: 'Invalid location selection.' });
    }

    if (taluk.parentId.toString() !== district._id.toString() || village.parentId.toString() !== taluk._id.toString()) {
      return res.status(400).json({ success: false, code: 'INVALID_HIERARCHY', message: 'Hierarchy mismatch.' });
    }

    if (!district.isServiceActive) {
      return res.status(400).json({ success: false, code: 'DISTRICT_NOT_ACTIVE', message: `Service is not active in ${district.name.en}.` });
    }

    let districtMismatchWarning = false;
    let mapMismatch = false;

    const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GMAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      const geoRes = await reverseGeocodeGoogle(lat, lng, apiKey);
      if (geoRes) {
        const stateObj = geoRes.address_components?.find(c => c.types.includes('administrative_area_level_1'));
        const stateName = (stateObj?.long_name || '').toLowerCase();
        if (!stateName.includes(serviceAreaConfig.STATE_NAME.toLowerCase())) {
          return res.status(400).json({
            success: false,
            message: `Service available only in ${serviceAreaConfig.STATE_NAME}.`
          });
        }
        
        const distObj = geoRes.address_components?.find(c => c.types.includes('administrative_area_level_2') || c.types.includes('locality'));
        const distName = (distObj?.long_name || '').toLowerCase();
        let districtMatch = distName.includes(district.name.en.toLowerCase());
        if (!districtMatch && district.aliases) {
          districtMatch = district.aliases.some(alias => distName.includes(alias.toLowerCase()));
        }
        if (!districtMatch) districtMismatchWarning = true;
      }
    }

    if (taluk.lat && taluk.lng) {
      const distKm = haversineDistance(taluk.lat, taluk.lng, lat, lng);
      const maxRadius = taluk.radiusKm || serviceAreaConfig.DEFAULT_TALUK_RADIUS_KM;
      if (distKm > maxRadius) {
        mapMismatch = true;
      }
    }

    const structuredAddress = {
      districtId, talukId, villageId,
      districtName: district.name,
      districtZone: district.zone,
      talukName: taluk.name,
      villageName: village.name,
      doorNo, street, landmark, pincode,
      lat, lng,
      normalizedAddress,
      source: "dropdown+ai+map",
      mapVerified: true,
      aiCleaned: !!aiCleaned,
      districtMismatchWarning,
      mapMismatch
    };

    res.status(200).json({ success: true, structuredAddress });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Error confirming address.' });
  }
};

module.exports = {
  normalizeAddress,
  reverseGeocode,
  confirmAddress
};
