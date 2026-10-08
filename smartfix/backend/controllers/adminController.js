const User = require('../models/User');
const Booking = require('../models/Booking');
const SOSAlert = require('../models/SOSAlert');
const PolicyViolation = require('../models/PolicyViolation');
const DispatchAttempt = require('../models/DispatchAttempt');
const ReviewFlag = require('../models/ReviewFlag');

exports.getPolicyViolations = async (req, res) => {
  try {
    const violations = await PolicyViolation.find()
      .populate('user', 'name phone email')
      .sort({ count: -1, lastAttemptAt: -1 })
      .limit(50);
    res.status(200).json({ violations });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch policy violations', error: err.message });
  }
};

// @route GET /api/admin/pending-captains
// @desc Get list of Handymen with KYC details and verification status
exports.getPendingCaptains = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { role: 'handyman' };
    if (status) {
      filter.verificationStatus = status;
    }

    const captains = await User.find(filter)
      .select('name phone role trade location ratePerHour verificationStatus aadhaarNumber aadhaarDocUrl idProofType idProofNumber idProofDocUrl rejectionReason rating ratingCount createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({ captains });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch worker verification queue', error: err.message });
  }
};

// @route PATCH /api/admin/verify-captain/:id
// @desc Approve or reject Handyman verification status (supports identity, skill, experience tabs)
exports.verifyCaptain = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus, rejectionReason, identityStatus, skillStatus, experienceStatus } = req.body;

    const user = await User.findById(id);
    if (!user || user.role !== 'handyman') {
      return res.status(404).json({ message: 'Worker profile not found' });
    }

    if (!user.identity) user.identity = { status: 'pending' };
    if (!user.skill) user.skill = { status: 'pending' };
    if (!user.experience) user.experience = { status: 'pending', videos: [] };

    if (identityStatus && ['pending', 'verified', 'rejected'].includes(identityStatus)) {
      user.identity.status = identityStatus;
      if (identityStatus === 'verified') user.identity.verifiedAt = new Date();
    }

    if (skillStatus && ['pending', 'verified', 'rejected'].includes(skillStatus)) {
      user.skill.status = skillStatus;
      if (skillStatus === 'verified') user.skill.verifiedAt = new Date();
    }

    if (experienceStatus && ['pending', 'verified', 'rejected'].includes(experienceStatus)) {
      user.experience.status = experienceStatus;
    }

    // Direct overall status update or evaluated dual status
    if (verificationStatus) {
      if (['Verified', 'Rejected', 'Pending'].includes(verificationStatus)) {
        user.verificationStatus = verificationStatus;
        if (verificationStatus === 'Verified') {
          user.identity.status = 'verified';
          user.skill.status = 'verified';
          user.overallStatus = 'approved';

        } else if (verificationStatus === 'Rejected') {
          user.overallStatus = 'rejected';
        }
      }
    }

    // Evaluate dual verification approval rule
    if (user.identity.status === 'verified' && user.skill.status === 'verified') {
      user.verificationStatus = 'Verified';
      user.overallStatus = 'approved';
      user.rejectionReason = '';
      user.isAvailable = true;
      user.isOnline = true;
    } else if (user.identity.status === 'rejected' || user.skill.status === 'rejected' || user.verificationStatus === 'Rejected') {
      user.verificationStatus = 'Rejected';
      user.overallStatus = 'rejected';
      user.rejectionReason = rejectionReason || 'Documents or skill verification requirements were not met.';
      user.isAvailable = false;
      user.isOnline = false;
    }

    // Generate unique Worker ID based on trade if Verified
    if (user.verificationStatus === 'Verified' && !user.workerId) {
      const tradePrefixes = {
        'Plumbing': 'PL',
        'Electrical Repairs': 'EL',
        'AC Service and Repair': 'AC',
        'AC Service & Repair': 'AC',
        'Refrigerator Repair': 'RF',
        'Washing Machine Repair': 'WM',
        'Water Purifier Service': 'WP'
      };
      const prefix = tradePrefixes[user.trade] || 'SP';
      let isUnique = false;
      while (!isUnique) {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const newId = `${prefix}_${randomNum}`;
        const exists = await User.findOne({ workerId: newId });
        if (!exists) {
          user.workerId = newId;
          isUnique = true;
        }
      }
    }

    await user.save();

    res.status(200).json({
      message: `Worker verification status updated to ${user.verificationStatus} (Identity: ${user.identity.status}, Skill: ${user.skill.status})`,
      user: {
        id: user._id,
        name: user.name,
        workerId: user.workerId,
        verificationStatus: user.verificationStatus,
        overallStatus: user.overallStatus,
        identity: user.identity,
        skill: user.skill,
        experience: user.experience,
        rejectionReason: user.rejectionReason,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update verification status', error: err.message });
  }
};

// @route GET /api/admin/analytics
// @desc Operational analytics: total jobs, revenue, active Handymen, SLA compliance %, daily trends, category demand
exports.getAdminAnalytics = async (req, res) => {
  try {
    const totalCaptains = await User.countDocuments({ role: 'handyman' });
    const activeCaptains = await User.countDocuments({ role: 'handyman', isAvailable: true });
    const verifiedCaptains = await User.countDocuments({ role: 'handyman', verificationStatus: 'Verified' });
    const pendingVerificationCount = await User.countDocuments({ role: 'handyman', verificationStatus: 'Pending' });
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalBookings = await Booking.countDocuments();
    const activeBookings = await Booking.countDocuments({ status: { $in: ['Pending', 'Accepted', 'Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress', 'InProgress', 'CaptainArrived'] } });
    const completedBookings = await Booking.countDocuments({ status: { $in: ['Completed', 'Paid', 'Reviewed'] } });

    // Total Revenue from Paid bookings
    const totalRevenueObj = await Booking.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$price' } } },
    ]);
    const totalRevenue = totalRevenueObj[0]?.total || 0;
    const platformCommissionRevenue = Math.round(totalRevenue * 0.10);
    const handymanDisbursedPayouts = totalRevenue - platformCommissionRevenue;

    // SLA Compliance Calculation: (EnRoute->Arrived <= 1 hour) / (total confirmed bookings) * 100
    const confirmedBookings = await Booking.find({
      status: { $in: ['Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress', 'Completed', 'Paid', 'Reviewed', 'SLABreached'] }
    });
    
    let slaMetCount = 0;
    confirmedBookings.forEach((b) => {
      if (b.enRouteAt && b.arrivedAt) {
        const durationMin = (new Date(b.arrivedAt) - new Date(b.enRouteAt)) / (1000 * 60);
        if (durationMin <= 60 && !b.slaBreached) slaMetCount++;
      } else if (!b.slaBreached && ['Arrived', 'WorkInProgress', 'Completed', 'Paid', 'Reviewed'].includes(b.status)) {
        slaMetCount++;
      }
    });

    const slaCompliancePercentage = confirmedBookings.length > 0
      ? Math.round((slaMetCount / confirmedBookings.length) * 100)
      : 100;

    // Bookings Per Day (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const dailyBookingsAgg = await Booking.aggregate([
      { $match: { createdAt: { $gte: fourteenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$price", 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const dailyBookings = dailyBookingsAgg.map(item => ({
      date: item._id,
      bookings: item.count,
      revenue: item.revenue,
    }));

    // Category-wise Demand Across All 6 Primary Trades
    const ALL_TRADES = [
      'Plumbing',
      'Electrical Repairs',
      'AC Service & Repair',
      'Washing Machine Repair',
      'Refrigerator Repair',
      'Water Purifier Service',
    ];

    const categoryDemandAgg = await Booking.aggregate([
      { $group: { _id: "$trade", count: { $sum: 1 } } }
    ]);

    const categoryMap = {};
    categoryDemandAgg.forEach(item => {
      if (item._id) categoryMap[item._id] = item.count;
    });

    const categoryDemand = ALL_TRADES.map(trade => ({
      category: trade,
      count: categoryMap[trade] || categoryMap[trade.replace('&', 'and')] || 0,
    }));

    res.status(200).json({
      analytics: {
        totalCaptains,
        activeCaptains,
        verifiedCaptains,
        pendingVerificationCount,
        totalCustomers,
        totalBookings,
        activeBookings,
        completedBookings,
        totalRevenue,
        platformCommissionRevenue,
        handymanDisbursedPayouts,
        slaCompliancePercentage,
        dailyBookings,
        categoryDemand,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch analytics', error: err.message });
  }
};

// @route GET /api/admin/customers
// @desc Get list of all registered customers with booking stats
exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' })
      .select('name phone location isBlocked createdAt preferredLanguage theme')
      .sort({ createdAt: -1 });

    // Attach total bookings count for each customer
    const customerListWithStats = await Promise.all(
      customers.map(async (c) => {
        const bookingCount = await Booking.countDocuments({ customer: c._id });
        return {
          ...c.toObject(),
          totalBookingsCount: bookingCount,
        };
      })
    );

    res.status(200).json({ customers: customerListWithStats });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customer list', error: err.message });
  }
};

