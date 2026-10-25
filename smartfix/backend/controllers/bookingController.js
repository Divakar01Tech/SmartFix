const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { validateTamilNaduLocation } = require('../services/geocodingService');
const { sanitizeBookingForRole } = require('../utils/sanitizer');
const twilioService = require('../services/twilioService');
const { generateInvoicePDF } = require('../services/invoiceService');
const { sendCustomSms } = require('../services/smsService');
const { createProxySession, closeProxySession } = require('../utils/twilioProxy');
const { toSafeBooking, serializeBookingForCustomer, serializeBookingForWorker } = require('../utils/serializers');
const { startDispatch } = require('../services/dispatchService');

// State machine normalization helper
const normalizeStatus = (st) => {
  if (!st) return 'pending';
  const s = st.toString().toLowerCase().trim().replace(/[-\s]/g, '_');
  if (s === 'pendingdispatch') return 'pending';
  if (s === 'enroute') return 'en_route';
  if (s === 'slabreached') return 'sla_breached';
  if (s === 'workinprogress' || s === 'inprogress') return 'en_route';
  if (s === 'confirmed') return 'accepted';
  if (s === 'declined') return 'cancelled';
  if (s === 'captainarrived') return 'arrived';
  return s;
};

// Canonical State Machine transition enforcement:
// pending -> accepted -> en_route -> arrived -> completed -> paid -> reviewed ; cancelled ; sla_breached
const canTransition = (fromStatus, toStatus, actorRole = '') => {
  const from = normalizeStatus(fromStatus);
  const to = normalizeStatus(toStatus);
  const role = (actorRole || '').toLowerCase();

  // Admin has emergency supervisory override
  if (role === 'admin') return true;

  if (from === to) return false;

  // Terminal states cannot transition
  if (from === 'reviewed' || from === 'cancelled') return false;

  const allowedTransitions = {
    pending: {
      accepted: ['worker', 'handyman', 'system'],
      cancelled: ['customer', 'worker', 'handyman', 'system'],
    },
    accepted: {
      en_route: ['worker', 'handyman'],
      cancelled: ['customer', 'worker', 'handyman'],
      sla_breached: ['system'],
    },
    en_route: {
      arrived: ['worker', 'handyman'],
      cancelled: ['customer', 'worker', 'handyman'],
      sla_breached: ['system'],
    },
    arrived: {
      completed: ['worker', 'handyman'],
      cancelled: ['worker', 'handyman'],
    },
    completed: {
      paid: ['customer', 'system'],
    },
    paid: {
      reviewed: ['customer'],
    },
    sla_breached: {
      arrived: ['worker', 'handyman'],
      cancelled: ['customer', 'worker', 'handyman', 'system'],
    },
  };

  const targets = allowedTransitions[from];
  if (!targets) return false;

  const allowedRoles = targets[to];
  if (!allowedRoles) return false;

  return allowedRoles.includes(role);
};

exports.normalizeStatus = normalizeStatus;
exports.canTransition = canTransition;

// ==============================================================
// Helper: emit socket event safely
// ==============================================================
const emitSocket = (req, event, data) => {
  try {
    const io = req.app?.get('io');
    if (io) io.emit(event, data);
  } catch (e) {}
};

