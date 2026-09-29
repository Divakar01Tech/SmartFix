const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/authMiddleware');
const { queryAssistant } = require('../controllers/assistantController');

// Rate limiting: 15 requests per user per hour
const assistantRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // limit by user ID since route is protected
    return req.user ? req.user.id : 'anonymous';
  },
  message: {
    message: 'Rate limit exceeded. You can only ask 15 questions per hour. / 1 மணிநேரத்திற்கு 15 கேள்விகள் மட்டுமே கேட்க முடியும்.',
  },
});

router.post('/query', protect, assistantRateLimiter, queryAssistant);

module.exports = router;
