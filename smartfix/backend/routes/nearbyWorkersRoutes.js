const express = require('express');
const router = express.Router();
const { getNearbyWorkers, updateAvailability } = require('../controllers/nearbyWorkersController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/nearby-workers
router.get('/', getNearbyWorkers); // Public or authenticated browsing

// POST /api/nearby-workers/availability
router.post('/availability', protect, updateAvailability);

module.exports = router;
