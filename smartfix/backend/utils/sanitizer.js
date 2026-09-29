/**
 * Utility functions for sanitizing booking and worker objects across API responses.
 * Enforces security and privacy rules for customer and public endpoints.
 */

// List of booking statuses where worker contact details and ratings may be revealed (Accepted or later)
const REVEAL_STATUSES = [
  'Accepted',
  'Confirmed',
  'EnRoute',
  'Arrived',
  'WorkInProgress',
  'Completed',
  'Paid',
  'Reviewed',
];

/**
 * Sanitizes a booking object based on status and requesting user role/ID.
 * A worker's phone number and rating must ONLY be included when status is in REVEAL_STATUSES.
 *
 * @param {Object} booking - Raw or populated Mongoose booking object / JSON object
 * @param {String} requestingUserId - ID of the user requesting the booking (optional)
 * @param {String} requestingUserRole - Role of the user ('customer', 'handyman', 'admin') (optional)
 * @returns {Object} Sanitized booking object
 */
function sanitizeBookingForRole(booking, requestingUserId = null, requestingUserRole = null) {
  if (!booking) return booking;

  // Convert Mongoose document to plain JS object if needed
  const sanitized = typeof booking.toObject === 'function' ? booking.toObject() : JSON.parse(JSON.stringify(booking));

  const status = sanitized.status;
  const isRevealAllowed = REVEAL_STATUSES.includes(status);

  // Admin and the worker assigned to the job always see details if appropriate,
  // but for unconfirmed statuses, worker phone/rating must be hidden from customers and public responses.
  const isWorkerThemselves = requestingUserRole === 'handyman' &&
    (sanitized.worker?._id?.toString() === requestingUserId?.toString() || sanitized.worker?.toString() === requestingUserId?.toString());

  if (!isRevealAllowed && !isWorkerThemselves && requestingUserRole !== 'admin') {
    // Hide worker phone and rating
    if (sanitized.worker && typeof sanitized.worker === 'object') {
      delete sanitized.worker.phone;
      delete sanitized.worker.rating;
      delete sanitized.worker.ratingCount;
    }
    delete sanitized.workerPhone;
  }

  return sanitized;
}

/**
 * Sanitizes a worker profile for public listing / search endpoints.
 * Public worker listings must NEVER include exact phone numbers.
 *
 * @param {Object} worker - Raw or populated User document for handyman
 * @returns {Object} Sanitized worker object
 */
function sanitizeWorkerForPublic(worker) {
  if (!worker) return worker;
  const sanitized = typeof worker.toObject === 'function' ? worker.toObject() : JSON.parse(JSON.stringify(worker));
  
  delete sanitized.phone;
  delete sanitized.password;
  delete sanitized.aadhaarNumber;
  delete sanitized.idProofNumber;
  
  return sanitized;
}

module.exports = {
  REVEAL_STATUSES,
  sanitizeBookingForRole,
  sanitizeWorkerForPublic,
};
