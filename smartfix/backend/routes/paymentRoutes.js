const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const { paymentRateLimiter } = require('../middleware/rateLimiter');
const {
  createOrder,
  verifyPayment,
  getAllPayments,
  getPaymentByBooking,
  getMyPayments,
  getAdminPayments,
} = require('../controllers/paymentController');

// Customer creates Razorpay order (Rate-limited, Customer authenticated)
router.post('/create-order', paymentRateLimiter, protect, createOrder);

// Verify payment signature after Razorpay checkout (Rate-limited, Customer authenticated)
router.post('/verify', paymentRateLimiter, protect, verifyPayment);

// Customer payment history
router.get('/my', protect, getMyPayments);

// Admin payments overview and analytics
router.get('/admin', protect, requireAdmin, getAdminPayments);

// Admin: all payments list
router.get('/all', protect, requireAdmin, getAllPayments);

// Get payment record by booking ID
router.get('/booking/:bookingId', protect, getPaymentByBooking);

module.exports = router;

