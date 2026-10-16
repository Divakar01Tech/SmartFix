/**
 * CRITICAL SECURITY & PRIVACY RULE:
 * This is an ALLOWLIST based serializer. Real phone numbers and emails MUST NEVER
 * be exposed across customer/worker boundaries.
 *
 * Rule from Prompt Section B.3 & B.4:
 * 3. Before booking & when booking status is 'pending': Show anonymous nearby workers (available, within 5 km) with NO names, phones, or ratings.
 * 4. Worker accepts (status 'accepted'): ONLY from this status onward, reveal worker display name, rating, and (masked-call only) contact option to customer.
 *    Real phone/email of either side are NEVER exposed. Enforced in API serializer, not just UI.
 *
 * Rule from Prompt Section D:
 * Allowlist serializers toSafeBooking(booking, viewerRole); customers can only read their own bookings.
 */

exports.serializeWorkerForCustomer = (worker, bookingStatus = 'accepted') => {
  if (!worker) return null;
  const status = (bookingStatus || '').toLowerCase();
  const isAcceptedOrBeyond = [
    'accepted',
    'enroute',
    'en_route',
    'arrived',
    'workinprogress',
    'in_progress',
    'completed',
    'paid',
    'reviewed',
    'confirmed',
  ].includes(status);

  // If booking is pending or unaccepted, completely hide worker identity & ratings
  if (!isAcceptedOrBeyond) {
    return {
      _id: worker._id || worker.id,
      id: worker._id || worker.id,
      isAssigned: false,
      maskedName: 'Assigned Worker (Pending Acceptance)',
      trade: worker.trade || '',
      // Absolutely NO names, phones, ratings or avatars revealed at 'pending'
    };
  }

  // Once accepted, reveal display name, rating, trade, avatar, but NEVER real phone/email
  return {
    _id: worker._id || worker.id,
    id: worker._id || worker.id,
    name: worker.name || worker.fullName || 'Service Provider',
    fullName: worker.fullName || worker.name || 'Service Provider',
    trade: worker.trade || '',
    rating: typeof worker.rating === 'number' ? worker.rating : 5.0,
    ratingCount: worker.ratingCount || 0,
    avatar: worker.avatar || worker.profilePic || '',
    profilePic: worker.profilePic || worker.avatar || '',
    bio: worker.bio || worker.bioEn || '',
    bioTa: worker.bioTa || '',
    reviewSummary: worker.reviewSummary || null,
    maskedContactOption: true,
    maskedPhone: 'XXXX-XX-CALL',
    // NEVER INCLUDE worker.phone OR worker.email
  };
};

exports.serializeCustomerForWorker = (customer) => {
  if (!customer) return null;
  return {
    _id: customer._id || customer.id,
    id: customer._id || customer.id,
    name: customer.name || customer.fullName || 'Customer',
    maskedContactOption: true,
    // Real phone and email strictly excluded
  };
};

/**
 * toSafeBooking(booking, viewerRole)
 * Allowlist serializer for all booking responses.
 * Enforces privacy based on viewerRole ('customer', 'worker', 'admin').
 */
