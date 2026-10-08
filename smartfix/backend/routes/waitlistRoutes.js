const express = require('express');
const router = express.Router();
const { joinWaitlist } = require('../controllers/waitlistController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, joinWaitlist);

module.exports = router;
