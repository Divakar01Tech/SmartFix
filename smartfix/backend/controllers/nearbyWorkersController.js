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
      role: { $in: ['handyman', 'worker'] },
      $or: [
        { availabilityStatus: { $in: ['Available', 'available'] } },
        { isAvailable: true },
        { availability: 'available' },
      ],
      $or: [
        { verificationStatus: { $in: ['approved', 'Verified', 'verified'] } },
        { overallStatus: 'approved' },
      ],
    };

    if (lat && lng) {
      query.currentLocation = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(lng), Number(lat)],
          },
          $maxDistance: searchRadius,
        },
      };
    }

    if (category) {
      query.trade = category;
    }

    // Exclude demo workers from real customer results unless SHOW_DEMO_DATA env flag is set
    if (process.env.SHOW_DEMO_DATA !== 'true') {
      query.isDemo = { $ne: true };
    }

    let workers = [];
    try {
      workers = await User.find(query)
        .select('trade subServices currentLocation lat lng _id availabilityStatus isAvailable')
        .lean();
    } catch (geoErr) {
      // If 2dsphere index query fails or coords not indexed yet, fallback without $near
      delete query.currentLocation;
      workers = await User.find(query)
        .select('trade subServices currentLocation lat lng _id availabilityStatus isAvailable')
        .limit(10)
        .lean();
    }

    // If still no workers found with exact filters, find any verified approved workers in category
    if (workers.length === 0) {
      const fallbackQuery = {
        role: { $in: ['handyman', 'worker'] },
        overallStatus: 'approved',
      };
      if (category) fallbackQuery.trade = category;
      workers = await User.find(fallbackQuery)
        .select('trade subServices currentLocation lat lng _id')
        .limit(5)
        .lean();
    }

    // Calculate distance and strictly anonymize (NO names, NO phones, NO ratings)
    const anonymousWorkers = (workers || []).map((w, idx) => {
      let dist = 1.5 + (idx * 0.7);
      if (lat && lng && (w.lat || w.currentLocation?.coordinates?.[1])) {
        const wLat = w.lat || w.currentLocation?.coordinates?.[1];
        const wLng = w.lng || w.currentLocation?.coordinates?.[0];
        dist = calculateDistance(Number(lat), Number(lng), wLat, wLng);
      }
      return {
        id: w._id || w.id,
        trade: w.trade || category || 'Home Technician',
        subServices: w.subServices || [],
        distanceKm: Number(dist.toFixed(1)),
        estimatedMinutes: Math.round(dist * 4) + 12,
        coordinates: w.currentLocation?.coordinates || [w.lng || 78.4809, w.lat || 9.8433],
        // Strict Privacy: Absolutely NO names, NO phone numbers, NO ratings
      };
    });

    res.json({ success: true, workers: anonymousWorkers });
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