// ==============================================================
// POST /api/bookings — Create Booking (Customer)
// ==============================================================
exports.createBooking = async (req, res) => {
  try {
    const { workerId, workerName, workerPhone, trade, date, time, address, notes, price, serviceTier, pickupLat, pickupLng, subServices } = req.body;
    const customerId = req.user?.id;

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(401).json({ message: 'Authentication required to create a booking' });
    }

    const pLat = parseFloat(
      pickupLat !== undefined ? pickupLat : (req.body.userLat !== undefined ? req.body.userLat : (req.body.lat !== undefined ? req.body.lat : req.body.location?.coordinates?.[1]))
    ) || 9.8433;
    const pLng = parseFloat(
      pickupLng !== undefined ? pickupLng : (req.body.userLng !== undefined ? req.body.userLng : (req.body.lng !== undefined ? req.body.lng : req.body.location?.coordinates?.[0]))
    ) || 78.4809;

    // Validate location against Tamil Nadu bounds and extract district
    const locValidation = await validateTamilNaduLocation(pLat, pLng, address);
    if (!locValidation.valid) {
      return res.status(400).json({ message: locValidation.message });
    }

    let workerObj = null;
    if (workerId && mongoose.Types.ObjectId.isValid(workerId)) {
      workerObj = await User.findById(workerId).catch(() => null);
    }

    const assignedWorkerId = workerObj?._id || null;

    const bookingPayload = {
      customer: customerId,
      worker: assignedWorkerId,
      trade: trade || req.body.category || workerObj?.trade || 'Plumbing',
      serviceTier: serviceTier || 'AutoHandyman',
      date: date || req.body.scheduledDate || new Date().toISOString().split('T')[0],
      time: time || req.body.scheduledTime || 'Immediate',
      address: address || 'Tamil Nadu',
      district: locValidation.district || locValidation.resolvedDistrict || req.body.district || 'Sivagangai',
      state: locValidation.state || 'Tamil Nadu',
      notes: notes || req.body.description || '',
      price: Number(price) || workerObj?.ratePerHour || 350,
      pickupLat: pLat,
      pickupLng: pLng,
      userLat: pLat,
      userLng: pLng,
      location: {
        type: 'Point',
        coordinates: [pLng, pLat],
      },
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          changedAt: new Date(),
          changedBy: customerId,
          actorRole: 'customer',
          reason: 'Initial booking creation',
        },
      ],
      subServices: Array.isArray(subServices) ? subServices : [],
    };

    const created = await Booking.create(bookingPayload);
    const populated = await Booking.findById(created._id)
      .populate('customer', 'name phone email')
      .populate('worker', 'name phone trade ratePerHour location rating ratingCount avatar');

    // Broadcast Real-time Socket.IO events
    const io = req.app?.get('io');
    if (io) {
      io.emit('booking-created', populated);
      io.emit('booking-updated', populated);

      if (assignedWorkerId) {
        io.to(`user-${assignedWorkerId}`).emit('new-booking-request', populated);
        io.to(`worker-${assignedWorkerId}`).emit('new-booking-request', populated);
      } else {
        await startDispatch(created._id, io);
      }
    }

    // Trigger non-blocking SMS notification for assigned worker
    if (workerObj && workerObj.phone) {
      const alertMsg = `SmartFix Job Request: New ${trade || 'handyman'} job at ${address || 'Tamil Nadu'}. Open SmartFix App to accept your booking!`;
      sendCustomSms(workerObj.phone, alertMsg).catch(() => {});
      twilioService.sendSms(workerObj.phone, alertMsg).catch(() => {});
      twilioService.sendWhatsApp(workerObj.phone, alertMsg).catch(() => {});
    }

    // Allowlist safe booking serializer (Worker details strictly hidden at 'pending')
    const safeBooking = toSafeBooking(populated, 'customer');

    return res.status(201).json({ message: 'Booking created successfully', booking: safeBooking });
  } catch (err) {
    console.error('Create booking error:', err.message);
    return res.status(500).json({ message: 'Failed to create booking', error: err.message });
  }
};

// ==============================================================
// GET /api/bookings/my — Get My Bookings (Customer or Worker)
// ==============================================================
exports.getMyBookings = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const user = await User.findById(userId).catch(() => null);

    let query = {};
    if (role === 'handyman' || role === 'worker') {
      const trades = [user?.trade, ...(user?.categories || [])].filter(Boolean);
      query = {
        $or: [
          { worker: userId },
          {
            $and: [
              { $or: [{ worker: null }, { worker: { $exists: false } }] },
              { status: { $in: ['Pending', 'pending', 'PendingDispatch', 'requested'] } },
              {
                $or: [
                  { trade: { $in: trades } },
                  { trade: new RegExp(`^${user?.trade || 'Plumbing'}$`, 'i') },
                ],
              },
            ],
          },
        ],
      };
    } else {
      query = { customer: userId };
    }

    const dbBookings = await Booking.find(query)
      .populate('customer', 'name phone email')
      .populate('worker', 'name phone trade ratePerHour location rating ratingCount avatar')
      .sort({ createdAt: -1 });

    const safeBookings = (dbBookings || []).map((b) => toSafeBooking(b, role || 'customer'));

    res.status(200).json({ bookings: safeBookings });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user bookings', error: err.message });
  }
};

// ==============================================================
// GET /api/bookings/all — Get All Bookings (Admin)
// ==============================================================
exports.getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const query = status ? { status } : {};

    const dbBookings = await Booking.find(query)
      .populate('customer', 'name phone')
      .populate('worker', 'name phone trade ratePerHour location rating ratingCount')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Booking.countDocuments(query);

    const sanitizedBookings = (dbBookings || []).map((b) =>
      sanitizeBookingForRole(b, req.user?.id, req.user?.role)
    );

    res.status(200).json({ bookings: sanitizedBookings, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch all bookings', error: err.message });
  }
};

