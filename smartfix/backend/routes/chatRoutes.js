const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { sendMessage } = require('../controllers/chatController');

router.post('/message', protect, sendMessage);

module.exports = router;
