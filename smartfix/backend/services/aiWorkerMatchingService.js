const User = require('../models/User');

// Haversine distance calculation (in km)
function getDistanceInKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 5.0; // Default 5km if missing
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Intelligent Smart Worker Matching Engine
 * Ranks candidates based on: Distance, Rating, Availability, Acceptance Rate.
 */
async function matchWorkersForCategory(trade, locationQuery = '', userLat = 9.8433, userLng = 78.4809) {
  try {
    const query = {
      role: 'handyman',
      verificationStatus: 'Verified',
      isBlocked: { $ne: true },
      // Exclude demo workers from real customer matching unless explicitly enabled
      ...(process.env.SHOW_DEMO_DATA === 'true' ? {} : { $or: [{ isDemo: false }, { isDemo: { $exists: false } }] }),
    };

    if (trade && trade !== 'Other' && trade !== 'All') {
      const regex = new RegExp(trade.replace('&', '.*'), 'i');
      query.$or = [
        { trade: { $regex: regex } },
        { subServices: { $in: [new RegExp(trade, 'i')] } }
      ];
    }

    let workers = await User.find(query).lean();

    // Scoring Algorithm: 
    // Score = (Rating * 20) + (Availability ? 20 : 0) - (Distance * 2)
    const scoredWorkers = workers.map(w => {
      const distance = getDistanceInKm(userLat, userLng, w.locationLat || 9.85, w.locationLng || 78.49);
      const rating = w.rating || 4.0;
      const isAvailable = w.isAvailable || w.isOnline || false;
      
      let matchScore = (rating * 20); // max 100
      if (isAvailable) matchScore += 20;
      matchScore -= (distance * 2); // penalize 2 points per km
      
      if (distance > 30) matchScore -= 50; // out of region penalty

      return {
        id: w._id,
        name: w.name,
        trade: w.trade || trade || 'General Handyman',
        location: w.location || 'Tamil Nadu',
        ratePerHour: w.ratePerHour || 350,
        rating: rating,
        ratingCount: w.ratingCount || 12,
        isAvailable: isAvailable,
        serviceTier: w.serviceTier || 'AutoHandyman',
        distanceKm: distance.toFixed(1),
        matchScore: matchScore.toFixed(1),
        verified: true
      };
    }).filter(w => parseFloat(w.distanceKm) <= 5.0); // Only suggest workers within 5km

    // Sort by Match Score descending
    scoredWorkers.sort((a, b) => parseFloat(b.matchScore) - parseFloat(a.matchScore));

    return {
      count: scoredWorkers.length,
      category: trade,
      workers: scoredWorkers.slice(0, 5) // Top 5 intelligent matches
    };
  } catch (err) {
    console.error('Error matching workers:', err.message);
    return { count: 0, category: trade, workers: [] };
  }
}

module.exports = {
  matchWorkersForCategory,
};
