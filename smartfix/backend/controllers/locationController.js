const WorkerLocation = require('../models/WorkerLocation');
const User = require('../models/User');

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
      let district = '';
      let taluk = '';
      const result = data.results[0];
      
      result.address_components.forEach(comp => {
        if (comp.types.includes('administrative_area_level_2')) district = comp.long_name;
        if (comp.types.includes('administrative_area_level_3')) taluk = comp.long_name;
        if (!district && comp.types.includes('locality')) district = comp.long_name;
      });

      const distLower = district.toLowerCase().replace(/\s/g, '');
      const talukLower = taluk.toLowerCase().replace(/\s/g, '');
      const SIVAGANGAI_ALIASES = ['sivaganga', 'sivagangai'];
      const VALID_TALUKS = ['sivaganga', 'karaikudi', 'devakottai', 'manamadurai', 'thirupuvanam', 'ilaiyankudi', 'kalaiyarkoil', 'thirupathur', 'tirupathur'];
      
      const isDistValid = SIVAGANGAI_ALIASES.some(a => distLower.includes(a));
      const isTalukValid = talukLower === '' || VALID_TALUKS.some(t => talukLower.includes(t));

      if (isDistValid && isTalukValid) {
        return res.status(200).json({ isValid: true });
      } else {
        return res.status(200).json({ 
          isValid: false, 
          message: 'Service available only in Sivagangai District / சிவகங்கை மாவட்டத்தில் மட்டுமே சேவை உள்ளது',
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
