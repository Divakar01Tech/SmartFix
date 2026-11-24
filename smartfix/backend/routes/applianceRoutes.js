const express = require('express');
const router = express.Router();
const {
  extractFromPhoto,
  createAppliance,
  getMyAppliances,
  getExpiring,
  getApplianceById,
  updateAppliance,
  deleteAppliance,
} = require('../controllers/applianceController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/applianceUploadMiddleware');

// Route definitions (all require valid JWT authentication)
router.post('/extract', protect, upload, extractFromPhoto);
router.post('/', protect, createAppliance);
router.get('/', protect, getMyAppliances);
router.get('/expiring', protect, getExpiring);
router.get('/:id', protect, getApplianceById);
router.patch('/:id', protect, updateAppliance);
router.delete('/:id', protect, deleteAppliance);

module.exports = router;