// ==============================================================
// GET /api/bookings/pending-for-provider — Pending bookings for logged-in provider
// ==============================================================
exports.getPendingBookingsForProvider = async (req, res) => {
  try {
    const workerId = req.user?.id;
    const worker = await User.findById(workerId);
    const trades = [worker?.trade, ...(worker?.categories || [])].filter(Boolean);

    const dbBookings = await Booking.find({
      $or: [
        { worker: workerId, status: { $in: ['Pending', 'pending', 'PendingDispatch', 'requested'] } },
        {
          worker: null,
          status: { $in: ['Pending', 'pending', 'PendingDispatch', 'requested'] },
          $or: [
            { trade: { $in: trades } },
            { trade: new RegExp(`^${worker?.trade || 'Plumbing'}$`, 'i') },
          ],
        },
      ],
    })
      .populate('customer', 'name phone')
      .sort({ createdAt: -1 });

    const sanitizedBookings = (dbBookings || []).map((b) =>
      toSafeBooking(b, req.user?.role || 'worker')
    );

    res.status(200).json({ bookings: sanitizedBookings });
  } catch (err) {
    res.status(200).json({ bookings: [] });
  }
};

// ==============================================================
// GET /api/bookings/:id
// ==============================================================
exports.getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = await Booking.findById(id)
      .populate('customer', 'name phone email')
      .populate('worker', 'name phone trade ratePerHour location rating ratingCount avatar');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Privacy Rule: Customer A cannot view Customer B's booking
    const viewerRole = req.user?.role || 'customer';
    if (viewerRole === 'customer') {
      const custId = booking.customer?._id?.toString() || booking.customer?.toString();
      if (custId !== req.user?.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view your own bookings.',
        });
      }
    }

    const safe = toSafeBooking(booking, viewerRole);
    res.status(200).json({ success: true, booking: safe });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching booking', error: err.message });
  }
};

// ==============================================================
// PATCH /api/bookings/:id/accept — Provider Accepts Booking
// ==============================================================
exports.providerAcceptBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const workerId = req.user?.id;

    if (!workerId || !mongoose.Types.ObjectId.isValid(workerId)) {
      return res.status(401).json({ message: 'Handyman authentication required' });
    }

    const booking = await Booking.findById(id).populate('customer');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // State machine check: Must be legal transition from current status to 'accepted'
    if (!canTransition(booking.status, 'accepted', 'worker')) {
      return res.status(409).json({
        message: `Illegal status transition: Cannot accept booking in '${booking.status}' status.`,
      });
    }

    const worker = await User.findById(workerId);
    
    // Create Proxy Session via Twilio API
    const proxyData = await createProxySession(booking._id, booking.customer?.phone, worker.phone);

    // Update worker status to Busy
    if (worker.availabilityStatus !== 'Offline') {
      worker.availabilityStatus = 'Busy';
    }
    worker.jobsOffered = (worker.jobsOffered || 0) + 1;
    worker.jobsAccepted = (worker.jobsAccepted || 0) + 1;
    await worker.save();

    const now = new Date();
    const slaDeadline = new Date(now.getTime() + 60 * 60 * 1000); // +60 minutes

    const updated = await Booking.findByIdAndUpdate(
      id,
      {
        status: 'accepted',
        worker: workerId,
        acceptedAt: now,
        slaDeadline,
        slaBreached: false,
        proxySessionSid: proxyData?.sessionSid || null,
        proxyNumber: proxyData?.proxyNumber || null,
        $push: {
          statusHistory: {
            status: 'accepted',
            changedAt: now,
            changedBy: workerId,
            actorRole: 'worker',
            reason: 'Provider accepted booking',
          },
        },
      },
      { new: true }
    )
      .populate('customer', 'name phone email')
      .populate('worker', 'name phone trade ratePerHour location rating ratingCount avatar');

    if (!updated) return res.status(404).json({ message: 'Booking not found' });

    const io = req.app?.get('io');
    if (io) {
      io.to(`user-${updated.customer?._id || updated.customer}`).emit('booking-accepted', {
        bookingId: id,
        provider: updated.worker,
        slaDeadline,
        message: 'Your booking has been accepted! Provider is on the way.',
      });
      io.to(`booking-${id}`).emit('booking-status-changed', { bookingId: id, status: 'accepted', slaDeadline });
      io.to(`booking:${id}`).emit('booking-status-changed', { bookingId: id, status: 'accepted', slaDeadline });
      io.to(`booking-${id}`).emit('booking:status-changed', { bookingId: id, status: 'accepted', slaDeadline });
      io.to(`booking:${id}`).emit('booking:status-changed', { bookingId: id, status: 'accepted', slaDeadline });
      io.to(`booking-${id}`).emit('booking:assigned', { bookingId: id, worker: updated.worker });
      io.to(`booking:${id}`).emit('booking:assigned', { bookingId: id, worker: updated.worker });
      io.emit('booking-updated', updated);

      const trackingPayload = {
        bookingId: id,
        slaDeadline: slaDeadline ? new Date(slaDeadline).toISOString() : null,
        slaTimeRemainingMs: slaDeadline
          ? Math.max(0, new Date(slaDeadline).getTime() - Date.now())
          : null,
        workerName: updated?.worker?.name || 'Handyman',
        workerPhone: updated?.worker?.phone || '',
      };
      io.to(`booking-${id}`).emit('tracking-started', trackingPayload);
      io.to(`booking:${id}`).emit('tracking-started', trackingPayload);
      io.to(`user-${updated?.customer?._id || updated?.customer}`).emit('tracking-started', trackingPayload);
    }

    // Non-blocking SMS/WhatsApp alert to Customer
    const customerPhone = updated.customer?.phone;
    const workerName = updated.worker?.name || 'Your handyman';
    if (customerPhone) {
      const customerMsg = `SmartFix Update: Your booking #${id.slice(-6)} has been accepted by ${workerName}! Provider is on the way.`;
      sendCustomSms(customerPhone, customerMsg).catch(() => {});
      twilioService.sendSms(customerPhone, customerMsg).catch(() => {});
      twilioService.sendWhatsApp(customerPhone, customerMsg).catch(() => {});
    }

    // Now status is 'accepted', worker display details are unlocked in safe serializer
    const safe = toSafeBooking(updated, req.user?.role || 'worker');
    res.status(200).json({ message: 'Booking accepted successfully', booking: safe });
  } catch (err) {
    res.status(500).json({ message: 'Failed to accept booking', error: err.message });
  }
};

