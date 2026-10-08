const User = require('../models/User');

// GET /api/customer/nearby-workers
// Fetch anonymized available workers within a radius
exports.getNearbyWorkers = async (req, res) => {
  try {
    const { lat, lng, category, radius = 5000 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    // Cap the radius at 5000 meters (5km)
    const searchRadius = Math.min(Number(radius), 5000);

    const query = {
      role: 'handyman',
      availabilityStatus: 'Available',
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(lng), Number(lat)]
          },
          $maxDistance: searchRadius
        }
      }
    };

    if (category) {
      query.trade = category;
    }

    // Add general verification constraints for available workers
    query.overallStatus = 'approved';

    // Exclude demo workers from real customer results unless SHOW_DEMO_DATA env flag is set
    if (process.env.SHOW_DEMO_DATA !== 'true') {
      query.isDemo = { $ne: true };
    }

    const workers = await User.find(query)
      .select('trade subServices rating ratingCount currentLocation lat lng _id overallStatus availabilityStatus jobsOffered jobsAccepted') 
      .lean();

    const { rankWorkers } = require('../services/matchingService');
    const bookingPayload = {
      userLat: Number(lat),
      userLng: Number(lng),
      subServices: category ? [category] : [] // If category was passed, assume it's the required subService for matching
    };

    const rankedWorkers = await rankWorkers(workers, bookingPayload);

    res.json({ success: true, workers: rankedWorkers });
  } catch (error) {
    console.error('Error fetching nearby workers:', error);
    res.status(500).json({ success: false, message: 'Server error fetching nearby workers' });
  }
};

// POST /api/worker/availability
// Update availability and current location
exports.updateAvailability = async (req, res) => {
  try {
    const { lat, lng, status } = req.body;
    
    // Status can be Available, Busy, Offline
    const update = {};
    if (status) {
      update.availabilityStatus = status;
    }

    if (lat && lng && (status === 'Available' || !status)) {
      update.currentLocation = {
        type: 'Point',
        coordinates: [Number(lng), Number(lat)]
      };
    }

    await User.findByIdAndUpdate(req.user.id, update);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({ success: false, message: 'Server error updating availability' });
  }
};

// Haversine distance helper
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
