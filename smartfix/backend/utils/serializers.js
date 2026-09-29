/**
 * CRITICAL SECURITY RULE:
 * This is an ALLOWLIST based serializer. Real phone numbers and emails MUST NEVER
 * be added here. If a new field is added to the User schema, it will be automatically
 * hidden from the customer unless explicitly added to this allowlist.
 */

exports.serializeWorkerForCustomer = (worker) => {
  if (!worker) return null;
  return {
    _id: worker._id,
    name: worker.name,
    trade: worker.trade,
    rating: worker.rating || 0,
    ratingCount: worker.ratingCount || 0,
    bio: worker.bio || worker.bioEn || '',
    bioTa: worker.bioTa || '',
    reviewSummary: worker.reviewSummary || null,
    profilePic: worker.profilePic || null,
  };
};

exports.serializeCustomerForWorker = (customer) => {
  if (!customer) return null;
  return {
    _id: customer._id,
    name: customer.name,
    // NO PHONE OR EMAIL ALLOWED HERE
  };
};

// Apply to GET /api/bookings/:id from Customer portal
exports.serializeBookingForCustomer = (booking) => {
  if (!booking) return null;
  const safeBooking = { ...booking._doc || booking };
  
  if (safeBooking.worker) {
    safeBooking.worker = exports.serializeWorkerForCustomer(safeBooking.worker);
  }
  
  if (safeBooking.customer) delete safeBooking.customer.phone; // Failsafe
  
  return safeBooking;
};

// Apply to GET /api/bookings/:id from Worker portal
exports.serializeBookingForWorker = (booking) => {
  if (!booking) return null;
  const safeBooking = { ...booking._doc || booking };
  
  if (safeBooking.customer) {
    safeBooking.customer = exports.serializeCustomerForWorker(safeBooking.customer);
  }
  
  if (safeBooking.worker) delete safeBooking.worker.phone; // Failsafe
  
  return safeBooking;
};
