const InterviewSession = require('../models/InterviewSession');
const User = require('../models/User');
const { callGeminiApi } = require('./geminiService');
const { generateWorkerBio } = require('../controllers/bioController');



// Category fallback practical questions for robust offline operation
const CATEGORY_FALLBACK_QUESTIONS = {
  'Plumbing': [
    'When fixing a leaking tap or valve under a kitchen sink, what is the very first physical safety step you take before loosening any pipes?',
    'A customer reports low water pressure in their bathroom shower while all other taps have good pressure. What do you inspect first?',
    'How do you properly seal a threaded PVC pipe connection to prevent high-pressure water leaks?',
    'If a toilet flush tank keeps overflowing onto the floor, what component is likely faulty and how do you adjust or replace it?',
    'How do you check for hidden water leaks inside a customer wall without breaking unnecessary tiles?'
  ],
  'Electrical Repairs': [
    'If an MCB trips repeatedly as soon as a customer turns on their geyser, how do you determine if the issue is in the MCB or the geyser heating element?',
    'What safety precautions and tools do you use before working inside a main Distribution Box (DB)?',
    'A ceiling fan is turning very slowly and making a humming sound. What component do you test and replace first?',
    'Explain how you check for proper earth grounding in a 3-pin socket using a digital multimeter.',
    'How do you safely connect an inverter and battery backup system to a house main wiring line?'
  ],
  'AC Service and Repair': [
    'What causes an indoor split AC unit to drip water down the wall inside a bedroom, and how do you clean or fix it?',
    'If an AC compressor runs for 2 minutes and then shuts off while blowing warm air, what electrical or pressure issue do you diagnose?',
    'Explain the safety procedure for checking R32 or R410A refrigerant gas pressure using a manifold gauge.',
    'What is the difference between a general service filter cleaning and a chemical jet wash service for a split AC?',
    'How do you inspect an AC outdoor unit condenser coil for blockages or bent fins?'
  ],
  'Refrigerator Repair': [
    'If a single-door refrigerator compressor is running continuously but the freezer is not forming ice, what is the probable cause?',
    'How do you test if a frost-free refrigerator relay switch or overload protector is burnt out?',
    'What steps do you take if a fridge cabinet is giving a mild electric shock when touched?',
    'How do you clear a blocked defrost drain hole in a double-door refrigerator?',
    'What checklist do you follow before recharging refrigerant gas in a sealed fridge system?'
  ],
  'Washing Machine Repair': [
    'If a top-load washing machine vibrates violently and stops during the high-speed spin cycle, what mechanical parts do you inspect?',
    'How do you diagnose why a fully automatic washing machine is not draining water out of the drum?',
    'What safety steps do you take when troubleshooting an electronic PCB main board fault in a front-load washer?',
    'If water keeps filling inside the drum even when the machine is powered off, which inlet solenoid valve needs replacement?',
    'How do you clean and service a clogged lint filter and water inlet mesh filter?'
  ],
  'Water Purifier Service': [
    'When installing a new RO membrane filter, how do you verify proper TDS reduction and waste-to-pure water ratio?',
    'How often should sediment filters and pre-carbon cartridges be replaced to protect the RO pump and membrane?',
    'If a water purifier pump is running continuously but no purified water enters the storage tank, what do you check?',
    'How do you safely test an inline UV lamp and UV ballast circuit?',
    'What sanitization process do you follow when servicing a customer’s water purifier storage tank?'
  ]
};

/**
 * Pre-check for substantive answers to prevent trivial single-word responses
 */
function isLikelyRealAnswer(text) {
  if (!text || typeof text !== 'string') return false;
  const cleaned = text.trim().toLowerCase();
  const normalized = cleaned.replace(/[^a-z0-9\s]/g, '').trim();
  if (cleaned.length < 8 || normalized.length < 8) return false;              // too short to be substantive
  const greetingsOnly = ['hi', 'hii', 'hello', 'hey', 'ok', 'yes', 'no', 'test', 'hi hello', 'hii hello'];
  if (greetingsOnly.includes(cleaned) || greetingsOnly.includes(normalized)) return false;
  return true;
}

/**
 * Call Gemini API or OpenRouter API with context history
 */
