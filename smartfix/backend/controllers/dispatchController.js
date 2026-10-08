const User = require('../models/User');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');
const { validateTamilNaduLocation } = require('../services/geocodingService');
const { sanitizeBookingForRole } = require('../utils/sanitizer');
const { createProxySession } = require('../utils/twilioProxy');
const DispatchAttempt = require('../models/DispatchAttempt');
const dispatchService = require('../services/dispatchService');

// Helper function: Haversine formula to compute radial distance in km
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === undefined || lat1 === null ||
    lon1 === undefined || lon1 === null ||
    lat2 === undefined || lat2 === null ||
    lon2 === undefined || lon2 === null
  ) return 1.5;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
};

const TIER_PRICING = {
  BikePro: { baseFee: 99, perKm: 15, perMin: 2, label: 'Express Bike Repair Pro ⚡' },
  AutoHandyman: { baseFee: 199, perKm: 25, perMin: 3, label: 'Standard Auto Handyman 🚗' },
  MasterTech: { baseFee: 349, perKm: 40, perMin: 5, label: 'Master Specialist Truck 🚚' },
};

exports.estimateFare = async (req, res) => {
  try {
    const { pickupLat, pickupLng, destLat, destLng } = req.body;
    const lat1 = parseFloat(pickupLat) || 9.8433;
    const lon1 = parseFloat(pickupLng) || 78.4809;
    const lat2 = parseFloat(destLat) || lat1 + 0.025;
    const lon2 = parseFloat(destLng) || lon1 + 0.025;

    const distanceKm = calculateDistance(lat1, lon1, lat2, lon2);
    const estimatedMinutes = Math.max(8, Math.round(distanceKm * 4 + 5));

    const fareEstimates = Object.keys(TIER_PRICING).map((tierKey) => {
      const tier = TIER_PRICING[tierKey];
      const estimatedPrice = Math.round(tier.baseFee + distanceKm * tier.perKm + estimatedMinutes * tier.perMin);
      return {
        tier: tierKey,
        label: tier.label,
        price: estimatedPrice,
        baseFee: tier.baseFee,
        distanceKm,
        estimatedMinutes,
        etaMinutes: Math.max(3, Math.round(distanceKm * 3)),
      };
    });

    res.status(200).json({ distanceKm, estimatedMinutes, fareEstimates });
  } catch (err) {
    res.status(500).json({ message: 'Fare estimation failed', error: err.message });
  }
};

exports.findNearestCaptains = async (req, res) => {
  try {
    const { pickupLat, pickupLng, trade, radiusKm = 5 } = req.body;
    const maxRadius = Math.min(parseFloat(radiusKm) || 5, 5.0);
    const pLat = parseFloat(pickupLat) || 9.8433;
    const pLng = parseFloat(pickupLng) || 78.4809;

    let captains = [];
    try {
      const query = { role: 'handyman', verificationStatus: 'Verified', isAvailable: true };
      if (trade && trade !== 'all') {
        query.trade = new RegExp(trade.split('&')[0].trim(), 'i');
      }
      captains = await User.find(query);
    } catch (e) {
      console.warn('DB query captains error:', e.message);
    }

    const nearbyCaptains = captains
      .map((c) => {
        const dist = calculateDistance(pLat, pLng, c.lat || 9.8433, c.lng || 78.4809);
        return {
          id: c._id,
          name: c.name,
          trade: c.trade,
          serviceTier: c.serviceTier || 'AutoHandyman',
          rating: c.ratingCount > 0 ? c.rating : 0,
          ratingCount: c.ratingCount || 0,
          lat: c.lat,
          lng: c.lng,
          distanceKm: dist,
          etaMinutes: Math.max(3, Math.round(dist * 3)),
        };
      })
      .filter((c) => c.distanceKm <= maxRadius);

    nearbyCaptains.sort((a, b) => a.distanceKm - b.distanceKm);

    res.status(200).json({ totalFound: nearbyCaptains.length, captains: nearbyCaptains });
  } catch (err) {
    res.status(500).json({ message: 'Radial dispatch search failed', error: err.message });
  }
};

