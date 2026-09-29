const User = require('../models/User');

/**
 * Searches SmartFix database for approved, verified handymen matching trade/category
 * NOTE: Gemini classifies category, but DB rules strictly enforce approval & trust status.
 */
async function matchWorkersForCategory(trade, locationQuery = '') {
  try {
    const query = {
      role: 'handyman',
      verificationStatus: 'Verified',
      isBlocked: { $ne: true },
    };

    // If trade specified, filter by trade or trade aliases
    if (trade && trade !== 'Other' && trade !== 'All') {
      const regex = new RegExp(trade.replace('&', '.*'), 'i');
      query.$or = [
        { trade: { $regex: regex } },
        { subServices: { $in: [new RegExp(trade, 'i')] } }
      ];
    }

    // Query matching workers from MongoDB
    let workers = await User.find(query)
      .select('_id name phone trade subServices location ratePerHour isAvailable isOnline rating ratingCount serviceTier avatar')
      .lean();

    // Sort priority: Online/Available first, then higher rating
    workers.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return b.isAvailable ? 1 : -1;
      return (b.rating || 0) - (a.rating || 0);
    });

    // Limit result set to top 5 candidates
    const suitableWorkers = workers.slice(0, 5).map(w => ({
      id: w._id,
      name: w.name,
      trade: w.trade || trade || 'General Handyman',
      location: w.location || 'Sivagangai',
      ratePerHour: w.ratePerHour || 350,
      rating: (w.rating !== null && w.rating !== undefined) ? w.rating : null,
      ratingCount: w.ratingCount || 12,
      isAvailable: w.isAvailable || w.isOnline || false,
      serviceTier: w.serviceTier || 'AutoHandyman',
      verified: true
    }));

    return {
      count: suitableWorkers.length,
      category: trade,
      workers: suitableWorkers
    };
  } catch (err) {
    console.error('Error matching workers:', err.message);
    return { count: 0, category: trade, workers: [] };
  }
}

module.exports = {
  matchWorkersForCategory,
};
