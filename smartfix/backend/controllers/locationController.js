const WorkerLocation = require('../models/WorkerLocation');
const User = require('../models/User');
const Location = require('../models/Location');

// @route GET /api/locations/districts
// @desc Get all districts
exports.getDistricts = async (req, res) => {
  try {
    const districts = await Location.find({ level: 'district' })
      .select('id name slug isServiceActive zone aliases lat lng')
      .sort({ 'name.en': 1 });
    res.status(200).json(districts);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching districts', error: err.message });
  }
};

// @route GET /api/locations/districts/:id/taluks
// @desc Get all taluks for a given district
exports.getTaluksByDistrict = async (req, res) => {
  try {
    const taluks = await Location.find({ level: 'taluk', parentId: req.params.id })
      .select('id name slug parentId radiusKm zoneOverride')
      .sort({ 'name.en': 1 });
    res.status(200).json(taluks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching taluks', error: err.message });
  }
};

// @route GET /api/locations/taluks/:id/villages?q=
// @desc Search villages by taluk id and query prefix
exports.searchVillagesByTaluk = async (req, res) => {
  try {
    const { q } = req.query;
    let query = { level: 'village', parentId: req.params.id };

    if (q && q.length >= 2) {
      const regex = new RegExp('^' + q, 'i');
      query.$or = [
        { 'name.en': regex },
        { 'name.ta': regex }
      ];
    }

    const villages = await Location.find(query)
      .select('id name slug kind lat lng pincode isActive')
      .sort({ 'name.en': 1 });

    res.status(200).json(villages);
  } catch (err) {
    res.status(500).json({ message: 'Error searching villages', error: err.message });
  }
};

// @route GET /api/location/worker/:workerId
// @desc Get current worker location
exports.getWorkerLocation = async (req, res) => {
  try {
    const worker = await User.findById(req.params.workerId).select('name trade lat lng locationUpdatedAt isAvailable');
    if (!worker) return res.status(404).json({ message: 'Worker not found' });
    res.status(200).json({ worker });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch worker location', error: err.message });
  }
};

// @route GET /api/location/history/:bookingId
// @desc Get historical GPS breadcrumbs for a booking
exports.getBookingLocationHistory = async (req, res) => {
  try {
    const history = await WorkerLocation.find({ booking: req.params.bookingId })
      .sort('createdAt')
      .limit(200);
    res.status(200).json({ history });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch location history', error: err.message });
  }
};

const rateLimitMap = new Map();

// @route POST /api/location/validate
// @desc Server-side validation of GPS coordinates for district boundary
exports.validateLocation = async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, []);
    const userLimits = rateLimitMap.get(ip).filter(t => now - t < 60000); // 1 min window
    if (userLimits.length > 20) {
      return res.status(429).json({ isValid: false, message: 'Too many requests. Please try again later.' });
    }
    userLimits.push(now);
    rateLimitMap.set(ip, userLimits);

    const { lat, lng } = req.body;
    if (!lat || !lng) return res.status(400).json({ isValid: false, message: 'Missing coordinates' });

    const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GMAPS_API_KEY;
    if (!serverKey) return res.status(200).json({ isValid: true, message: 'Bypassed validation due to missing key' });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${serverKey}`;
    const geocodeRes = await fetch(url);
    const data = await geocodeRes.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      let state = '';
      let district = '';
      let taluk = '';
      const result = data.results[0];
      
      result.address_components.forEach(comp => {
        if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
        if (comp.types.includes('administrative_area_level_2')) district = comp.long_name;
        if (comp.types.includes('administrative_area_level_3')) taluk = comp.long_name;
        if (!district && comp.types.includes('locality')) district = comp.long_name;
      });

      const stateLower = state.toLowerCase().replace(/\s/g, '');
      const isStateValid = stateLower.includes('tamilnadu');

      if (isStateValid) {
        return res.status(200).json({ isValid: true });
      } else {
        return res.status(200).json({ 
          isValid: false, 
          message: 'Service available only in Tamil Nadu / தமிழ்நாட்டில் மட்டுமே சேவை உள்ளது',
          state,
          district,
          taluk
        });
      }
    }
    
    return res.status(200).json({ isValid: false, message: 'Geocode failed' });
  } catch (err) {
    res.status(500).json({ isValid: false, message: 'Server validation error', error: err.message });
  }
};