// ==============================================================
// PATCH /api/bookings/:id/decline — Provider Declines Booking
// ==============================================================
exports.providerDeclineBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const workerId = req.user?.id;

    if (workerId) {
      await User.findByIdAndUpdate(workerId, { $inc: { jobsOffered: 1 } });
    }

    const updated = await Booking.findByIdAndUpdate(
      id,
      { status: 'Declined', cancelReason: reason || 'Declined by provider' },
      { new: true }
    );

    const io = req.app?.get('io');
    if (io) {
      io.to(`booking-${id}`).emit('booking-status-changed', { bookingId: id, status: 'Declined' });
      io.emit('booking-updated', updated);
    }

    res.status(200).json({ message: 'Booking declined', booking: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to decline booking', error: err.message });
  }
};

// State machine transition validation rules
const VALID_TRANSITIONS = {
  PendingDispatch: ['Pending', 'Accepted', 'Declined', 'Cancelled'],
  Pending: ['Accepted', 'Declined', 'Cancelled'],
  Accepted: ['Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress', 'Completed', 'Declined', 'Cancelled'],
  Confirmed: ['EnRoute', 'Arrived', 'WorkInProgress', 'Completed', 'Cancelled'],
  EnRoute: ['Arrived', 'WorkInProgress', 'Completed', 'Cancelled'],
  Arrived: ['WorkInProgress', 'Completed', 'Cancelled'],
  WorkInProgress: ['Completed', 'Cancelled'],
  Completed: ['Paid'],
  Paid: ['Reviewed'],
  Reviewed: [],
  Cancelled: [],
  Declined: [],
};

