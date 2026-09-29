const express = require('express');
const router = express.Router();
const { getRoute } = require('../controllers/mapsController');
const { protect } = require('../middleware/authMiddleware');

router.post('/route', protect, getRoute);

module.exports = router;
