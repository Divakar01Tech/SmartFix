const express = require('express');
const router = express.Router();
const { getWorkerLocation, getBookingLocationHistory, validateLocation } = require('../controllers/locationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/worker/:workerId', protect, getWorkerLocation);
router.get('/history/:bookingId', protect, getBookingLocationHistory);
router.post('/validate', validateLocation);

module.exports = router;
