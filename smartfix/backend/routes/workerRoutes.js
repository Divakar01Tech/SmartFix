const express = require('express');
const router = express.Router();
const { getWorkers, getWorkerById, createWorker, deleteWorker, getWorkerScorecard } = require('../controllers/workerController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', getWorkers);
router.get('/scorecard', protect, getWorkerScorecard);
router.post('/', createWorker); // Disabled handler returning 403
router.get('/:id', getWorkerById);
router.delete('/:id', deleteWorker);

module.exports = router;
