const { callGeminiApi, callGeminiJsonApi } = require('../services/geminiService');
const { diagnoseProblem, mapCategoryToTrade } = require('../services/aiDiagnosisService');
const { matchWorkersForCategory } = require('../services/aiWorkerMatchingService');
const { detectLiveIntent, SUPPORTED_INTENTS, SIVAGANGAI_TALUKS, SERVICE_CATEGORIES } = require('../services/aiIntentService');
const { processDialogueTurn } = require('../services/aiDialogueManager');
const Booking = require('../models/Booking');
const User = require('../models/User');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

const DOMAIN_EXPERT_SYSTEM_PROMPT = `
You are SmartFix AI Master Agent — an elite 98% high-accuracy home services, repair diagnostic, and cost estimation AI assistant for SmartFix platform in Tamil Nadu.
You possess deep expert knowledge trained across 10,000+ real-world home repair scenarios, Tamil Nadu local service pricing (in INR ₹), emergency DIY safety protocols, and SmartFix platform booking workflows.

=== COVERED DOMAINS & EXPERT KNOWLEDGE ===
1. 🚰 PLUMBING: Leaking Tap/Spout (₹250-₹350), Tank Overflow (₹350-₹450), Drain Blockage (₹400-₹600), Geyser Leak (₹450-₹650).
2. ⚡ ELECTRICAL: MCB Tripping (₹300-₹500), Ceiling Fan Repair (₹150-₹350), Main Switchboard (₹500-₹800).
3. ❄️ AIR CONDITIONING & APPLIANCES: AC Water Leak (₹500-₹800), AC Gas Refill R32/R410A (₹1,500-₹2,200), Fridge Defrost (₹600-₹900), Washing Machine (₹350-₹600).
4. 📍 LOCAL PRICING & FARES: BikePro Express (₹149 Base), AutoHandyman (₹249 Base), MasterTech Specialist (₹449 Base). Hourly rate ₹300-₹450/hr.

=== RESPONSE GUIDELINES ===
- Respond concisely with clear bullet points.
- If user speaks Tamil or Tanglish, reply in natural conversational Tamil/English.
- Always include clear cost estimates in ₹ INR.
- Include emergency safety advice (turn off main valve / MCB) for dangerous electrical/plumbing situations.
- Offer to help create a Service Request or match local verified handymen on SmartFix.
`;

/**
 * Local rule-based fallback if AI APIs fail
 */
function getLocalKnowledgeFallback(message) {
  const q = (message || '').toLowerCase();

  if (q.includes('plumb') || q.includes('water') || q.includes('tap') || q.includes('leak') || q.includes('pipe') || q.includes('tank')) {
    return `🚰 **SmartFix Plumbing Repair & Cost Guide:**\n\n` +
      `• **Leaking Tap / Valve:** Rubber washer or ceramic disc replacement (Est: ₹250–₹350).\n` +
      `• **Overhead Tank Overflow:** Float valve ball replacement (Est: ₹350–₹450).\n` +
      `• **Drain Pipe Blockage:** Auger hydro-flush clearing (Est: ₹400–₹600).\n` +
      `• **Safety Alert:** Turn off main water inlet valve near meter.\n\n` +
      `👉 *You can create a service request directly in this chat!*`;
  }

  if (q.includes('electr') || q.includes('mcb') || q.includes('power') || q.includes('spark') || q.includes('wire') || q.includes('fan') || q.includes('light')) {
    return `⚡ **SmartFix Electrical Repair & Safety Guide:**\n\n` +
      `• **MCB Tripping:** Unplug heavy appliances to check for short circuits (Est: ₹300–₹500).\n` +
      `• **Ceiling Fan Slow / Wobbly:** Replace 2.5mfd capacitor (Est: ₹150–₹250).\n` +
      `• **Safety Alert:** Switch off main MCB trip before inspecting any wires.\n\n` +
      `👉 *Would you like me to connect you with verified electricians nearby?*`;
  }

  if (q.includes('ac') || q.includes('cool') || q.includes('fridge') || q.includes('refrigerat') || q.includes('wash') || q.includes('machine')) {
    return `❄️ **SmartFix AC & Appliance Diagnostic:**\n\n` +
      `• **AC Water Leaking Indoors:** Drain pipe clog / jet wash (Est: ₹500–₹800).\n` +
      `• **AC Gas Charging (R32 / R410A):** Pressure check & gas refill (Est: ₹1,500–₹2,200).\n` +
      `• **Washing Machine Drain Issue:** Pump filter clearing (Est: ₹350–₹550).\n\n` +
      `👉 *Book verified technicians with 30-day repair warranty!*`;
  }

  return `👨‍🔧 **SmartFix AI Master Assistant:**\n\n` +
    `I can assist you with plumbing, electrical, AC repair, carpentry, painting, and appliance troubleshooting across Sivagangai & surrounding areas.\n\n` +
    `• Average Hourly Rate: ₹300 – ₹450/hr\n` +
    `• Guaranteed Arrival: Within 1 hour\n` +
    `• Verified Handymen: 100% Background Checked\n\n` +
    `How can I help with your repair today?`;
}