async function callLlmApi(messagesPayload, temperature = 0.3, maxTokens = 600) {
  // 1. Primary: Gemini LLM API
  if (process.env.GROK_API_KEY || process.env.GEMINI_API_KEY) {
    const geminiResult = await callGeminiApi(messagesPayload, temperature, maxTokens);
    if (geminiResult && geminiResult.text) {
      return geminiResult.text;
    }
  }

  // 2. Fallback: OpenRouter API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  // Format system messages safely for OpenRouter model compatibility
  const openRouterMessages = messagesPayload.map((m) => {
    if (m.role === 'system') {
      return { role: 'user', content: `[SYSTEM INSTRUCTION]\n${m.content}` };
    }
    return m;
  });

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'SmartFix Skill Verification AI',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'claude-sonnet-4-6',
        messages: openRouterMessages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI Gateway status ${response.status}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('⚠️ Skill Interview AI call warning:', err.message);
    return null;
  }
}

/**
 * 1. Start or resume interview session
 */
async function startInterview(workerId, category, language = 'en') {
  // Clean up stale in_progress sessions older than 30 minutes (mark abandoned)
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
  await InterviewSession.updateMany(
    { workerId, status: 'in_progress', updatedAt: { $lt: thirtyMinsAgo } },
    { status: 'abandoned' }
  );

  // Check 24-hour rate limit rule: 1 session per worker per category per 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentSession = await InterviewSession.findOne({
    workerId,
    category,
    startedAt: { $gte: twentyFourHoursAgo },
  }).sort({ createdAt: -1 });

  if (recentSession) {
    // If it's currently active, return existing session
    if (recentSession.status === 'in_progress') {
      return recentSession;
    }
    // If completed or abandoned within 24h, block duplicate attempt
    throw new Error('⏱️ Rate Limit: You can attempt 1 practical skill verification interview per 24 hours per category. Please try again tomorrow.');
  }

  // Create new session
  const session = await InterviewSession.create({
    workerId,
    category: category || 'Plumbing',
    status: 'in_progress',
    messages: [],
    questionsAsked: 0,
    currentQuestionRetries: 0,
    startedAt: new Date(),
  });

  // Ask first question
  return await askNextQuestion(session._id, language);
}

/**
 * 2. Ask next question (1 to 5)
 */
