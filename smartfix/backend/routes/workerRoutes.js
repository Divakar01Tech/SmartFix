const express = require('express');
const router = express.Router();
const { getWorkers, getWorkerById, createWorker, deleteWorker, getWorkerScorecard } = require('../controllers/workerController');
const {
  getWorkerMe,
  uploadKyc,
  toggleAvailability,
  getEarnings,
} = require('../controllers/workerAuthController');
const {
  startWorkerInterview,
  submitWorkerAnswer,
} = require('../controllers/workerInterviewController');
const { protect, requireWorker, requireApprovedWorker } = require('../middleware/authMiddleware');
const { handleKycUpload } = require('../middleware/kycUploadMiddleware');

// Worker self-profile (Pending or Approved)
router.get('/me', protect, requireWorker, getWorkerMe);

// Worker KYC re-upload / upload (Pending or Rejected)
router.post('/kyc/upload', protect, requireWorker, handleKycUpload, uploadKyc);

// Worker AI skill verification interview
router.post('/interview/start', startWorkerInterview);
router.post('/interview/answer', submitWorkerAnswer);

// Guarded by requireApprovedWorker (re-reads from DB, blocks pending/rejected)
router.patch('/availability', protect, requireApprovedWorker, toggleAvailability);
router.get('/earnings', protect, requireApprovedWorker, getEarnings);

// Legacy and public worker routes
router.get('/', getWorkers);
router.get('/scorecard', protect, getWorkerScorecard);
router.post('/', createWorker); // Disabled handler returning 403
router.get('/:id', getWorkerById);
router.delete('/:id', deleteWorker);

module.exports = router;
