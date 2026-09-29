const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadWorkProof, stripExif, handleMulterError } = require('../middleware/workProofUpload');
const { uploadBeforePhotos, uploadAfterPhotos } = require('../controllers/workProofController');

router.post('/:bookingId/before', protect, uploadWorkProof, handleMulterError, stripExif, uploadBeforePhotos);
router.post('/:bookingId/after', protect, uploadWorkProof, handleMulterError, stripExif, uploadAfterPhotos);

module.exports = router;