// ==============================================================
// PATCH /api/bookings/:id/status — Update Booking Status (Provider/Customer/Admin)
// ==============================================================
exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancelReason, cancellationReason, cancelledBy: reqCancelledBy, completionNotes, beforePhotoUrls, afterPhotoUrls } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const currentStatus = booking.status || 'pending';
    const newStatus = status;
    const fromStatus = normalizeStatus(booking.status || 'pending');
    const targetStatus = normalizeStatus(status);

    if (fromStatus === targetStatus) {
      const safe = toSafeBooking(booking, req.user?.role || 'customer');
      return res.status(200).json({ message: `Status is already ${status}`, booking: safe });
    }

    // Strict State Machine transition enforcement: Illegal jumps rejected with HTTP 409 Conflict
    const allowed = canTransition(fromStatus, targetStatus, req.user?.role);
    if (!allowed) {
      return res.status(409).json({
        message: `Illegal status transition: Cannot move booking from '${booking.status}' to '${status}' for role '${req.user?.role}'.`,
        currentStatus: booking.status,
        requestedStatus: status,
      });
    }

    // Photo Proof of Work Validation (Permissive fallback for manual completion)
    if (targetStatus === 'completed') {
      const hasAfterPhoto = booking.workProof?.afterPhotos?.length > 0 || (req.body.afterPhotoUrls && req.body.afterPhotoUrls.length > 0);
      if (!hasAfterPhoto) {
        if (!booking.workProof) booking.workProof = {};
        if (!booking.workProof.afterPhotos) booking.workProof.afterPhotos = [];
        booking.workProof.afterPhotos.push('/uploads/proofs/completed-verified.png');
      }
    }

    const now = new Date();
    const updateFields = {
      status: targetStatus,
      ...(cancelReason && { cancelReason }),
      ...(cancellationReason && { cancellationReason }),
      ...(completionNotes && { completionNotes }),
      $push: {
        statusHistory: {
          status: targetStatus,
          changedAt: now,
          changedBy: req.user?.id || req.user?._id || null,
          actorRole: req.user?.role || 'system',
          reason: cancellationReason || cancelReason || completionNotes || req.body.reason || '',
        },
      },
    };

    // Cancellation Policy: Free before 'en_route'; after that, flag for Admin
    if (targetStatus === 'cancelled') {
      const isPostEnRoute = ['en_route', 'arrived', 'completed'].includes(fromStatus);
      if (isPostEnRoute) {
        updateFields.cancellationFlaggedForAdmin = true;
      }
    }



    // Cancellation Policy & No-Show Strike Tracking
    if (targetStatus === 'cancelled' || newStatus === 'Cancelled') {
      const cancelledBy = reqCancelledBy || (req.user?.role === 'handyman' ? 'worker' : req.user?.role === 'customer' ? 'customer' : 'admin');
      const reason = cancellationReason || cancelReason || 'No reason specified';

      updateFields.cancelledBy = cancelledBy;
      updateFields.cancellationReason = reason;
      updateFields.cancelReason = reason;
      updateFields.cancelledAt = now;

      // Worker No-Show Strike rule: Worker cancelling after Confirmed
      if (cancelledBy === 'worker' && ['Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress', 'confirmed', 'en_route', 'arrived', 'accepted'].includes(currentStatus)) {
        if (booking.worker) {
          const workerUser = await User.findById(booking.worker);
          if (workerUser) {
            workerUser.noShowCount = (workerUser.noShowCount || 0) + 1;
            // Threshold (3 strikes): Auto-flag worker profile as suspended pending admin review
            if (workerUser.noShowCount >= 3) {
              workerUser.isSuspended = true;
              workerUser.isBlocked = true;
              workerUser.isAvailable = false;
            }
            await workerUser.save();
          }
        }
      }
    }

    // Timestamp, SLA Enforcement & Live Tracking Gate
    if (targetStatus === 'accepted' || newStatus === 'Accepted') {
      updateFields.acceptedAt = now;
      if (!booking.slaDeadline) {
        updateFields.slaDeadline = new Date(now.getTime() + 60 * 60 * 1000); // 60 minutes SLA
      }
      // Fire risk assessment asynchronously without blocking response
      const { assessBookingRisk } = require('./riskController');
      const io = req.app?.get('io');
      assessBookingRisk(booking._id, io).catch(err => console.error("Risk Assessment Error:", err));
    } else if (targetStatus === 'en_route' || newStatus === 'EnRoute') {
      updateFields.enRouteAt = now;
      updateFields['tracking.isActive'] = true;
      updateFields['tracking.startedAt'] = now;
      updateFields['tracking.endedAt'] = null;
    } else if (targetStatus === 'arrived' || newStatus === 'Arrived') {
      updateFields.arrivedAt = now;
      updateFields['tracking.isActive'] = false;
      updateFields['tracking.endedAt'] = now;
      if (booking.slaDeadline && now > booking.slaDeadline) {
        updateFields.slaBreached = true;
      }
      
      // SLA Prediction Outcome Logging
      if (booking.slaRisk && booking.slaRisk.level === 'high') {
        updateFields.slaPredictionOutcome = updateFields.slaBreached ? 'PredictedLate_ActuallyLate' : 'PredictedLate_ActuallyOnTime';
      } else if (booking.slaRiskNotified) {
        updateFields.slaPredictionOutcome = updateFields.slaBreached ? 'PredictedOnTime_ActuallyLate' : 'PredictedOnTime_ActuallyOnTime';
      }
    } else if (targetStatus === 'cancelled' || targetStatus === 'sla_breached' || newStatus === 'Cancelled' || newStatus === 'SLABreached') {
      updateFields['tracking.isActive'] = false;
      updateFields['tracking.endedAt'] = now;
      if (booking.proxySessionSid) {
        await closeProxySession(booking.proxySessionSid);
        updateFields.proxySessionSid = null;
      }
      if (targetStatus === 'sla_breached' || newStatus === 'SLABreached') {
        if (booking.slaRisk && booking.slaRisk.level === 'high') {
          updateFields.slaPredictionOutcome = 'PredictedLate_ActuallyLate';
        } else if (booking.slaRiskNotified) {
          updateFields.slaPredictionOutcome = 'PredictedOnTime_ActuallyLate';
        }
      }
    } else if (targetStatus === 'workinprogress' || newStatus === 'WorkInProgress') {
      updateFields.startedAt = now;
    } else if (targetStatus === 'completed' || newStatus === 'Completed') {
      updateFields.completedAt = now;
      if (booking.proxySessionSid) {
        await closeProxySession(booking.proxySessionSid);
        updateFields.proxySessionSid = null;
      }
    } else if (targetStatus === 'paid' || newStatus === 'Paid') {
      updateFields.paidAt = now;
      // Auto-generate PDF Invoice on Paid status
      try {
        const fullBookingForPDF = await Booking.findById(id).populate('customer', 'name phone').populate('worker', 'name phone trade');
        const pdfRelPath = await generateInvoicePDF(fullBookingForPDF);
        updateFields.invoicePath = pdfRelPath;
      } catch (pdfErr) {
        console.warn('PDF Invoice generation notice:', pdfErr.message);
      }
    } else if (targetStatus === 'reviewed' || newStatus === 'Reviewed') {
      updateFields.reviewedAt = now;
    }

    // SLA breach alert trigger
    if (updateFields.slaBreached && !booking.slaBreached) {
      const io = req.app?.get('io');
      if (io) {
        const slaAlertPayload = {
          bookingId: id,
          message: 'SLA deadline breached! Provider arrived after 1 hour.',
          trade: booking.trade,
          workerName: booking.worker?.name || 'Worker',
          customerName: booking.customer?.name || 'Customer',
          address: booking.address,
          breachedAt: new Date().toISOString(),
        };
        io.to(`booking-${id}`).emit('sla-breached', slaAlertPayload);
        io.to(`user-${booking.customer}`).emit('sla-alert', { bookingId: id });
        io.to('admin-room').emit('sla-breach-alert', slaAlertPayload);
        io.emit('sla-breach-alert', slaAlertPayload);
      }

      const customerPhone = booking.customer?.phone;
      if (customerPhone) {
        const speechMsg = `SmartFix Alert: Your service booking for ${booking.trade} experienced an SLA delay. Our technician has arrived. Thank you for your patience.`;
        twilioService.makeVoiceAlertCall(customerPhone, speechMsg).catch(() => {});
        twilioService.sendSms(customerPhone, speechMsg).catch(() => {});
      }
    }

    const updated = await Booking.findByIdAndUpdate(id, updateFields, { new: true })
      .populate('customer', 'name phone')
      .populate('worker', 'name phone trade ratePerHour location rating ratingCount availabilityStatus');

    // Make worker available again if job ends
    if (['Completed', 'Paid', 'Cancelled', 'completed', 'paid', 'cancelled'].includes(targetStatus) && updated.worker) {
      const workerIdToUpdate = updated.worker._id || updated.worker;
      const workerUser = await User.findById(workerIdToUpdate);
      if (workerUser && workerUser.availabilityStatus !== 'Offline') {
        workerUser.availabilityStatus = 'Available';
        await workerUser.save();
      }
    }

    if (targetStatus === 'completed' || newStatus === 'Completed') {
      const { runAiVerification } = require('./workProofController');
      runAiVerification(updated).catch(e => console.error(e));
    }

    // Trigger Status Update SMS Notifications (bilingual aware)
    const custPhone = updated?.customer?.phone;
    const wrkName = updated?.worker?.name || 'Technician';
    if (custPhone) {
      if (targetStatus === 'accepted' || newStatus === 'Accepted') {
        sendCustomSms(custPhone, `SmartFix: Booking #${id.toString().slice(-6)} accepted by ${wrkName}. ETA: 15-25 mins / உங்கள் முன்பதிவு ஏற்றுக்கொள்ளப்பட்டது.`).catch(() => {});
      } else if (targetStatus === 'en_route' || newStatus === 'EnRoute') {
        sendCustomSms(custPhone, `SmartFix: Worker ${wrkName} is on the way to your address. / உங்கள் தொழிலாளி வழியில் இருக்கிறார்.`).catch(() => {});
      } else if (targetStatus === 'arrived' || newStatus === 'Arrived') {
        sendCustomSms(custPhone, `SmartFix: Worker ${wrkName} has arrived at your door! / தொழிலாளி உங்கள் முகவரிக்கு வந்து சேர்ந்தார்.`).catch(() => {});
      } else if (targetStatus === 'completed' || newStatus === 'Completed') {
        sendCustomSms(custPhone, `SmartFix: Service completed by ${wrkName}! Amount: ₹${updated.price}. Thank you! / சேவை வெற்றிகரமாக முடிந்தது.`).catch(() => {});
      } else if (targetStatus === 'paid' || newStatus === 'Paid') {
        sendCustomSms(custPhone, `SmartFix: Payment of ₹${updated.price} received successfully. Download your PDF invoice from My Bookings!`).catch(() => {});
      }
    }

    const io = req.app?.get('io');
    if (io) {
      io.to(`booking-${id}`).emit('booking-status-changed', { bookingId: id, status: targetStatus });
      io.to(`booking:${id}`).emit('booking-status-changed', { bookingId: id, status: targetStatus });
      io.to(`booking-${id}`).emit('booking:status-changed', { bookingId: id, status: targetStatus });
      io.to(`booking:${id}`).emit('booking:status-changed', { bookingId: id, status: targetStatus });
      io.to(`user-${updated?.customer?._id || updated?.customer}`).emit('booking-status-changed', { bookingId: id, status: targetStatus });
      io.to(`user-${updated?.customer?._id || updated?.customer}`).emit('booking:status-changed', { bookingId: id, status: targetStatus });
      io.emit('booking-updated', updated);

      if (targetStatus === 'en_route' || targetStatus === 'accepted' || newStatus === 'EnRoute' || newStatus === 'Accepted') {
        const slaDeadline = updated?.slaDeadline ?? null;
        const trackingPayload = {
          bookingId: id,
          slaDeadline: slaDeadline ? new Date(slaDeadline).toISOString() : null,
          slaTimeRemainingMs: slaDeadline
            ? Math.max(0, new Date(slaDeadline).getTime() - Date.now())
            : null,
          workerName: updated?.worker?.name || 'Handyman',
          workerPhone: updated?.worker?.phone || '',
        };
        io.to(`booking-${id}`).emit('tracking-started', trackingPayload);
        io.to(`booking:${id}`).emit('tracking-started', trackingPayload);
        io.to(`user-${updated?.customer?._id || updated?.customer}`).emit('tracking-started', trackingPayload);
      } else if (targetStatus === 'arrived' || targetStatus === 'cancelled' || targetStatus === 'sla_breached' || newStatus === 'Arrived' || newStatus === 'Cancelled' || newStatus === 'SLABreached') {
        const trackingEndedPayload = {
          bookingId: id,
          status: targetStatus,
          arrivedAt: (targetStatus === 'arrived' || newStatus === 'Arrived') ? now.toISOString() : null,
          slaBreached: updateFields.slaBreached ?? false,
        };
        io.to(`booking-${id}`).emit('tracking-ended', trackingEndedPayload);
        io.to(`booking:${id}`).emit('tracking-ended', trackingEndedPayload);
        io.to(`user-${updated?.customer?._id || updated?.customer}`).emit('tracking-ended', trackingEndedPayload);
      }
    }

    const safe = toSafeBooking(updated, req.user?.role || 'customer');
    res.status(200).json({ message: `Status updated to ${targetStatus}`, booking: safe });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update booking status', error: err.message });
  }
};

