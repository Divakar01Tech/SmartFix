const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createOrder,
  verifyPayment,
  getAllPayments,
  getPaymentByBooking,
} = require('../controllers/paymentController');

// Customer creates Razorpay order
router.post('/create-order', protect, createOrder);

// Verify payment signature after Razorpay checkout
router.post('/verify', protect, verifyPayment);

// Get payment by booking
router.get('/booking/:bookingId', protect, getPaymentByBooking);

// Admin: all payments
router.get('/all', protect, getAllPayments);

module.exports = router;
