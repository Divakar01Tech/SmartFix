const User = require('../models/User');
const InterviewSession = require('../models/InterviewSession');

const { askGroqJSON } = require('../services/aiService');

const generateWorkerBio = async (workerId) => {
  try {
    const worker = await User.findById(workerId);
    if (!worker || worker.bioManuallyEdited) return;

    // Get the completed interview session
    const session = await InterviewSession.findOne({ workerId, status: 'completed' }).sort({ completedAt: -1 });
    if (!session || !session.aiRecommendation || !session.aiRecommendation.perQuestionScores) return;

    // Find the best 2 answers based on total score
    const bestScores = [...session.aiRecommendation.perQuestionScores].sort((a, b) => b.total - a.total).slice(0, 2);
    const bestQuestions = bestScores.map((q) => q.question);

    let bestQnA = '';
    let qCount = 1;
    let aiMsg = '';
    for (const msg of session.messages) {
      if (msg.role === 'assistant') {
        aiMsg = msg.text;
      } else if (msg.role === 'worker') {
        if (bestQuestions.includes(qCount)) {
          bestQnA += `Q: ${aiMsg}\nA: ${msg.text}\n\n`;
        }
        qCount++;
      }
    }

    const systemPrompt = `You are a professional profile copywriter for a home services platform.
Write a 2-3 sentence, first-person professional bio for a technician.
Tone: Neutral, trustworthy, factual. No exaggerated claims, no pricing mentions, no phone numbers.
Must be English by default. Keep it under 400 characters.

Also generate a Tamil version of the same bio.
Return ONLY valid JSON in this format:
{
  "bioEn": "English bio here...",
  "bioTa": "Tamil bio here..."
}
Do not use markdown formatting in your response.`;

    const parsed = await askGroqJSON({
      system: systemPrompt,
      user: `Worker Category: ${worker.trade || session.category}
Sub-services: ${(worker.subServices || []).join(', ')}
Strongest Interview Answers:
${bestQnA}`,
      maxTokens: 600
    });
    
    if (parsed) {
      if (parsed.bioEn || parsed.bioTa) {
        worker.bioEn = parsed.bioEn ? parsed.bioEn.substring(0, 400) : '';
        worker.bioTa = parsed.bioTa ? parsed.bioTa.substring(0, 400) : '';
        worker.bioGeneratedAt = new Date();
        await worker.save();
      }
    }
  } catch (err) {
    console.error('Error generating worker bio:', err.message);
  }
};

const regenerateWorkerBio = async (req, res) => {
  try {
    const workerId = req.params.id;
    await generateWorkerBio(workerId);
    
    const worker = await User.findById(workerId);
    res.status(200).json({ success: true, bioEn: worker.bioEn, bioTa: worker.bioTa });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to regenerate bio' });
  }
};

module.exports = { generateWorkerBio, regenerateWorkerBio };
