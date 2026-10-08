const express = require('express');
const router = express.Router();
const { getWorkerLocation, getBookingLocationHistory, validateLocation, getDistricts, getTaluksByDistrict, searchVillagesByTaluk } = require('../controllers/locationController');
const { protect } = require('../middleware/authMiddleware');
const cacheMiddleware = require('../middleware/cacheMiddleware');

// Public hierarchical location routes
router.get('/districts', cacheMiddleware(86400), getDistricts);
router.get('/districts/:id/taluks', cacheMiddleware(86400), getTaluksByDistrict);
router.get('/taluks/:id/villages', cacheMiddleware(86400), searchVillagesByTaluk);

// Existing routes
router.get('/worker/:workerId', protect, getWorkerLocation);
router.get('/history/:bookingId', protect, getBookingLocationHistory);
router.post('/validate', validateLocation);

module.exports = router;
