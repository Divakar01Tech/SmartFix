const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { sendMessage, getMessages } = require('../controllers/chatController');

router.post('/message', protect, sendMessage);
router.get('/messages/:bookingId', protect, getMessages);

module.exports = router;
