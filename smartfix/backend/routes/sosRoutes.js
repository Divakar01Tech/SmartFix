const express = require('express');
const router = express.Router();
const sosController = require('../controllers/sosController');
const { protect } = require('../middleware/authMiddleware');

router.post('/trigger', protect, sosController.triggerSOS);

module.exports = router;
