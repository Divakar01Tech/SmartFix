const Booking = require('../models/Booking');

// Note: Ensure a Google Cloud billing budget alert is set since this calls the Directions API.

const rateLimitMap = new Map();
const routeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// @route POST /api/maps/route
// @desc Fetch directions route from server-side using Directions API to keep API key hidden
exports.getRoute = async (req, res) => {
  try {
    const userId = req.user ? req.user._id.toString() : req.ip;
    const now = Date.now();
    if (!rateLimitMap.has(userId)) rateLimitMap.set(userId, []);
    const userLimits = rateLimitMap.get(userId).filter(t => now - t < 60000); // 1 min window
    if (userLimits.length > 30) {
      return res.status(429).json({ success: false, message: 'Too many route requests. Please try again later.' });
    }
    userLimits.push(now);
    rateLimitMap.set(userId, userLimits);

    const { bookingId, origin, destination } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ success: false, message: 'Missing origin or destination' });
    }

    // Authenticate: only parties of that booking can fetch the route
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      
      const isCustomer = booking.customer.toString() === req.user._id.toString();
      const isWorker = booking.worker && booking.worker.toString() === req.user._id.toString();
      
      if (!isCustomer && !isWorker) {
        return res.status(403).json({ success: false, message: 'Not authorized for this route' });
      }
    }

    const cacheKey = bookingId ? `route_${bookingId}` : `route_${origin.lat}_${origin.lng}_${destination.lat}_${destination.lng}`;
    if (routeCache.has(cacheKey)) {
      const cached = routeCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return res.status(200).json(cached.data);
      }
    }

    const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GMAPS_API_KEY;
    if (!serverKey) {
      return res.status(500).json({ success: false, message: 'Server maps key missing' });
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${serverKey}`;
    
    const directionsRes = await fetch(url);
    const data = await directionsRes.json();

    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      
      const responseData = {
        success: true,
        polyline: route.overview_polyline.points,
        durationText: leg.duration.text,
        durationValue: leg.duration.value,
        distanceText: leg.distance.text,
        distanceValue: leg.distance.value
      };

      routeCache.set(cacheKey, { timestamp: Date.now(), data: responseData });

      return res.status(200).json(responseData);
    }

    return res.status(400).json({ success: false, message: 'Could not find a route' });
  } catch (error) {
    console.error('Error fetching route:', error.message);
    res.status(500).json({ success: false, message: 'Server error fetching route' });
  }
};
