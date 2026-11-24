const WorkerUpskillProgress = require('../models/WorkerUpskillProgress');
const {
  getWorkerUpskillPlan,
  submitQuizAnswer,
  adminAwardBadge,
  generateOrAssignUpskillPlan,
} = require('../services/upskillingService');

// GET /api/worker/upskill/plan
exports.getWorkerPlan = async (req, res) => {
  try {
    const workerId = req.user?.id || req.user?._id;
    const plan = await getWorkerUpskillPlan(workerId);
    return res.status(200).json({ success: true, plan });
  } catch (err) {
    console.error('getWorkerPlan error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch upskill plan: ' + err.message });
  }
};

// POST /api/worker/upskill/quiz-submit
exports.submitQuiz = async (req, res) => {
  try {
    const workerId = req.user?.id || req.user?._id;
    const { lessonId, answers } = req.body;

    if (!lessonId || !Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'lessonId and answers array are required.' });
    }

    const result = await submitQuizAnswer(workerId, lessonId, answers);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('submitQuiz error:', err);
    return res.status(500).json({ success: false, message: 'Failed to grade quiz: ' + err.message });
  }
};

// GET /api/admin/workers/upskill
exports.getAdminUpskillList = async (req, res) => {
  try {
    const { status = 'graduated' } = req.query;
    const query = status === 'all' ? {} : { overallStatus: status };

    const records = await WorkerUpskillProgress.find(query)
      .populate('worker', 'name email phone trade verificationStatus trustedWorkerBadge avatar')
      .populate('lessons.lesson', 'title topic difficulty')
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({ success: true, count: records.length, records });
  } catch (err) {
    console.error('getAdminUpskillList error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch upskill records: ' + err.message });
  }
};

// POST /api/admin/workers/:id/upskill-badge
exports.adminBadgeDecision = async (req, res) => {
  try {
    const workerId = req.params.id;
    const adminId = req.user?.id || req.user?._id;
    const { approved = true, adminNotes = '' } = req.body;

    const result = await adminAwardBadge(workerId, approved, adminNotes, adminId);
    return res.status(200).json({ success: true, message: 'Badge decision recorded.', ...result });
  } catch (err) {
    console.error('adminBadgeDecision error:', err);
    return res.status(500).json({ success: false, message: 'Failed to process badge decision: ' + err.message });
  }
};
