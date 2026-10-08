const SystemConfig = require('../models/SystemConfig');

/**
 * Calculates distance between two coordinates in km (Haversine formula).
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 5.1; // Default outside 5km
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Ranks workers deterministically based on distance, rating, acceptance rate, and recent availability.
 * @param {Array} workers - Array of worker documents from DB
 * @param {Object} booking - Booking payload containing { userLat, userLng, subServices }
 * @returns {Array} - Array of ranked worker objects with stripped PII
 */
exports.rankWorkers = async (workers, booking) => {
  const { userLat, userLng, subServices } = booking;
  const bookingSubServices = Array.isArray(subServices) ? subServices : [];

  // Fetch weights from DB or use defaults
  const config = await SystemConfig.findOne({ key: 'worker_ranking_weights' }).lean();
  const weights = config?.value || {
    distanceWeight: 0.4,
    ratingWeight: 0.3,
    acceptanceRateWeight: 0.2,
    availabilityWeight: 0.1
  };

  const rankedList = [];

  for (const worker of workers) {
    // Candidates MUST be Available and KYC verified
    if (worker.availabilityStatus !== 'Available' || worker.overallStatus !== 'approved') {
      continue;
    }
    // Exclude demo workers from real customer results unless flag is set
    if (process.env.SHOW_DEMO_DATA !== 'true' && worker.isDemo === true) {
      continue;
    }

    // Match sub-service
    if (bookingSubServices.length > 0) {
      const workerSubs = Array.isArray(worker.subServices) ? worker.subServices : [];
      const hasMatch = bookingSubServices.some(sub => workerSubs.includes(sub));
      if (!hasMatch) continue;
    }

    // Calculate distance and enforce <= 5 km
    const distance = calculateDistance(userLat, userLng, worker.lat, worker.lng);
    if (distance > 5.0) continue;

    // --- Scoring Logic (0-1 each) ---

    // 1. Distance Score: Closer is better (linear to 5km limit)
    // 0 km = 1.0, 5 km = 0.0
    const distanceScore = Math.max(0, 1 - (distance / 5.0));

    // 2. Rating Score: 0 to 1 based on 5-star scale. 
    // New workers (null rating) get 0.6 neutral start.
    let ratingScore = 0.6;
    if (worker.rating != null && worker.ratingCount > 0) {
      ratingScore = worker.rating / 5.0;
    }

    // 3. Acceptance Rate Score: accepted / offered
    let acceptanceScore = 0.5; // neutral default
    if (worker.jobsOffered > 0) {
      acceptanceScore = worker.jobsAccepted / worker.jobsOffered;
    }

    // 4. Availability / Recent Activity Score
    // Assume all "Available" workers get a base of 0.8, fully active recently = 1.0. 
    // For this basic deterministic metric without complex socket activity logs, we grant 1.0 to currently "Available"
    const availabilityScore = 1.0; 

    // Final weighted score
    const finalScore = 
      (distanceScore * weights.distanceWeight) +
      (ratingScore * weights.ratingWeight) +
      (acceptanceScore * weights.acceptanceRateWeight) +
      (availabilityScore * weights.availabilityWeight);

    const approxDistanceKm = Math.max(0.5, Math.round(distance * 2) / 2);

    rankedList.push({
      workerId: worker._id || worker.id,
      distance: parseFloat(distance.toFixed(2)),
      approxDistanceKm,
      score: finalScore,
      category: worker.trade,
      subServices: worker.subServices,
      isTopMatch: false
    });
  }

  // Sort descending by score
  rankedList.sort((a, b) => b.score - a.score);

  // Mark top match
  if (rankedList.length > 0) {
    rankedList[0].isTopMatch = true;
  }

  return rankedList;
};
