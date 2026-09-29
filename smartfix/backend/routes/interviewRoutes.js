const express = require('express');
const router = express.Router();
const {
  startInterview,
  submitAnswer,
  getWorkerInterview,
  logAdminAuditDecision,
} = require('../controllers/interviewController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

router.post('/start', protect, startInterview);
router.post('/answer', protect, submitAnswer);
router.get('/session/:workerId', protect, getWorkerInterview);
router.post('/admin-audit-decision', protect, requireAdmin, logAdminAuditDecision);

module.exports = router;