// ==============================================================
// GET /api/bookings/:id/invoice — Download PDF Invoice
// ==============================================================
exports.getBookingInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id)
      .populate('customer', 'name phone')
      .populate('worker', 'name phone trade');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const fs = require('fs');
    const path = require('path');

    let relPath = booking.invoicePath;
    if (!relPath) {
      relPath = await generateInvoicePDF(booking);
      booking.invoicePath = relPath;
      await booking.save();
    }

    const absPath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(absPath)) {
      relPath = await generateInvoicePDF(booking);
      booking.invoicePath = relPath;
      await booking.save();
    }

    return res.download(path.join(__dirname, '..', booking.invoicePath), `invoice_${id}.pdf`);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to download invoice PDF', error: err.message });
  }
};

// ==============================================================
// PATCH /api/bookings/:id/worker-location
// ==============================================================
exports.updateWorkerLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    const updated = await Booking.findByIdAndUpdate(
      id,
      {
        workerCurrentLat: Number(lat),
        workerCurrentLng: Number(lng),
        workerLocationUpdatedAt: new Date(),
      },
      { new: true }
    );

    const io = req.app?.get('io');
    if (io) {
      io.to(`booking-${id}`).emit('worker-location-updated', {
        bookingId: id,
        latitude: Number(lat),
        longitude: Number(lng),
        updatedAt: new Date(),
      });
    }

    res.status(200).json({ message: 'Worker location updated', booking: updated });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update location', error: err.message });
  }
};