// @route PATCH /api/admin/customers/:id/toggle-block
// @desc Block or unblock a customer account
exports.toggleBlockCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user || user.role !== 'customer') {
      return res.status(404).json({ message: 'Customer account not found' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.status(200).json({
      message: `Customer ${user.name} has been ${user.isBlocked ? 'blocked' : 'unblocked'} successfully.`,
      user: {
        id: user._id,
        name: user.name,
        isBlocked: user.isBlocked,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update customer block status', error: err.message });
  }
};
// @route GET /api/admin/bookings
// @desc Get all platform bookings (with optional status filter) for admin oversight
exports.getAdminBookings = async (req, res) => {
  try {
    const { status, slaBreached, limit = 100 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (slaBreached === 'true') filter.slaBreached = true;

    const bookings = await Booking.find(filter)
      .populate('customer', 'name phone')
      .populate('worker', 'name phone trade')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.status(200).json({ bookings });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings', error: err.message });
  }
};

// @route GET /api/admin/wallet-overview
// @desc Get total wallet liability and top wallet holders
exports.getWalletOverview = async (req, res) => {
  try {
    const Wallet = require('../models/Wallet');
    const wallets = await Wallet.find()
      .populate('user', 'name phone role')
      .sort({ balance: -1 })
      .limit(50);

    const totalLiability = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

    res.status(200).json({
      totalLiability,
      wallets: wallets.map((w) => ({
        userId: w.user?._id,
        name: w.user?.name,
        phone: w.user?.phone,
        role: w.user?.role,
        balance: w.balance,
        transactions: w.transactions?.length || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch wallet overview', error: err.message });
  }
};

// @route GET /api/admin/worker-scorecards
// @desc Get performance scorecards for all workers (Completion %, Avg SLA Time, Rating Trend, Badge status)
exports.getAdminWorkerScorecards = async (req, res) => {
  try {
    const workers = await User.find({ role: 'handyman' })
      .select('name phone trade verificationStatus rating ratingCount noShowCount isBlocked isSuspended trustedWorkerBadge createdAt');

    const scorecards = await Promise.all(
      workers.map(async (worker) => {
        const workerBookings = await Booking.find({ worker: worker._id });
        
        const acceptedCount = workerBookings.filter(b => 
          ['Accepted', 'Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress', 'Completed', 'Paid', 'Reviewed'].includes(b.status)
        ).length;
        
        const completedCount = workerBookings.filter(b => 
          ['Completed', 'Paid', 'Reviewed'].includes(b.status)
        ).length;
        
        const completionRate = acceptedCount > 0 ? Math.round((completedCount / acceptedCount) * 100) : 0;

        // SLA Average Time (between Confirmed/enRouteAt and Arrived)
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

        // Rating trend (last 10 reviews)
        const ratingReviews = workerBookings
          .filter(b => b.rating || b.customerRatingForWorker)
          .slice(-10)
          .map(b => ({
            bookingId: b._id,
            rating: b.customerRatingForWorker || b.rating,
            review: b.review || b.workerReview || '',
            date: b.updatedAt,
          }));

        // Trusted Worker Badge Threshold Check: min 5 completed jobs & avg rating >= 4.5
        const isTrusted = completedCount >= 5 && (worker.rating || 0) >= 4.5 && completionRate >= 80;
        if (isTrusted !== worker.trustedWorkerBadge) {
          worker.trustedWorkerBadge = isTrusted;
          await worker.save().catch(() => {});
        }

        return {
          workerId: worker._id,
          name: worker.name,
          phone: worker.phone,
          trade: worker.trade,
          verificationStatus: worker.verificationStatus,
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
        };
      })
    );

    res.status(200).json({ scorecards });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch worker scorecards', error: err.message });
  }
};

// @route GET /api/admin/sos-alerts
// @desc Get all emergency SOS alerts (open first)
exports.getSOSAlerts = async (req, res) => {
  try {
    const alerts = await SOSAlert.find()
      .populate('booking')
      .populate('user', 'name phone role')
      .populate('resolvedBy', 'name phone')
      .sort({ status: 1, createdAt: -1 }); // 'open' before 'resolved'

    const populatedAlerts = await Promise.all(
      alerts.map(async (alert) => {
        let bookingDetails = null;
        if (alert.booking) {
          bookingDetails = await Booking.findById(alert.booking._id)
            .populate('customer', 'name phone')
            .populate('worker', 'name phone trade');
        }
        return {
          ...alert.toObject(),
          booking: bookingDetails || alert.booking,
        };
      })
    );

    res.status(200).json({ alerts: populatedAlerts });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch SOS alerts', error: err.message });
  }
};

// @route PATCH /api/admin/sos-alerts/:id/resolve
// @desc Mark an emergency SOS alert as resolved
exports.resolveSOSAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const alert = await SOSAlert.findById(id);
    if (!alert) {
      return res.status(404).json({ message: 'SOS Alert record not found' });
    }

    alert.status = 'resolved';
    alert.notes = notes || 'Resolved by SmartFix Admin';
    alert.resolvedBy = req.user?.id;
    alert.resolvedAt = new Date();

    await alert.save();

    res.status(200).json({ message: 'SOS Alert marked as resolved successfully', alert });
  } catch (err) {
    res.status(500).json({ message: 'Failed to resolve SOS alert', error: err.message });
  }
};

// @route GET /api/admin/withdrawals
// @desc Get all handyman withdrawal requests
exports.getAdminWithdrawals = async (req, res) => {
  try {
    const Wallet = require('../models/Wallet');
    const wallets = await Wallet.find({ role: 'handyman' }).populate('user', 'name phone trade');
    
    const withdrawalRequests = [];
    wallets.forEach((wallet) => {
      wallet.transactions.forEach((txn) => {
        if (txn.type === 'debit') {
          withdrawalRequests.push({
            walletId: wallet._id,
            transactionId: txn._id,
            user: {
              id: wallet.user?._id,
              name: wallet.user?.name,
              phone: wallet.user?.phone,
              trade: wallet.user?.trade,
            },
            amount: txn.amount,
            description: txn.description,
            createdAt: txn.createdAt,
            status: txn.status || 'Processed',
          });
        }
      });
    });

    res.status(200).json({ withdrawals: withdrawalRequests });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch withdrawal requests', error: err.message });
  }
};

// @route PATCH /api/admin/withdrawals/:walletId/:transactionId/process
// @desc Process or resolve a handyman withdrawal payout
exports.processWithdrawalRequest = async (req, res) => {
  try {
    const Wallet = require('../models/Wallet');
    const { walletId, transactionId } = req.params;
    const { status = 'Processed', notes } = req.body;

    const wallet = await Wallet.findById(walletId);
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });

    const transaction = wallet.transactions.id(transactionId);
    if (!transaction) return res.status(404).json({ message: 'Transaction request not found' });

    transaction.status = status;
    if (notes) transaction.notes = notes;
    await wallet.save();

    res.status(200).json({ message: `Withdrawal payout marked as ${status}`, transaction });
  } catch (err) {
    res.status(500).json({ message: 'Failed to process withdrawal', error: err.message });
  }
};

// @route PATCH /api/admin/workers/:id/toggle-block
// @desc Block or unblock a handyman worker account
exports.toggleBlockWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user || user.role !== 'handyman') {
      return res.status(404).json({ message: 'Handyman worker account not found' });
    }

    user.isBlocked = !user.isBlocked;
    if (user.isBlocked) {
      user.isAvailable = false;
      user.isOnline = false;
    }
    await user.save();

    res.status(200).json({
      message: `Handyman worker ${user.name} has been ${user.isBlocked ? 'blocked' : 'unblocked'} successfully.`,
      user: {
        id: user._id,
        name: user.name,
        isBlocked: user.isBlocked,
        isAvailable: user.isAvailable,
        isOnline: user.isOnline,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update worker block status', error: err.message });
  }
};

// @route GET /api/admin/dispatch-stats
// @desc Get AI dispatch metrics
exports.getDispatchStats = async (req, res) => {
  try {
    const attempts = await DispatchAttempt.find();
    
    // Group by booking
    const bookingsMap = {};
    attempts.forEach(a => {
      if (!bookingsMap[a.bookingId]) bookingsMap[a.bookingId] = [];
      bookingsMap[a.bookingId].push(a);
    });

    const bookingIds = Object.keys(bookingsMap);
    let totalAttempts = 0;
    let acceptedBookings = 0;
    let failedBookings = 0;
    let totalTimeToAcceptSec = 0;

    bookingIds.forEach(id => {
      const bAttempts = bookingsMap[id];
      totalAttempts += bAttempts.length;
      
      const acceptedAttempt = bAttempts.find(a => a.status === 'Accepted');
      if (acceptedAttempt) {
        acceptedBookings++;
        const firstAttempt = bAttempts.find(a => a.rank === 1);
        if (firstAttempt) {
          const timeToAccept = (new Date(acceptedAttempt.updatedAt) - new Date(firstAttempt.sentAt)) / 1000;
          totalTimeToAcceptSec += timeToAccept;
        }
      } else if (bAttempts.length >= 5 || bAttempts.some(a => a.status === 'TimedOut' || a.status === 'Declined')) {
        // If not accepted and reached max attempts or last one was declined/timed out
        // Wait, a better way to check failure is to see if booking has dispatchFailed
      }
    });

    // Check actual bookings for dispatchFailed
    const failedBookingDocs = await Booking.countDocuments({ dispatchFailed: true });
    
    const avgAttemptsPerBooking = bookingIds.length > 0 ? (totalAttempts / bookingIds.length).toFixed(1) : 0;
    const avgTimeToAccept = acceptedBookings > 0 ? (totalTimeToAcceptSec / acceptedBookings).toFixed(1) : 0;
    
    const totalDispatchedBookings = await Booking.countDocuments({ status: { $ne: 'PendingDispatch' } });
    const failureRate = totalDispatchedBookings > 0 ? ((failedBookingDocs / totalDispatchedBookings) * 100).toFixed(1) : 0;

    res.status(200).json({
      avgAttemptsPerBooking: parseFloat(avgAttemptsPerBooking),
      avgTimeToAcceptSec: parseFloat(avgTimeToAccept),
      dispatchFailureRate: parseFloat(failureRate),
      totalDispatchCycles: bookingIds.length,
      acceptedBookings,
      failedBookings: failedBookingDocs
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch dispatch stats', error: err.message });
  }
};

// ==============================================================
// GET /api/admin/review-flags — View Flagged Fake Reviews
// ==============================================================
exports.getReviewFlags = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const flags = await ReviewFlag.find(filter)
      .populate('reviewId', 'trade status rating review')
      .populate('workerId', 'name phone trade')
      .populate('customerId', 'name phone')
      .sort('-createdAt');

    res.status(200).json({ flags });
  } catch (err) {
    console.error('Failed to fetch review flags:', err.message);
    res.status(500).json({ message: 'Failed to fetch review flags' });
  }
};

// ==============================================================
// PATCH /api/admin/review-flags/:id — Manage Flag (Dismiss/Remove)
// ==============================================================
exports.manageReviewFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, adminNotes } = req.body; // 'dismiss' or 'remove'

    const flag = await ReviewFlag.findById(id);
    if (!flag) return res.status(404).json({ message: 'Review flag not found' });

    if (action === 'dismiss') {
      flag.status = 'Dismissed';
      flag.adminNotes = adminNotes || flag.adminNotes;
      await flag.save();
    } else if (action === 'remove') {
      flag.status = 'Removed';
      flag.adminNotes = adminNotes || flag.adminNotes;
      await flag.save();

      // Actually remove the review from the Booking
      const booking = await Booking.findById(flag.reviewId);
      if (booking) {
        booking.rating = undefined;
        booking.review = undefined;
        booking.customerRatingForWorker = undefined;
        await booking.save();

        // Recalculate worker's average rating
        const workerUser = await User.findById(flag.workerId);
        if (workerUser) {
          const allRatings = await Booking.find({ worker: flag.workerId, rating: { $exists: true, $ne: null } });
          const totalRating = allRatings.reduce((sum, b) => sum + Number(b.rating), 0);
          const ratingCount = allRatings.length;
          
          workerUser.ratingCount = ratingCount;
          workerUser.rating = ratingCount > 0 ? Number((totalRating / ratingCount).toFixed(1)) : 0;
          await workerUser.save();
        }
      }
    } else {
      return res.status(400).json({ message: 'Invalid action. Use "dismiss" or "remove".' });
    }

    res.status(200).json({ message: `Review flag ${action}ed successfully`, flag });
  } catch (err) {
    console.error('Failed to manage review flag:', err.message);
    res.status(500).json({ message: 'Failed to manage review flag' });
  }
};

const { askGroqJSON } = require('../services/aiService');

exports.getWorkerReviewInsights = async (req, res) => {
  try {
    const { id } = req.params;
    const worker = await User.findById(id);
    if (!worker || worker.role !== 'handyman') {
      return res.status(404).json({ message: 'Worker not found' });
    }

    const bookingsWithAnalysis = await Booking.find({ worker: id, aiAnalysis: { $exists: true } });
    
    let totalAnalyzed = 0;
    let suspiciousCount = 0;
    const sums = { punctuality: 0, behaviour: 0, cleanliness: 0, price_fairness: 0 };
    const counts = { punctuality: 0, behaviour: 0, cleanliness: 0, price_fairness: 0 };

    bookingsWithAnalysis.forEach(b => {
      if (!b.aiAnalysis || !b.aiAnalysis.aspects) return;
      totalAnalyzed++;
      if (b.aiAnalysis.suspicious) suspiciousCount++;

      const a = b.aiAnalysis.aspects;
      ['punctuality', 'behaviour', 'cleanliness', 'price_fairness'].forEach(asp => {
        if (a[asp] !== null && a[asp] !== undefined) {
          sums[asp] += a[asp];
          counts[asp]++;
        }
      });
    });

    const averages = {
      punctuality: counts.punctuality > 0 ? Number((sums.punctuality / counts.punctuality).toFixed(1)) : null,
      behaviour: counts.behaviour > 0 ? Number((sums.behaviour / counts.behaviour).toFixed(1)) : null,
      cleanliness: counts.cleanliness > 0 ? Number((sums.cleanliness / counts.cleanliness).toFixed(1)) : null,
      price_fairness: counts.price_fairness > 0 ? Number((sums.price_fairness / counts.price_fairness).toFixed(1)) : null,
    };

    let reviewSummary = worker.reviewSummary || { en: '', ta: '', basedOnCount: 0 };
    
    if (totalAnalyzed >= (reviewSummary.basedOnCount || 0) + 5 && totalAnalyzed > 0) {
      // Regenerate summary
      const reviewsText = bookingsWithAnalysis.map(b => `Rating: ${b.rating}, Review: ${b.review}`).join('\n---\n');
      const sysPrompt = `You are an AI that writes a 2-line summary of a home service worker's strengths and weaknesses based on customer reviews. 
Output JSON format: {"en": "2-line English summary", "ta": "2-line Tamil summary"}`;
      const userPrompt = `Reviews:\n${reviewsText}`;

      try {
        const result = await askGroqJSON({ system: sysPrompt, user: userPrompt });
        if (result && result.en && result.ta) {
          reviewSummary = {
            en: result.en,
            ta: result.ta,
            basedOnCount: totalAnalyzed,
            generatedAt: new Date()
          };
          worker.reviewSummary = reviewSummary;
          await worker.save();
        }
      } catch (err) {
        console.error('Failed to generate review summary:', err);
      }
    }

    res.status(200).json({
      averages,
      totalAnalyzed,
      suspiciousCount,
      summary: reviewSummary
    });
  } catch (err) {
    console.error('getWorkerReviewInsights error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
