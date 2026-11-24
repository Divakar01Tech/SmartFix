const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

const { regenerateWorkerBio } = require('../controllers/bioController');

// All admin routes require valid Auth token + Strict Admin Role (validated against ADMIN_EMAIL)
router.use(protect, requireAdmin);

router.get('/pending-captains', adminController.getPendingCaptains);
router.patch('/verify-captain/:id', adminController.verifyCaptain);
router.get('/analytics', adminController.getAdminAnalytics);
router.get('/customers', adminController.getCustomers);
router.delete('/customers/inactive-cleanup', adminController.cleanupInactiveCustomers);
router.delete('/customers/:id', adminController.deleteCustomer);
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
router.get('/workers/:id/review-insights', adminController.getWorkerReviewInsights);
router.post('/workers/:id/feedback', adminController.sendWorkerFeedback);
router.get('/workers/:id/feedback', adminController.getWorkerFeedback);
router.get('/dispatch-stats', adminController.getDispatchStats);
router.get('/ai-radar', adminController.getAdminAiRadar);
router.get('/ai-settings', adminController.getAiSettings);
router.put('/ai-settings', adminController.updateAiSettings);

// Fraud & Wallet Abuse Detection (Prompt 1)
router.get('/fraud-flags', adminController.getFraudFlags);
router.get('/fraud-flags/:id', adminController.getFraudFlagById);
router.patch('/fraud-flags/:id', adminController.updateFraudFlagStatus);
router.get('/fraud-settings', adminController.getAdminFraudSettings);
router.put('/fraud-settings', adminController.updateAdminFraudSettings);

// Worker KYC & AI Recommendation Review Endpoints
router.get('/workers/review-queue', adminController.getWorkerReviewQueue);
router.get('/workers/:id/kyc/:docKey', adminController.serveKycDocument);
router.patch('/workers/:id/review', adminController.reviewWorkerApplication);
router.post('/workers/:id/kyc/recheck', adminController.recheckWorkerKyc);

const { getHighRiskBookings } = require('../controllers/riskController');
router.get('/bookings/high-risk', getHighRiskBookings);

const { getAdminDisputes, resolveDispute } = require('../controllers/disputeController');
router.get('/disputes', getAdminDisputes);
router.patch('/disputes/:id/resolve', resolveDispute);

router.get('/policy-violations', adminController.getPolicyViolations);

router.get('/review-flags', adminController.getReviewFlags);
router.patch('/review-flags/:id', adminController.manageReviewFlag);

// Location management (Part 11)
const adminLocationController = require('../controllers/adminLocationController');
router.get('/locations/districts', adminLocationController.adminGetDistricts);
router.patch('/locations/districts/:id/toggle-active', adminLocationController.adminToggleDistrictActive);
router.patch('/locations/taluks/:id', adminLocationController.adminUpdateTaluk);
router.post('/locations/villages', adminLocationController.adminAddVillage);
router.patch('/locations/villages/:id', adminLocationController.adminUpdateVillage);

// Support Tickets (Prompt 5)
const { getAdminSupportTickets, updateAdminSupportTicket } = require('../controllers/supportController');
router.get('/support-tickets', getAdminSupportTickets);
router.patch('/support-tickets/:id', updateAdminSupportTicket);

// Payments & Financial Overview
const { getAdminPayments } = require('../controllers/paymentController');
router.get('/payments', getAdminPayments);

// Prompt 10: Upskill Academy Review & Badge Awarding
const { getAdminUpskillList, adminBadgeDecision } = require('../controllers/upskillingController');
router.get('/workers-upskill', getAdminUpskillList);
router.post('/workers/:id/upskill-badge', adminBadgeDecision);

module.exports = router;