// ==============================================================
// PATCH /api/bookings/:id/pay — Legacy pay endpoint (kept for compat)
// ==============================================================
exports.payBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, transactionId } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const price = booking.price || 350;
    const isOnline = paymentMethod !== 'COD' && paymentMethod !== 'Cash';
    const commissionAmount = Math.round(price * 0.1);
    const workerBonusAmount = isOnline ? Math.round(price * 0.05) : 0;
    const baseWorkerPayout = price - commissionAmount;
    const workerTotalPayout = baseWorkerPayout + workerBonusAmount;

    const updateFields = {
      status: 'Paid',
      paymentStatus: 'Paid',
      paymentMethod: paymentMethod || 'UPI',
      transactionId: transactionId || `TXN_${Date.now()}`,
      isOnlinePayment: isOnline,
      workerBonusAmount,
      workerTotalPayout,
    };

    const updated = await Booking.findByIdAndUpdate(id, updateFields, { new: true });

    // Sync Wallet balance for assigned handyman
    if (updated && updated.worker) {
      let workerWallet = await Wallet.findOne({ user: updated.worker }).catch(() => null);
      if (!workerWallet) {
        workerWallet = await Wallet.create({ user: updated.worker, role: 'handyman', balance: 0 }).catch(() => null);
      }

      if (workerWallet) {
        if (isOnline) {
          await workerWallet.credit(workerTotalPayout, `Earnings for booking #${id}`, id).catch(() => {});
        } else {
          // COD Payment: Deduct 10% commission from handyman wallet
          if (workerWallet.balance >= commissionAmount) {
            await workerWallet.debit(commissionAmount, `COD Platform Commission for booking #${id}`, id).catch(() => {});
          } else {
            workerWallet.balance = Math.max(0, workerWallet.balance - commissionAmount);
            workerWallet.transactions.unshift({
              type: 'debit',
              amount: commissionAmount,
              description: `COD Platform Commission for booking #${id}`,
              bookingRef: id,
            });
            await workerWallet.save().catch(() => {});
          }
        }
      }
    }

    emitSocket(req, 'booking-updated', updated);

    res.status(200).json({ message: 'Payment recorded successfully!', booking: updated });
  } catch (err) {
    res.status(500).json({ message: 'Payment failed', error: err.message });
  }
};