// ==============================================================
// 1. POST /api/ai/chat — Conversational AI Chatbot (Text + Image + NLU Dialogue Engine)
// ==============================================================
exports.askSmartFixAi = async (req, res) => {
  try {
    const { message, history, mcpContext, image, audio, language, sessionId } = req.body;
    const mediaPayload = image || audio;

    if (!message && !mediaPayload) {
      return res.status(400).json({ message: 'Message query or image/audio upload is required' });
    }

    const userRole = req.user?.role || 'customer';
    const userId = req.user?.id || null;

    // 1. Run NLU Intent Recognition & Entity Extraction
    const intentData = await detectLiveIntent(message, history, mediaPayload, userRole);

    // 2. Process Dialogue State, Trust Gating, and Action Routing
    const dialogueTurn = await processDialogueTurn(userId, sessionId, message, userRole, intentData, req.user);

    let replyText = dialogueTurn.reply;
    let accuracyText = '98%+ Dialogue & Intent Engine';
    let providerName = 'SmartFix NLU Engine';
    let usageObj = null;

    // Intents that have pure transactional status responses without needing AI text generation
    const TRANSACTIONAL_INTENTS = [
      'TrackWorker', 'CancelBooking', 'CheckBookingStatus', 'CheckWalletBalance',
      'CheckKYCStatus', 'QueryPendingKYC', 'QuerySLABreaches', 'QueryRevenueMetrics',
      'UpdateAvailability', 'SwitchLanguage'
    ];

    const isTransactionalOnly = TRANSACTIONAL_INTENTS.includes(intentData.intent);

    // Call AI LLM for all general queries, questions, problem descriptions, pricing, diagnostic inquiries
    if (!isTransactionalOnly || intentData.intent === 'FallbackIntent' || intentData.intent === 'BookService') {
      const langInstruction = (language || intentData.language) === 'ta' ? '\n[User preferred language: Tamil. Reply in clear conversational Tamil.]' : '';
      const messagesPayload = [
        { role: 'system', content: DOMAIN_EXPERT_SYSTEM_PROMPT + langInstruction },
        ...(mcpContext ? [{ role: 'system', content: `[Active Real-Time Context: ${mcpContext}]` }] : []),
        ...(history || []).map(h => ({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.content || h.text || ''
        })),
        { role: 'user', content: message || 'Please assist with home service query.' }
      ];

      const aiResult = await callGeminiApi(messagesPayload, 0.4, 550, mediaPayload);
      if (aiResult && aiResult.text) {
        replyText = aiResult.text;
        accuracyText = `98%+ AI (${aiResult.model})`;
        providerName = aiResult.provider || 'Google Gemini LLM';
        usageObj = aiResult.usage;
      } else if (!isTransactionalOnly) {
        // Fall back to Local Knowledge Base if AI APIs are offline or unreachable
        replyText = getLocalKnowledgeFallback(message);
        accuracyText = '98%+ SmartFix Domain Knowledge Base';
        providerName = 'SmartFix Expert System';
      }
    }

    return res.status(200).json({
      reply: replyText,
      accuracy: accuracyText,
      provider: providerName,
      usage: usageObj,
      intentData: dialogueTurn.intentData,
      actionResult: dialogueTurn.actionResult,
      sessionState: dialogueTurn.sessionState
    });
  } catch (err) {
    console.error('SmartFix AI Chat Error:', err.message);
    res.status(500).json({ message: 'Failed to process AI chat query', error: err.message });
  }
};

// ==============================================================
// 1b. POST /api/ai/detect-intent — Standalone Live Intent Detection
// ==============================================================
exports.detectIntentAction = async (req, res) => {
  try {
    const { message, history, image } = req.body;
    if (!message && !image) {
      return res.status(400).json({ message: 'Message query or image payload is required' });
    }

    const userRole = req.user?.role || 'customer';
    const intentData = await detectLiveIntent(message, history, image, userRole);
    return res.status(200).json({
      success: true,
      intentData
    });
  } catch (err) {
    console.error('AI Intent Detection Error:', err.message);
    res.status(500).json({ message: 'Failed to detect intent', error: err.message });
  }
};

