const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const { regenerateWorkerBio } = require('../controllers/bioController');

// All admin routes require valid Auth token + Strict Admin Role (phone: 7604975206)
router.use(protect, requireAdmin);

router.get('/pending-captains', adminController.getPendingCaptains);
router.patch('/verify-captain/:id', adminController.verifyCaptain);
router.get('/analytics', adminController.getAdminAnalytics);
router.get('/customers', adminController.getCustomers);
router.patch('/customers/:id/toggle-block', adminController.toggleBlockCustomer);
router.get('/bookings', adminController.getAdminBookings);
router.get('/wallet-overview', adminController.getWalletOverview);
router.get('/worker-scorecards', adminController.getAdminWorkerScorecards);
router.get('/sos-alerts', adminController.getSOSAlerts);
router.patch('/sos-alerts/:id/resolve', adminController.resolveSOSAlert);
router.get('/withdrawals', adminController.getAdminWithdrawals);
router.patch('/withdrawals/:walletId/:transactionId/process', adminController.processWithdrawalRequest);
router.patch('/workers/:id/toggle-block', adminController.toggleBlockWorker);
router.post('/workers/:id/regenerate-bio', regenerateWorkerBio);
router.get('/dispatch-stats', adminController.getDispatchStats);

const { getHighRiskBookings } = require('../controllers/riskController');
router.get('/bookings/high-risk', getHighRiskBookings);

const { getAdminDisputes, resolveDispute } = require('../controllers/disputeController');
router.get('/disputes', getAdminDisputes);
router.patch('/disputes/:id/resolve', resolveDispute);

router.get('/policy-violations', adminController.getPolicyViolations);

router.get('/review-flags', adminController.getReviewFlags);
router.patch('/review-flags/:id', adminController.manageReviewFlag);

module.exports = router;