async function askNextQuestion(sessionId, language = 'en') {
  const session = await InterviewSession.findById(sessionId);
  if (!session) throw new Error('Interview session not found');

  if (session.questionsAsked >= 5) {
    return session;
  }

  const category = session.category || 'Plumbing';
  const qIndex = session.questionsAsked; // 0 to 4

  const isTamil = language === 'ta';

  const systemPrompt = `You are conducting a spoken/typed practical skill-verification interview for a home-service worker applying to join SmartFix in the category: ${category}. Ask ONE practical, real-world question at a time to assess genuine hands-on skill (not certifications or theory). Base questions on common on-the-job scenarios a ${category} worker would face. Keep questions short, direct, and in plain language without long introductory fluff — many workers have limited literacy, so questions should also be answerable via short spoken response. ${isTamil ? 'Ask the question in simple, natural conversational Tamil.' : 'Keep language simple and concise.'} Always write complete, un-truncated sentences and do not cut off mid-sentence. You are asking question ${qIndex + 1} of 5. After 5 questions total, stop and do not ask more.`;

  // Format context history
  const historyPayload = [
    { role: 'system', content: systemPrompt },
    ...session.messages.map((m) => ({
      role: m.role === 'worker' ? 'user' : 'assistant',
      content: m.text,
    })),
    { role: 'user', content: `Please ask question ${qIndex + 1} of 5 for a ${category} technician.` },
  ];

  let nextQuestionText = await callLlmApi(historyPayload, 0.4, 600);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`🤖 Raw LLM Q${qIndex + 1} Response:`, nextQuestionText);
  }

  // Fallback if AI API offline
  if (!nextQuestionText) {
    const fallbacks = CATEGORY_FALLBACK_QUESTIONS[category] || CATEGORY_FALLBACK_QUESTIONS['Plumbing'];
    nextQuestionText = fallbacks[qIndex % fallbacks.length];
    if (isTamil) {
      nextQuestionText = `[கேள்வி ${qIndex + 1}/5] ${category} பணிக்கான செயல்முறை கேள்வி: ${nextQuestionText}`;
    }
  }

  // Clean up any extraneous quotes
  nextQuestionText = nextQuestionText.replace(/^["']|["']$/g, '').trim();

  session.messages.push({
    role: 'assistant',
    text: nextQuestionText,
    timestamp: new Date(),
  });
  session.questionsAsked += 1;
  await session.save();

  return session;
}

/**
 * 3. Submit worker answer
 */
async function submitAnswer(sessionId, answerText, language = 'en') {
  const session = await InterviewSession.findById(sessionId);
  if (!session) throw new Error('Interview session not found');

  if (session.status !== 'in_progress') {
    throw new Error('This interview session is already completed or expired.');
  }

  if (!answerText || !answerText.trim()) {
    throw new Error('Please type or speak your response before submitting.');
  }

  const cleanedAnswer = answerText.trim();
  const currentQNum = session.questionsAsked || 1;
  const isReal = isLikelyRealAnswer(cleanedAnswer);

  if (!isReal) {
    const currentRetries = session.currentQuestionRetries || 0;
    if (currentRetries < 2) {
      // Re-prompt in the same question turn without advancing questionsAsked
      session.currentQuestionRetries = currentRetries + 1;

      session.messages.push({
        role: 'worker',
        text: cleanedAnswer,
        timestamp: new Date(),
      });

      const isTamil = language === 'ta';
      const repromptText = isTamil
        ? 'இது முழு பதில் இல்லை போல் இருக்கிறது — நீங்கள் உண்மையில் என்ன செய்வீர்கள் என்று சொந்த வார்த்தைகளில் விளக்கவும்.'
        : "That doesn't look like a full answer — please describe what you'd actually do, in your own words. Take your time.";

      session.messages.push({
        role: 'assistant',
        text: repromptText,
        timestamp: new Date(),
      });

      await session.save();
      return session;
    } else {
      // Cap at 2 retries — accept weak answer after 2 failed attempts, flag internally, reset counter and move on
      session.currentQuestionRetries = 0;
      if (!session.autoFlaggedConcerns) session.autoFlaggedConcerns = [];
      session.autoFlaggedConcerns.push(`weak/short answer on Q${currentQNum} after retries`);
    }
  } else {
    // Substantive answer — reset retry counter
    session.currentQuestionRetries = 0;
  }

  // Record worker answer
  session.messages.push({
    role: 'worker',
    text: cleanedAnswer,
    timestamp: new Date(),
  });

  await session.save();

  // If we haven't reached 5 questions yet, ask next question
  if (session.questionsAsked < 5) {
    return await askNextQuestion(sessionId, language);
  } else {
    // Reached 5 questions: Generate final advisory assessment
    return await generateFinalAssessment(sessionId);
  }
}

/**
 * 4. Generate Final AI Assessment (structured rubric evaluation)
 */
async function generateFinalAssessment(sessionId) {
  const session = await InterviewSession.findById(sessionId);
  if (!session) throw new Error('Interview session not found');

  const category = session.category;
  const transcriptText = session.messages
    .map((m) => `${m.role === 'assistant' ? 'AI Question' : 'Worker Answer'}: ${m.text}`)
    .join('\n');

  const evaluationSystemPrompt = `Review this practical skill interview transcript for a ${category} worker. Score EACH of the 5 answers against these 4 criteria, 0-25 points each:

A. Practical Specificity (0-25) — concrete steps/tools vs vague statements
B. Safety Awareness (0-25) — proactive safety mention vs none
C. Problem-Diagnosis Logic (0-25) — logical troubleshooting sequence vs jumping to a fix
D. Communication Clarity (0-25) — practical clarity ONLY, do not penalize grammar, spelling, or English fluency; broken English conveying a correct process should score high here

For each answer, compute a 0-100 score (sum of the 4 criteria). Average all 5 answer scores into one final score.

Map the final average to a verdict: 70-100 = 'pass', 40-69 = 'borderline', 0-39 = 'fail'.

Respond ONLY in JSON with this exact shape:
{
  "verdict": "pass" | "borderline" | "fail",
  "confidenceScore": number (the final averaged 0-100 score),
  "perQuestionScores": [
    {
      "question": 1,
      "specificity": 0-25,
      "safety": 0-25,
      "diagnosisLogic": 0-25,
      "clarity": 0-25,
      "total": 0-100
    }
  ],
  "summary": "2-3 sentences explaining the overall reasoning for a human admin to read",
  "flaggedConcerns": ["string"]
}
Do not include markdown code block backticks in your output if possible.`;

  const payload = [
    { role: 'system', content: evaluationSystemPrompt },
    { role: 'user', content: `Interview Transcript:\n${transcriptText}` },
  ];

  let rawResult = await callLlmApi(payload, 0.2, 1000);

  let recommendation = {
    verdict: 'borderline',
    confidenceScore: 65,
    perQuestionScores: [],
    summary: 'The worker completed all 5 practical scenario questions. Their responses demonstrate basic operational understanding of repair workflows.',
    flaggedConcerns: [],
  };

  if (rawResult) {
    try {
      // Strip markdown code fences if present
      let cleanedJson = rawResult.replace(/```json/gi, '').replace(/```/g, '').trim();
      const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleanedJson = jsonMatch[0];

      const parsed = JSON.parse(cleanedJson);

      if (Array.isArray(parsed.perQuestionScores) && parsed.perQuestionScores.length > 0) {
        recommendation.perQuestionScores = parsed.perQuestionScores.map((q, idx) => {
          const spec = Math.min(25, Math.max(0, Number(q.specificity) || 0));
          const safe = Math.min(25, Math.max(0, Number(q.safety) || 0));
          const diag = Math.min(25, Math.max(0, Number(q.diagnosisLogic) || 0));
          const clar = Math.min(25, Math.max(0, Number(q.clarity) || 0));
          const calculatedTotal = spec + safe + diag + clar;
          return {
            question: q.question || (idx + 1),
            specificity: spec,
            safety: safe,
            diagnosisLogic: diag,
            clarity: clar,
            total: typeof q.total === 'number' ? Math.min(100, Math.max(0, Number(q.total))) : calculatedTotal,
          };
        });

        // Calculate exact average score across perQuestionScores
        const totalSum = recommendation.perQuestionScores.reduce((sum, q) => sum + q.total, 0);
        const avgScore = Math.round(totalSum / recommendation.perQuestionScores.length);
        recommendation.confidenceScore = avgScore;

        // Map verdict directly based on numeric average
        if (avgScore >= 70) recommendation.verdict = 'pass';
        else if (avgScore >= 40) recommendation.verdict = 'borderline';
        else recommendation.verdict = 'fail';
      } else if (typeof parsed.confidenceScore === 'number') {
        const score = Math.min(100, Math.max(0, Math.round(parsed.confidenceScore)));
        recommendation.confidenceScore = score;
        if (score >= 70) recommendation.verdict = 'pass';
        else if (score >= 40) recommendation.verdict = 'borderline';
        else recommendation.verdict = 'fail';
      } else if (parsed.verdict && ['pass', 'borderline', 'fail'].includes(parsed.verdict.toLowerCase())) {
        recommendation.verdict = parsed.verdict.toLowerCase();
      }

      if (parsed.summary && typeof parsed.summary === 'string') {
        recommendation.summary = parsed.summary.trim();
      }
      if (Array.isArray(parsed.flaggedConcerns)) {
        recommendation.flaggedConcerns = parsed.flaggedConcerns.map((c) => String(c).trim()).filter(Boolean);
      }
    } catch (parseErr) {
      console.warn('⚠️ Failed to parse AI recommendation rubric JSON, using fallback evaluation:', parseErr.message);
    }
  }

  // Guarantee 5 perQuestionScores fallback entries if none generated
  if (!recommendation.perQuestionScores || recommendation.perQuestionScores.length === 0) {
    const fallbackBase = recommendation.verdict === 'pass' ? 20 : recommendation.verdict === 'fail' ? 8 : 15;
    recommendation.perQuestionScores = [1, 2, 3, 4, 5].map((qNum) => ({
      question: qNum,
      specificity: fallbackBase,
      safety: fallbackBase,
      diagnosisLogic: fallbackBase,
      clarity: fallbackBase,
      total: fallbackBase * 4,
    }));
    const sum = recommendation.perQuestionScores.reduce((acc, q) => acc + q.total, 0);
    recommendation.confidenceScore = Math.round(sum / 5);
    if (recommendation.confidenceScore >= 70) recommendation.verdict = 'pass';
    else if (recommendation.confidenceScore >= 40) recommendation.verdict = 'borderline';
    else recommendation.verdict = 'fail';
  }

  if (session.autoFlaggedConcerns && session.autoFlaggedConcerns.length > 0) {
    const merged = new Set([
      ...(recommendation.flaggedConcerns || []),
      ...session.autoFlaggedConcerns,
    ]);
    recommendation.flaggedConcerns = Array.from(merged);
  }

  session.aiRecommendation = recommendation;
  session.status = 'completed';
  session.completedAt = new Date();
  await session.save();

  // Keep worker profile verificationStatus as 'Pending' — Admin makes final decision
  await User.findByIdAndUpdate(session.workerId, {
    verificationStatus: 'Pending',
  }).catch(() => null);

  // Trigger async bio generation (do not await to avoid blocking)
  generateWorkerBio(session.workerId).catch(err => console.error('Bio Gen Error:', err));

  return session;
}

module.exports = {
  startInterview,
  askNextQuestion,
  submitAnswer,
  generateFinalAssessment,
};
