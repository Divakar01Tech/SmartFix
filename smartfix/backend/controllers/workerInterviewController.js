const jwt = require('jsonwebtoken');
const User = require('../models/User');
const InterviewSession = require('../models/InterviewSession');
const skillInterviewService = require('../services/skillInterviewService');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key_2026';

// Helper to authenticate either signupToken, standard workerJwt, or req.user
const extractUserOrEmailFromToken = (req) => {
  if (req.user) {
    return { decoded: req.user };
  }

  let token = null;
  if (req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.body?.token || req.body?.signupToken) {
    token = req.body.token || req.body.signupToken;
  }

  if (!token) return { error: 'Authentication token is required for interview.' };

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { decoded };
  } catch (err) {
    return { error: 'Invalid or expired token. Please verify email or login again.' };
  }
};

/**
 * POST /api/worker/interview/start
 * Starts a 5-question practical interview session for the worker's selected category.
 */
exports.startWorkerInterview = async (req, res) => {
  try {
    const { decoded, error } = extractUserOrEmailFromToken(req);
    if (error) {
      return res.status(401).json({ success: false, message: error });
    }

    const { category, language } = req.body;
    const selectedCategory = category || 'Plumbing';
    const lang = language === 'ta' ? 'ta' : 'en';

    // Temporary or real workerId
    let workerId = decoded.id || decoded.userId;
    if (!workerId && decoded.email) {
      // Find if worker already exists
      const worker = await User.findOne({ email: decoded.email.toLowerCase() });
      if (worker) {
        workerId = worker._id;
      }
    }

    // If still in signup stage before worker record creation, create a transient session
    const session = await skillInterviewService.startInterview(
      workerId || '000000000000000000000000',
      selectedCategory,
      lang
    );

    const firstMsg = session.messages.filter((m) => m.role === 'assistant').slice(-1)[0];

    return res.status(200).json({
      success: true,
      sessionId: session._id,
      category: selectedCategory,
      questionsAsked: session.questionsAsked,
      totalQuestions: 5,
      questionText: firstMsg ? firstMsg.text : 'Welcome to your practical skill interview.',
      messages: session.messages,
    });
  } catch (err) {
    console.error('Start Worker Interview Error:', err.message);
    return res.status(400).json({ success: false, message: err.message || 'Failed to start interview.' });
  }
};

/**
 * POST /api/worker/interview/answer
 * Submits answer, returns next question or final 4-criteria rubric evaluation.
 */
exports.submitWorkerAnswer = async (req, res) => {
  try {
    const { decoded, error } = extractUserOrEmailFromToken(req);
    if (error) {
      return res.status(401).json({ success: false, message: error });
    }

    const { sessionId, answerText, language } = req.body;
    if (!sessionId || !answerText) {
      return res.status(400).json({ success: false, message: 'Session ID and answer text are required.' });
    }

    const lang = language === 'ta' ? 'ta' : 'en';

    const session = await skillInterviewService.submitAnswer(sessionId, answerText, lang);

    const isFinished = session.status === 'completed';
    const lastAssistantMsg = session.messages.filter((m) => m.role === 'assistant').slice(-1)[0];

    // If finished, extract 4 criteria scores & save to worker if user exists
    let recommendation = null;
    if (isFinished && session.aiRecommendation) {
      const rec = session.aiRecommendation;
      let spec = 0, safe = 0, diag = 0, clar = 0;

      if (Array.isArray(rec.perQuestionScores) && rec.perQuestionScores.length > 0) {
        rec.perQuestionScores.forEach((q) => {
          spec += q.specificity || 0;
          safe += q.safety || 0;
          diag += q.diagnosisLogic || 0;
          clar += q.clarity || 0;
        });
        const len = rec.perQuestionScores.length;
        spec = Math.round(spec / len);
        safe = Math.round(safe / len);
        diag = Math.round(diag / len);
        clar = Math.round(clar / len);
      } else {
        const base = rec.confidenceScore ? Math.round(rec.confidenceScore / 4) : 15;
        spec = base;
        safe = base;
        diag = base;
        clar = base;
      }

      recommendation = {
        verdict: rec.verdict || 'borderline',
        confidenceScore: rec.confidenceScore || 60,
        scores: {
          practicalSpecificity: spec,
          safetyAwareness: safe,
          diagnosisLogic: diag,
          communicationClarity: clar,
        },
        transcriptSummary: rec.summary || 'Worker completed dynamic practical skill assessment questions.',
        flaggedConcerns: rec.flaggedConcerns || [],
      };

      // Save to worker record in DB if worker exists
      const workerId = decoded.id || decoded.userId;
      const workerQuery = workerId
        ? { _id: workerId }
        : decoded.email
        ? { email: decoded.email.toLowerCase() }
        : null;

      if (workerQuery) {
        await User.findOneAndUpdate(workerQuery, {
          interview: {
            transcriptSummary: recommendation.transcriptSummary,
            scores: recommendation.scores,
            aiVerdict: recommendation.verdict,
            completedAt: new Date(),
          },
          // Keep verificationStatus as pending_verification — AI NEVER approves!
          verificationStatus: 'pending_verification',
          rejectionReason: '',
        }).catch(() => null);
      }
    }

    return res.status(200).json({
      success: true,
      sessionId: session._id,
      questionsAsked: session.questionsAsked,
      totalQuestions: 5,
      isFinished,
      isCompleted: isFinished,
      questionText: isFinished ? null : (lastAssistantMsg ? lastAssistantMsg.text : ''),
      messages: session.messages,
      recommendation,
      scores: recommendation?.scores || null,
      verdict: recommendation?.verdict || null,
    });
  } catch (err) {
    console.error('Submit Worker Answer Error:', err.message);
    return res.status(400).json({ success: false, message: err.message || 'Failed to submit answer.' });
  }
};
