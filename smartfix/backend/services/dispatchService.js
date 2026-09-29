const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const DispatchAttempt = require('../models/DispatchAttempt');

const WEIGHTS = {
  skill: 0.25,
  distance: 0.30,
  rating: 0.15,
  acceptance: 0.10,
  punctuality: 0.15,
  fairness: 0.05
};

const DISPATCH_TIMEOUT_SEC = 45;
const MAX_ATTEMPTS = 5;
const MAX_RADIUS_KM = 5;

// Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.5;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Start or continue dispatching for a booking
const dispatchNext = async (bookingId, io) => {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking || booking.status !== 'Pending') return; // Only dispatch if Pending

    const pastAttempts = await DispatchAttempt.find({ bookingId: booking._id }).sort({ rank: 1 });
    
    if (pastAttempts.length >= MAX_ATTEMPTS) {
      booking.status = 'Cancelled'; // Or a specific status like dispatchFailed
      booking.cancelReason = 'No nearby workers accepted the request in time.';
      booking.dispatchFailed = true;
      await booking.save();
      
      if (io) {
        io.to(`user-${booking.customer}`).emit('dispatch-failed', { bookingId: booking._id, message: 'No workers available to take the job right now.' });
        // Alert admin
        io.to('admin-room').emit('dispatch-failed-alert', { bookingId: booking._id });
      }
      return;
    }

    const attemptedWorkerIds = pastAttempts.map(a => a.workerId.toString());

    // Find workers within 5km, Available, matching category
    const query = {
      role: 'handyman',
      availabilityStatus: 'Available',
      _id: { $nin: attemptedWorkerIds }
    };
    
    // basic category matching
    if (booking.trade && booking.trade !== 'Other' && booking.trade !== 'All') {
      const regex = new RegExp(booking.trade.replace('&', '.*'), 'i');
      query.$or = [
        { trade: { $regex: regex } },
        { subServices: { $in: [new RegExp(booking.trade, 'i')] } }
      ];
    }

    let workers = await User.find(query);
    
    // Score workers
    let scoredWorkers = workers.map(worker => {
      const dist = calculateDistance(booking.pickupLat, booking.pickupLng, worker.lat, worker.lng);
      
      // Skill: out of 100
      let skillScore = (worker.aiInterview && worker.aiInterview.score) ? worker.aiInterview.score : 50;
      
      // Distance: closer = higher score (max 100 for 0km, 0 for >5km)
      let distanceScore = Math.max(0, 100 - (dist / MAX_RADIUS_KM) * 100);
      
      // Rating: out of 100 (5 stars = 100)
      let ratingScore = (worker.rating || 4.0) * 20;
      
      // Acceptance and punctuality mocked/estimated for now (could be aggregated if we had the data)
      let acceptanceRate = 90; 
      let punctualityRate = 90;
      
      // Fairness boost: fewer jobs = higher score (we'll just use a random boost or query jobs if needed, defaulting to 50)
      let fairnessBoost = 50; 

      const scoreBreakdown = {
        skill: skillScore * WEIGHTS.skill,
        distance: distanceScore * WEIGHTS.distance,
        rating: ratingScore * WEIGHTS.rating,
        acceptance: acceptanceRate * WEIGHTS.acceptance,
        punctuality: punctualityRate * WEIGHTS.punctuality,
        fairness: fairnessBoost * WEIGHTS.fairness
      };

      const finalScore = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);

      return { worker, finalScore, scoreBreakdown, dist };
    });

    // Filter by dist <= 5km
    scoredWorkers = scoredWorkers.filter(w => w.dist <= MAX_RADIUS_KM);
    
    if (scoredWorkers.length === 0) {
      // No one left to try
      booking.status = 'Cancelled';
      booking.cancelReason = 'No nearby workers available.';
      booking.dispatchFailed = true;
      await booking.save();
      if (io) io.to(`user-${booking.customer}`).emit('dispatch-failed', { bookingId: booking._id });
      return;
    }

    // Sort descending by score
    scoredWorkers.sort((a, b) => b.finalScore - a.finalScore);
    const topWorker = scoredWorkers[0];

    const expiresAt = new Date(Date.now() + DISPATCH_TIMEOUT_SEC * 1000);

    const attempt = await DispatchAttempt.create({
      bookingId: booking._id,
      workerId: topWorker.worker._id,
      rank: pastAttempts.length + 1,
      score: topWorker.finalScore,
      scoreBreakdown: topWorker.scoreBreakdown,
      status: 'Sent',
      expiresAt
    });

    // Emit 'job-request' to the specific worker ONLY
    if (io) {
      io.to(`worker-${topWorker.worker._id}`).emit('job-request', {
        attemptId: attempt._id,
        bookingId: booking._id,
        category: booking.trade,
        subServices: booking.subServices,
        distanceKm: topWorker.dist.toFixed(1),
        urgency: booking.serviceTier,
        priceRange: booking.price,
        expiresAt: attempt.expiresAt
      });
    }

  } catch (err) {
    console.error('Error in dispatchNext:', err);
  }
};

const startDispatch = async (bookingId, io) => {
  await dispatchNext(bookingId, io);
};

let cronInterval;

const initDispatchSweeper = (io) => {
  if (cronInterval) clearInterval(cronInterval);
  cronInterval = setInterval(async () => {
    try {
      const now = new Date();
      // Find attempts that have timed out
      const timedOutAttempts = await DispatchAttempt.find({
        status: 'Sent',
        expiresAt: { $lt: now }
      });

      for (const attempt of timedOutAttempts) {
        attempt.status = 'TimedOut';
        await attempt.save();
        
        // Notify worker that time expired
        if (io) {
          io.to(`worker-${attempt.workerId}`).emit('job-request-expired', {
            attemptId: attempt._id,
            bookingId: attempt.bookingId
          });
        }
        
        // Trigger next dispatch
        await dispatchNext(attempt.bookingId, io);
      }
    } catch (err) {
      console.error('Error in dispatch sweeper:', err);
    }
  }, 10000); // Every 10 seconds
  console.log('⏰ Dispatch timeout sweeper initialized');
};

module.exports = {
  startDispatch,
  dispatchNext,
  initDispatchSweeper
};