exports.requestDispatch = async (req, res) => {
  try {
    const { trade, serviceTier = 'AutoHandyman', pickupLat, pickupLng, address, price, notes, workerId, aiSuggested } = req.body;
    const customerId = req.user?.id;

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(401).json({ message: 'Authentication required to request dispatch' });
    }

    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);

    // Validate Tamil Nadu bounds
    const locValidation = await validateTamilNaduLocation(pLat, pLng, address);
    if (!locValidation.valid) {
      return res.status(400).json({ message: locValidation.message });
    }

    let assignedWorker = null;
    if (workerId && mongoose.Types.ObjectId.isValid(workerId)) {
      assignedWorker = await User.findById(workerId).catch(() => null);
      if (assignedWorker && assignedWorker.lat && assignedWorker.lng && pLat && pLng) {
        const dist = calculateDistance(pLat, pLng, assignedWorker.lat, assignedWorker.lng);
        if (dist > 5.0) {
          return res.status(400).json({
            message: `⚠️ Handyman "${assignedWorker.name}" is ${dist} km away. Suggestions and dispatches are restricted to a maximum 5 km radius.`,
          });
        }
      }
    }

    const now = new Date();
    const autoDate = now.toISOString().split('T')[0];
    const autoTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const createdBooking = await Booking.create({
      customer: customerId,
      worker: assignedWorker?._id || null,
      trade: trade || assignedWorker?.trade || 'Plumbing',
      serviceTier,
      pickupLat: pLat || 9.8433,
      pickupLng: pLng || 78.4809,
      userLat: pLat || 9.8433,
      userLng: pLng || 78.4809,
      distanceKm: 1.8,
      date: autoDate,
      time: autoTime,
      address: address || 'Tamil Nadu, Tamil Nadu',
      price: Number(price) || assignedWorker?.ratePerHour || 350,
      notes: notes || 'Dispatched via SmartFix On-Demand Engine',
      status: 'Pending',
      aiSuggested: aiSuggested || undefined,
    });

    const populated = await Booking.findById(createdBooking._id)
      .populate('customer', 'name phone')
      .populate('worker', 'name phone trade ratePerHour location rating ratingCount');

    // Broadcast Socket.IO event if io instance is attached
    const io = req.app?.get('io');
    if (io) {
      io.emit('booking-created', populated);
      io.emit('booking-updated', populated);
      if (assignedWorker?._id) {
        io.to(`user-${assignedWorker._id}`).emit('new-booking-request', populated);
        io.to(`worker-${assignedWorker._id}`).emit('new-booking-request', populated);
      } else {
        await dispatchService.startDispatch(createdBooking._id, io);
      }
    }

    // Security Rule: Status is 'Pending', so sanitize booking & assigned captain object
    const sanitizedBooking = sanitizeBookingForRole(populated, req.user?.id, req.user?.role);

    res.status(201).json({
      message: `On-demand dispatch ticket initiated! Request sent to ${assignedWorker?.name || 'Handyman'}.`,
      booking: sanitizedBooking,
      assignedCaptain: {
        id: assignedWorker?._id || null,
        name: assignedWorker?.name || 'Assigned Handyman',
        // Phone and rating omitted for Pending status
        distanceKm: 1.8,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Dispatch request failed', error: err.message });
  }
};

exports.acceptDispatch = async (req, res) => {
  try {
    const { attemptId, bookingId } = req.body;
    const workerId = req.user?.id;

    // 1. Atomic Booking Update
    const booking = await Booking.findOneAndUpdate(
      { _id: bookingId, status: 'Pending' },
      { $set: { status: 'Accepted', worker: workerId, acceptedAt: new Date(), slaDeadline: new Date(Date.now() + 60 * 60 * 1000) } },
      { new: true }
    ).populate('customer');

    if (!booking) {
      return res.status(400).json({ message: 'Booking is no longer available or already accepted.' });
    }

    // 2. Atomic Worker Update
    const worker = await User.findOneAndUpdate(
      { _id: workerId, availabilityStatus: 'Available' },
      { $set: { availabilityStatus: 'Busy' } },
      { new: true }
    );

    if (!worker) {
      // Rollback booking if worker is not available (this is rare but needed for clean state)
      await Booking.findByIdAndUpdate(bookingId, { $set: { status: 'Pending', worker: null, acceptedAt: null, slaDeadline: null } });
      return res.status(400).json({ message: 'You are no longer marked as Available.' });
    }

    // 3. Mark Attempt as Accepted
    if (attemptId) {
      await DispatchAttempt.findByIdAndUpdate(attemptId, { status: 'Accepted' });
    }

    // Create Proxy Session via Twilio API
    const proxyData = await createProxySession(booking._id, booking.customer.phone, worker.phone);
    if (proxyData) {
      booking.proxySessionSid = proxyData.sessionSid;
      booking.proxyNumber = proxyData.proxyNumber;
      await booking.save();
    }

    // Emit socket events (similar to providerAcceptBooking)
    const io = req.app?.get('io');
    if (io) {
      io.to(`user-${booking.customer._id}`).emit('booking-accepted', {
        bookingId: booking._id,
        provider: booking.worker,
        slaDeadline: booking.slaDeadline,
        message: 'Your booking has been accepted! Provider is on the way.',
      });
      io.to(`booking-${booking._id}`).emit('booking-status-changed', { bookingId: booking._id, status: 'Accepted', slaDeadline: booking.slaDeadline });
      io.emit('booking-updated', booking);
    }

    res.status(200).json({ message: 'Job accepted successfully!', booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to accept job', error: err.message });
  }
};

exports.declineDispatch = async (req, res) => {
  try {
    const { attemptId, bookingId } = req.body;
    
    if (attemptId) {
      await DispatchAttempt.findByIdAndUpdate(attemptId, { status: 'Declined' });
    }

    // Trigger next dispatch
    const io = req.app?.get('io');
    await dispatchService.dispatchNext(bookingId, io);

    res.status(200).json({ message: 'Job declined.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to decline job', error: err.message });
  }
};
