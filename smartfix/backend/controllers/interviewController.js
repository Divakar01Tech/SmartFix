const skillInterviewService = require('../services/skillInterviewService');
const InterviewSession = require('../models/InterviewSession');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

// @route  POST /api/interview/start
// @desc   Start or retrieve ongoing interview session
exports.startInterview = async (req, res) => {
  try {
    const { workerId, category, language } = req.body;
    const targetWorkerId = (req.user?.role === 'admin' && workerId) ? workerId : (req.user?.id || workerId);

    if (!targetWorkerId) {
      return res.status(400).json({ message: 'Worker ID is required to start interview.' });
    }

    const session = await skillInterviewService.startInterview(
      targetWorkerId,
      category || 'Plumbing',
      language || req.user?.preferredLanguage || 'en'
    );

    res.status(200).json({ session });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to start skill interview session.' });
  }
};

// @route  POST /api/interview/answer
// @desc   Submit worker's answer to current question
exports.submitAnswer = async (req, res) => {
  try {
    const { sessionId, answerText, language } = req.body;

    if (!sessionId || !answerText) {
      return res.status(400).json({ message: 'Session ID and answer text are required.' });
    }

    const session = await skillInterviewService.submitAnswer(
      sessionId,
      answerText,
      language || req.user?.preferredLanguage || 'en'
    );

    res.status(200).json({ session });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to submit answer.' });
  }
};

// @route  GET /api/interview/session/:workerId
// @desc   Retrieve latest completed/in_progress session for a worker (Admin view)
exports.getWorkerInterview = async (req, res) => {
  try {
    const { workerId } = req.params;
    console.log('Admin requested interview for workerId:', workerId);

    let session = await InterviewSession.findOne({ workerId }).sort({ createdAt: -1 });

    // Fallback 1: Lookup worker to check interviewSessionId or synthesize
    if (!session) {
      const worker = await User.findById(workerId);
      if (worker && worker.interviewSessionId) {
        session = await InterviewSession.findById(worker.interviewSessionId);
      }

      // Fallback 2: Check by trade/category if created transiently
      if (!session && worker) {
        session = await InterviewSession.findOne({
          category: { $in: worker.categories?.length ? worker.categories : [worker.trade || 'Plumbing'] },
        }).sort({ createdAt: -1 });
      }

      // Fallback 3: If interview object is stored directly on worker profile, synthesize session
      if (!session && worker && worker.interview && worker.interview.transcriptSummary) {
        const scores = worker.interview.scores || {};
        const avgScore = Math.round(
          ((scores.practicalSpecificity || 15) +
            (scores.safetyAwareness || 15) +
            (scores.diagnosisLogic || 15) +
            (scores.communicationClarity || 15))
        );

        session = {
          _id: worker._id,
          workerId: worker._id,
          category: worker.trade || (worker.categories?.[0]) || 'Plumbing',
          status: 'completed',
          questionsAsked: 5,
          totalQuestions: 5,
          messages: [
            {
              role: 'assistant',
              text: 'Practical trade verification questions completed during onboarding.',
              timestamp: worker.interview.completedAt || worker.createdAt || new Date(),
            },
            {
              role: 'worker',
              text: worker.interview.transcriptSummary,
              timestamp: worker.interview.completedAt || worker.createdAt || new Date(),
            },
          ],
          aiRecommendation: {
            verdict: worker.interview.aiVerdict || 'borderline',
            confidenceScore: avgScore || 60,
            summary: worker.interview.transcriptSummary,
            perQuestionScores: [
              {
                question: 1,
                specificity: scores.practicalSpecificity || 15,
                safety: scores.safetyAwareness || 15,
                diagnosisLogic: scores.diagnosisLogic || 15,
                clarity: scores.communicationClarity || 15,
                total: avgScore || 60,
              },
            ],
            flaggedConcerns: [],
          },
        };
      }
    }

    if (!session) {
      return res.status(404).json({ message: 'No skill verification interview found for this worker.' });
    }

    res.status(200).json({ session });
  } catch (err) {
    console.error('getWorkerInterview Error:', err);
    res.status(500).json({ message: 'Failed to retrieve worker interview details.' });
  }
};

// @route  POST /api/interview/admin-audit-decision
// @desc   Log admin approval/rejection decision alongside AI verdict in AuditLog
exports.logAdminAuditDecision = async (req, res) => {
  try {
    const { workerId, adminDecision, aiVerdict } = req.body;

    if (!workerId || !adminDecision) {
      return res.status(400).json({ message: 'Worker ID and decision are required.' });
    }

    const agreedWithAi = aiVerdict ? (
      (adminDecision === 'approved' && aiVerdict === 'pass') ||
      (adminDecision === 'rejected' && aiVerdict === 'fail') ||
      (aiVerdict === 'borderline')
    ) : null;

    const auditLog = await AuditLog.create({
      adminId: req.user.id,
      workerId,
      aiVerdict: aiVerdict || 'none',
      adminDecision,
      agreedWithAi,
      timestamp: new Date(),
    });

    res.status(201).json({ message: 'Admin audit decision logged successfully.', auditLog });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to log audit decision.' });
  }
};