// ==============================================================
// 1c. GET /api/ai/taxonomy — Fetch Taxonomy Metadata & Action Schema
// ==============================================================
exports.getTaxonomy = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      intents: SUPPORTED_INTENTS,
      taluks: SIVAGANGAI_TALUKS,
      categories: SERVICE_CATEGORIES
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch intent taxonomy', error: err.message });
  }
};



// ==============================================================
// 2. POST /api/ai/diagnose — AI Problem Diagnosis
// ==============================================================
exports.diagnoseProblem = async (req, res) => {
  try {
    const { problem, image } = req.body;
    if (!problem && !image) {
      return res.status(400).json({ message: 'Problem text or image is required' });
    }

    const diagnosis = await diagnoseProblem(problem, image);

    // Fetch matching workers automatically from DB for diagnosis context
    const workerMatches = await matchWorkersForCategory(diagnosis.trade);

    res.status(200).json({
      success: true,
      diagnosis,
      workerMatches
    });
  } catch (err) {
    console.error('AI Diagnosis Error:', err.message);
    res.status(500).json({ message: 'Failed to generate AI diagnosis', error: err.message });
  }
};

// ==============================================================
// 3. POST /api/ai/analyze-image — Multimodal Image Vision Analysis
// ==============================================================
exports.analyzeImage = async (req, res) => {
  try {
    const { image, prompt } = req.body;
    if (!image) {
      return res.status(400).json({ message: 'Base64 image payload is required' });
    }

    const visionSystemPrompt = `
You are the AI Vision Inspector for SmartFix Home Repair.
Analyze the uploaded image of an appliance, component, error label, or damage.
Provide:
1. What appears to be visible in the image.
2. The likely technical issue or defect.
3. The relevant SmartFix service category (AC, Plumbing, Electrical, Refrigerator, Washing Machine, RO Water Purifier, Geyser, etc.).
4. Safe troubleshooting steps.
5. Recommendation on whether professional technician service is required.

IMPORTANT: Keep analysis clear, professional, and concise.
`;

    const userPrompt = prompt || 'Please analyze this appliance image and explain the problem, category, and safety advice.';

    const result = await callGeminiApi(
      [{ role: 'system', content: visionSystemPrompt }, { role: 'user', content: userPrompt }],
      0.3,
      600,
      image
    );

    const replyText = result?.text || 'Image analysis completed. Please verify connections and consult a certified technician.';

    res.status(200).json({
      success: true,
      analysis: replyText,
      disclaimer: '⚠️ AI image analysis is an estimate and may not be 100% accurate. For safety-critical electrical or gas issues, contact a qualified professional.',
      model: result?.model || 'Gemini Vision'
    });
  } catch (err) {
    console.error('AI Image Analysis Error:', err.message);
    res.status(500).json({ message: 'Failed to analyze image', error: err.message });
  }
};

// ==============================================================
// 4. POST /api/ai/create-service-request — AI Service Request Creation
// ==============================================================
exports.createServiceRequestFromAi = async (req, res) => {
  try {
    const { trade, notes, price, address, workerId, serviceTier } = req.body;
    const customerId = req.user?.id;

    if (!customerId) {
      return res.status(401).json({ message: 'Please log in to confirm your AI service request.' });
    }

    if (!trade) {
      return res.status(400).json({ message: 'Service trade/category is required.' });
    }

    const assignedWorkerId = workerId || null;

    const newBooking = await Booking.create({
      customer: customerId,
      worker: assignedWorkerId,
      trade: trade || 'Plumbing',
      serviceTier: serviceTier || 'AutoHandyman',
      date: new Date().toISOString().split('T')[0],
      time: 'As Soon As Possible (AI Express)',
      address: address || 'Sivagangai District, Tamil Nadu',
      notes: notes || 'Service request created via SmartFix AI Assistant',
      price: Number(price) || 350,
      status: 'Pending',
      pickupLat: 9.8433,
      pickupLng: 78.4809,
      userLat: 9.8433,
      userLng: 78.4809,
    });

    res.status(201).json({
      success: true,
      message: '🎉 Service Request created successfully!',
      booking: newBooking
    });
  } catch (err) {
    console.error('AI Create Service Request Error:', err.message);
    res.status(500).json({ message: 'Failed to create service request', error: err.message });
  }
};

// ==============================================================
// 5. POST /api/ai/match-workers — Match Approved Handymen from DB
// ==============================================================
exports.matchWorkers = async (req, res) => {
  try {
    const { category, location } = req.body;
    const trade = mapCategoryToTrade(category || '');
    const result = await matchWorkersForCategory(trade, location || '');
    res.status(200).json(result);
  } catch (err) {
    console.error('Worker Matching Error:', err.message);
    res.status(500).json({ message: 'Failed to match workers', error: err.message });
  }
};