exports.toSafeBooking = (booking, viewerRole = 'customer') => {
  if (!booking) return null;
  const raw = typeof booking.toObject === 'function' ? booking.toObject() : { ...booking._doc || booking };

  const status = (raw.status || 'pending').toLowerCase();

  const safe = {
    _id: raw._id || raw.id,
    id: raw._id || raw.id,
    trade: raw.trade,
    subServices: raw.subServices || [],
    date: raw.date,
    time: raw.time,
    address: raw.address,
    district: raw.district || '',
    state: raw.state || 'Tamil Nadu',
    notes: raw.notes || '',
    price: raw.price,
    status: raw.status,
    statusHistory: raw.statusHistory || [],
    serviceTier: raw.serviceTier || 'AutoHandyman',
    pickupLat: raw.pickupLat || raw.userLat || raw.location?.coordinates?.[1] || 9.8433,
    pickupLng: raw.pickupLng || raw.userLng || raw.location?.coordinates?.[0] || 78.4809,
    userLat: raw.userLat || raw.pickupLat || raw.location?.coordinates?.[1] || 9.8433,
    userLng: raw.userLng || raw.pickupLng || raw.location?.coordinates?.[0] || 78.4809,
    location: raw.location || {
      type: 'Point',
      coordinates: [
        raw.pickupLng || raw.userLng || 78.4809,
        raw.pickupLat || raw.userLat || 9.8433,
      ],
    },
    distanceKm: raw.distanceKm,
    estimatedMinutes: raw.estimatedMinutes,
    paymentStatus: raw.paymentStatus || 'Unpaid',
    paymentMethod: raw.paymentMethod || 'None',
    transactionId: raw.transactionId || null,
    razorpayOrderId: raw.razorpayOrderId || null,
    acceptedAt: raw.acceptedAt || null,
    slaDeadline: raw.slaDeadline || null,
    slaBreached: !!raw.slaBreached,
    enRouteAt: raw.enRouteAt || null,
    arrivedAt: raw.arrivedAt || null,
    startedAt: raw.startedAt || null,
    completedAt: raw.completedAt || null,
    paidAt: raw.paidAt || null,
    reviewedAt: raw.reviewedAt || null,
    tracking: raw.tracking || { isActive: false },
    rating: raw.rating || null,
    review: raw.review || null,
    customerRatingForWorker: raw.customerRatingForWorker || null,
    workerRatingForCustomer: raw.workerRatingForCustomer || null,
    workerReview: raw.workerReview || null,
    cancelReason: raw.cancelReason || raw.cancellationReason || '',
    cancelledBy: raw.cancelledBy || null,
    cancelledAt: raw.cancelledAt || null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  if (viewerRole === 'customer') {
    // Customer reading booking:
    // 1. Worker is filtered through serializeWorkerForCustomer with status check
    if (raw.worker) {
      safe.worker = exports.serializeWorkerForCustomer(raw.worker, raw.status);
    } else {
      safe.worker = null;
    }

    // Customer's own info is kept safe
    if (raw.customer) {
      const c = raw.customer;
      safe.customer = {
        _id: c._id || c.id || c,
        id: c._id || c.id || c,
        name: c.name || c.fullName || 'Customer',
        email: c.email || '',
        // Exclude customer password, OTPs, tokens
      };
    }
  } else if (viewerRole === 'worker' || viewerRole === 'handyman') {
    // Worker reading booking:
    // 1. Customer is filtered through serializeCustomerForWorker (NO phone/email)
    if (raw.customer) {
      safe.customer = exports.serializeCustomerForWorker(raw.customer);
    }
    // Worker sees their own allowed details
    if (raw.worker) {
      const w = raw.worker;
      safe.worker = {
        _id: w._id || w.id || w,
        id: w._id || w.id || w,
        name: w.name || w.fullName || 'Worker',
        trade: w.trade || safe.trade,
        rating: w.rating,
      };
    }
  } else if (viewerRole === 'admin') {
    // Admin sees full booking with sanitized user profiles
    if (raw.customer) {
      safe.customer = typeof raw.customer === 'object' ? {
        _id: raw.customer._id,
        name: raw.customer.name,
        email: raw.customer.email,
        phone: raw.customer.phone,
      } : raw.customer;
    }
    if (raw.worker) {
      safe.worker = typeof raw.worker === 'object' ? {
        _id: raw.worker._id,
        name: raw.worker.name,
        trade: raw.worker.trade,
        phone: raw.worker.phone,
        email: raw.worker.email,
        rating: raw.worker.rating,
      } : raw.worker;
    }
  }

  return safe;
};

// Backwards-compatible aliases
exports.serializeBookingForCustomer = (booking) => exports.toSafeBooking(booking, 'customer');
exports.serializeBookingForWorker = (booking) => exports.toSafeBooking(booking, 'worker');

/**
 * Worker Safe Allowlist Serializer
 * Used for worker self-endpoints (login, me, register).
 * Never leaks password, unmasked IDs, or raw disk file paths.
 */
exports.toSafeWorker = (worker) => {
  if (!worker) return null;
  const w = typeof worker.toObject === 'function' ? worker.toObject() : worker;
  const catList = Array.isArray(w.categories) && w.categories.length > 0
    ? w.categories
    : (w.trade ? [w.trade] : []);

  return {
    _id: w._id,
    id: w._id,
    fullName: w.fullName || w.name,
    name: w.name || w.fullName,
    email: w.email,
    phone: w.phone,
    role: w.role || 'worker',
    address: w.address || '',
    district: w.district || '',
    state: w.state || '',
    categories: catList,
    trade: w.trade || catList[0] || '',
    verificationStatus: w.verificationStatus || 'pending_verification',
    rejectionReason: w.rejectionReason || '',
    isEmailVerified: !!w.isEmailVerified,
    kyc: {
      aadhaarLast4: w.kyc?.aadhaarLast4 ? `XXXX-XXXX-${w.kyc.aadhaarLast4}` : '',
      secondIdType: w.kyc?.secondIdType || '',
      secondIdLast4: w.kyc?.secondIdLast4 ? `XXXX-${w.kyc.secondIdLast4}` : '',
      hasAadhaarFront: !!w.kyc?.aadhaarFrontPath,
      hasAadhaarBack: !!w.kyc?.aadhaarBackPath,
      hasSecondId: !!w.kyc?.secondIdPath,
    },
    interview: {
      transcriptSummary: w.interview?.transcriptSummary || '',
      scores: w.interview?.scores || null,
      aiVerdict: w.interview?.aiVerdict || '',
      completedAt: w.interview?.completedAt || null,
    },
    availability: w.availability || (w.availabilityStatus?.toLowerCase() || 'offline'),
    rating: w.rating,
    ratingCount: w.ratingCount || 0,
    workerId: w.workerId || '',
    createdAt: w.createdAt,
  };
};
