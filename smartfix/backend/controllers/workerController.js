const mongoose = require('mongoose');
const User = require('../models/User');
const { sanitizeWorkerForPublic } = require('../utils/sanitizer');

// @route  GET /api/workers
// @desc   Browse handymen, filterable by trade, location, search, and online status (KYC Verified only)
exports.getWorkers = async (req, res) => {
  try {
    const { trade, location, search } = req.query;

    const conditions = [{ role: 'handyman', verificationStatus: 'Verified' }];

    if (trade && trade !== 'all') {
      const tradeClean = trade.split('&')[0].trim();
      conditions.push({
        $or: [
          { trade: { $regex: tradeClean, $options: 'i' } },
          { subServices: { $regex: tradeClean, $options: 'i' } }
        ]
      });
    }

    if (location && location !== 'all') {
      conditions.push({ location: { $regex: location, $options: 'i' } });
    }

    if (search) {
      conditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { trade: { $regex: search, $options: 'i' } },
          { location: { $regex: search, $options: 'i' } },
          { subServices: { $regex: search, $options: 'i' } },
        ]
      });
    }

    const queryFilter = conditions.length > 1 ? { $and: conditions } : conditions[0];
    const rawWorkers = await User.find(queryFilter).select('-password');

    // Security Rule: The public browse/search listing must NEVER return phone numbers
    const sanitizedWorkers = (rawWorkers || []).map(sanitizeWorkerForPublic);

    res.status(200).json({ workers: sanitizedWorkers });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch workers', error: err.message });
  }
};

// @route  GET /api/workers/:id
exports.getWorkerById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Handyman not found' });
    }

    const worker = await User.findById(req.params.id).select('-password');
    if (!worker || worker.role !== 'handyman' || worker.verificationStatus !== 'Verified') {
      return res.status(404).json({ message: 'Handyman not found or pending verification' });
    }

    const sanitized = sanitizeWorkerForPublic(worker);
    res.status(200).json({ worker: sanitized });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch handyman', error: err.message });
  }
};

// @route  POST /api/workers
// @desc   Disabled - Workers must register via Provider Portal with KYC verification
exports.createWorker = async (req, res) => {
  return res.status(403).json({
    message: 'Manual worker creation is disabled. Service providers must self-register through the Provider App with mandatory Aadhaar & ID proof KYC verification.',
  });
};

// @route  DELETE /api/workers/:id
// @desc   Delete a worker from DB
exports.deleteWorker = async (req, res) => {
  try {
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      await User.findByIdAndDelete(req.params.id);
    }
    res.status(200).json({ message: 'Worker deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete worker', error: err.message });
  }
};

// @route  GET /api/workers/scorecard
// @desc   Get performance scorecard for logged in worker
exports.getWorkerScorecard = async (req, res) => {
  try {
    const Booking = require('../models/Booking');
    const workerId = req.user?.id;
    if (!workerId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const worker = await User.findById(workerId);
    if (!worker || worker.role !== 'handyman') {
      return res.status(403).json({ message: 'Access denied. Handyman role required.' });
    }

    const workerBookings = await Booking.find({ worker: workerId });

    const acceptedCount = workerBookings.filter(b => 
      ['Accepted', 'Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress', 'Completed', 'Paid', 'Reviewed'].includes(b.status)
    ).length;

    const completedCount = workerBookings.filter(b => 
      ['Completed', 'Paid', 'Reviewed'].includes(b.status)
    ).length;

    const completionRate = acceptedCount > 0 ? Math.round((completedCount / acceptedCount) * 100) : 0;

    let totalSlaMinutes = 0;
    let slaJobsCount = 0;
    workerBookings.forEach(b => {
      if (b.arrivedAt) {
        const startTime = b.enRouteAt || b.acceptedAt || b.createdAt;
        const diffMin = Math.max(1, Math.round((new Date(b.arrivedAt) - new Date(startTime)) / (1000 * 60)));
        totalSlaMinutes += diffMin;
        slaJobsCount++;
      }
    });

    const avgSlaTimeMinutes = slaJobsCount > 0 ? Math.round(totalSlaMinutes / slaJobsCount) : 0;

    const ratingReviews = workerBookings
      .filter(b => b.rating || b.customerRatingForWorker)
      .slice(-10)
      .map(b => ({
        bookingId: b._id,
        rating: b.customerRatingForWorker || b.rating,
        review: b.review || b.workerReview || '',
        date: b.updatedAt,
      }));

    const isTrusted = completedCount >= 5 && (worker.rating || 0) >= 4.5 && completionRate >= 80;
    if (isTrusted !== worker.trustedWorkerBadge) {
      worker.trustedWorkerBadge = isTrusted;
      await worker.save().catch(() => {});
    }

    res.status(200).json({
      scorecard: {
        workerId: worker._id,
        name: worker.name,
        trade: worker.trade,
        rating: worker.rating || 0,
        ratingCount: worker.ratingCount || 0,
        acceptedCount,
        completedCount,
        completionRate,
        avgSlaTimeMinutes,
        noShowCount: worker.noShowCount || 0,
        isBlocked: worker.isBlocked || false,
        isSuspended: worker.isSuspended || false,
        trustedWorkerBadge: worker.trustedWorkerBadge || false,
        ratingTrend: ratingReviews,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch worker scorecard', error: err.message });
  }
};
