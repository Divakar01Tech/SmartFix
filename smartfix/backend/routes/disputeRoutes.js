const express = require('express');
const router = express.Router();
const { raiseDispute } = require('../controllers/disputeController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, raiseDispute);

module.exports = router;
