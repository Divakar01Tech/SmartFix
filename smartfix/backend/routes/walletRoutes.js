const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getMyWallet, getAllWallets, requestWithdrawal, getSettings, updateSettings, payWithWallet } = require('../controllers/walletController');

router.get('/me', protect, getMyWallet);
router.get('/admin/all', protect, getAllWallets);
router.post('/withdraw', protect, requestWithdrawal);
router.get('/settings', protect, getSettings);
router.put('/settings', protect, updateSettings);
router.post('/pay-with-wallet', protect, payWithWallet);

module.exports = router;
