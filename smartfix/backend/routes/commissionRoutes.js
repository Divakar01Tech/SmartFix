const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getConfig, updateConfig } = require('../controllers/commissionController');

router.get('/', getConfig);
router.put('/', protect, updateConfig);

module.exports = router;
