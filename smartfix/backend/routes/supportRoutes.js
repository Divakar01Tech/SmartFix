const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { chatWithSupport, getSupportConversation } = require('../controllers/supportController');

router.post('/chat', protect, chatWithSupport);
router.get('/conversation/:id', protect, getSupportConversation);

module.exports = router;