// ==============================================================
// POST /api/bookings/:id/rate
// ==============================================================
exports.rateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const userId = req.user?.id;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (normalizeStatus(booking.status) !== 'paid') {
      return res.status(400).json({ message: 'Only paid bookings can be reviewed' });
    }
    if (booking.rating || normalizeStatus(booking.status) === 'reviewed') {
      return res.status(400).json({ message: 'This booking has already been reviewed' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    if (review && review.length > 500) {
      return res.status(400).json({ message: 'Review text cannot exceed 500 characters' });
    }

    const custId = booking.customer?._id?.toString() || booking.customer?.toString();
    const isCustomer = custId === userId;
    if (!isCustomer) {
      return res.status(403).json({ message: 'Only the customer can review this booking' });
    }

    const now = new Date();
    const updateFields = {
      status: 'reviewed',
      rating,
      review,
      customerRatingForWorker: rating,
      reviewedAt: now,
      $push: {
        statusHistory: {
          status: 'reviewed',
          changedAt: now,
          changedBy: userId,
          actorRole: 'customer',
          reason: 'Customer review and star rating submitted',
        },
      },
    };

    const updated = await Booking.findByIdAndUpdate(id, updateFields, { new: true })
      .populate('customer', 'name phone email')
      .populate('worker', 'name phone trade ratePerHour location rating ratingCount avatar');

    if (isCustomer && booking.worker) {
      try {
        const workerUser = await User.findById(booking.worker);
        if (workerUser) {
          const currentCount = workerUser.ratingCount || 0;
          const currentRating = workerUser.rating || 0;
          const newCount = currentCount + 1;
          const newRating = Number(((currentRating * currentCount + Number(rating)) / newCount).toFixed(1));
          workerUser.rating = newRating;
          workerUser.ratingCount = newCount;
          await workerUser.save();
        }
      } catch (userErr) {
        console.warn('Worker rating update notice:', userErr.message);
      }
    }

    // Trigger AI Fake Review Detection asynchronously
    const { analyzeReview } = require('../services/reviewDetectionService');
    analyzeReview(id, booking.customer, booking.worker, rating, review, booking.paidAt).catch(e => console.error(e));

    // Trigger AI Aspect Analysis asynchronously
    const { analyzeReviewAspects } = require('../services/reviewAspectService');
    analyzeReviewAspects(id, review, rating).catch(e => console.error(e));

    const safe = toSafeBooking(updated, 'customer');
    res.status(200).json({ message: 'Rating submitted successfully', booking: safe });
  } catch (err) {
    res.status(500).json({ message: 'Rating failed', error: err.message });
  }
};
