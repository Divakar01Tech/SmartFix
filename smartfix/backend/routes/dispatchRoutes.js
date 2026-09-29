const express = require('express');
const router = express.Router();
const dispatchController = require('../controllers/dispatchController');
const { protect } = require('../middleware/authMiddleware');

router.post('/estimate-fare', dispatchController.estimateFare);
router.post('/find-nearest', dispatchController.findNearestCaptains);
router.post('/request', protect, dispatchController.requestDispatch);
router.post('/accept', protect, dispatchController.acceptDispatch);
router.post('/decline', protect, dispatchController.declineDispatch);

module.exports = router;
