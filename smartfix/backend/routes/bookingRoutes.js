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
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createBooking);
router.get('/my', protect, getMyBookings);
router.get('/all', protect, getAllBookings);
router.get('/pending-for-provider', protect, getPendingBookingsForProvider);
router.get('/:id/invoice', protect, getBookingInvoice);
router.get('/:id', protect, getBookingById);
router.patch('/:id/status', protect, updateBookingStatus);
router.patch('/:id/accept', protect, providerAcceptBooking);
router.patch('/:id/decline', protect, providerDeclineBooking);
router.patch('/:id/worker-location', protect, updateWorkerLocation);
router.post('/:id/rate', protect, rateBooking);
router.patch('/:id/pay', protect, payBooking);

module.exports = router;

