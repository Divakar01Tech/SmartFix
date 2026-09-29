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
    query['identity.status'] = 'verified';

    const workers = await User.find(query)
      .select('trade subServices rating currentLocation _id') // only needed fields
      .lean();

    // Anonymize response
    const anonymizedWorkers = workers.map((worker) => {
      const dist = calculateDistance(Number(lat), Number(lng), worker.currentLocation.coordinates[1], worker.currentLocation.coordinates[0]);
      // Round to nearest 0.5 km
      const approxDistanceKm = Math.round(dist * 2) / 2;

      return {
        workerId: worker._id, // internal reference
        category: worker.trade,
        subServices: worker.subServices,
        rating: worker.rating,
        approxDistanceKm: approxDistanceKm || 0.5 // if 0, show ~0.5km
      };
    });

    res.json({ success: true, workers: anonymizedWorkers });
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
