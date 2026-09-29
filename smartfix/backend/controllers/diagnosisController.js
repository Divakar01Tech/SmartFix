const ServicePricing = require('../models/ServicePricing');
const { callGeminiJsonApi } = require('../services/geminiService');

// In-memory rate limiting map: { userId: { count, resetTime } }
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const checkRateLimit = (userId) => {
  const now = Date.now();
  if (!rateLimitStore.has(userId)) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  const record = rateLimitStore.get(userId);
  if (now > record.resetTime) {
    // Reset window
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW_MS;
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count += 1;
  return true;
};

exports.diagnoseCustomerIssue = async (req, res) => {
  try {
    const { description, imageBase64 } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required for diagnosis' });
    }

    if (!description && !imageBase64) {
      return res.status(400).json({ message: 'Description or image is required' });
    }

    // Rate Limiting
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ message: 'Rate limit exceeded. Please try again later.' });
    }

    // 1. Fetch dynamic categories from ServicePricing to ensure sync
    const allServices = await ServicePricing.find({}).lean();
    
    // Group sub-services by category
    const categoryMap = {};
    allServices.forEach(s => {
      if (!categoryMap[s.category]) {
        categoryMap[s.category] = [];
      }
      categoryMap[s.category].push(s.subService);
    });

    let categoryListString = '';
    for (const [cat, subServices] of Object.entries(categoryMap)) {
      categoryListString += `- ${cat}: [${subServices.join(', ')}]\n`;
    }

    // 2. Build Prompt
    const systemPrompt = `
You are the SmartFix AI Diagnosis Assistant. Your job is to analyze a customer's home service problem description and/or image.
You must categorize the issue into exactly ONE category and ONE subService from the list below.
DO NOT estimate the price yourself. Your role is only category/subService selection and urgency estimation.

Available Categories and Sub-services:
${categoryListString}

Respond ONLY in strict JSON format:
{
  "category": "exact category name from list",
  "subService": "exact subService name from list",
  "urgency": "low" | "medium" | "high" | "emergency",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "1 sentence explanation in the same language as the input (English or Tamil)"
}
`;

    const promptText = `Customer Problem Description: "${description || 'Please diagnose the issue from the image'}"`;

    // 3. Call AI API (Using the same pattern as KYC/geminiService)
    const diagnosisResult = await callGeminiJsonApi(promptText, systemPrompt, imageBase64);

    if (!diagnosisResult || !diagnosisResult.category || !diagnosisResult.subService) {
      return res.status(500).json({ message: 'Failed to generate AI diagnosis', needsManualReview: true });
    }

    // 4. Lookup Pricing in DB
    const pricingRecord = await ServicePricing.findOne({
      category: diagnosisResult.category,
      subService: diagnosisResult.subService
    }).lean();

    let needsManualReview = diagnosisResult.confidence < 0.5;
    let priceRange = { min: 0, max: 0 };
    let avgDurationMinutes = 60;

    if (pricingRecord) {
      priceRange = { min: pricingRecord.minPrice, max: pricingRecord.maxPrice };
      avgDurationMinutes = pricingRecord.avgDurationMinutes;
    } else {
      needsManualReview = true; // Fallback if AI hallucinates a category
    }

    // 5. Return Response
    return res.status(200).json({
      category: diagnosisResult.category,
      subService: diagnosisResult.subService,
      urgency: diagnosisResult.urgency || 'medium',
      confidence: diagnosisResult.confidence || 0.5,
      reasoning: diagnosisResult.reasoning || 'AI Diagnosis complete.',
      priceRange,
      avgDurationMinutes,
      needsManualReview
    });

  } catch (error) {
    console.error('Diagnosis Controller Error:', error.message);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
