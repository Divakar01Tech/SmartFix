const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  updateWorkerLocation,
  rateBooking,
  payBooking,
  providerAcceptBooking,
  providerDeclineBooking,
  getPendingBookingsForProvider,
  getBookingInvoice,
} = require('../controllers/bookingController');
const { protect, requireApprovedWorker, requireCustomer } = require('../middleware/authMiddleware');

// If the caller is a worker or handyman, enforce requireApprovedWorker
const checkWorkerApprovalIfWorker = async (req, res, next) => {
  if (req.user?.role === 'worker' || req.user?.role === 'handyman') {
    return requireApprovedWorker(req, res, next);
  }
  next();
};

router.post('/', protect, requireCustomer, createBooking);
router.get('/my', protect, getMyBookings);
router.get('/all', protect, getAllBookings);
router.get('/pending-for-provider', protect, requireApprovedWorker, getPendingBookingsForProvider);
router.get('/:id/invoice', protect, getBookingInvoice);
router.get('/:id', protect, getBookingById);
router.patch('/:id/status', protect, checkWorkerApprovalIfWorker, updateBookingStatus);
router.patch('/:id/accept', protect, requireApprovedWorker, providerAcceptBooking);
router.patch('/:id/decline', protect, requireApprovedWorker, providerDeclineBooking);
router.patch('/:id/worker-location', protect, requireApprovedWorker, updateWorkerLocation);
router.post('/:id/rate', protect, rateBooking);
router.patch('/:id/pay', protect, payBooking);

module.exports = router;


