const ServicePricing = require('../models/ServicePricing');
const { askGroqJSON } = require('../services/aiService');

exports.diagnoseCustomerIssue = async (req, res) => {
  try {
    const { text, language = 'en', zone = 'town' } = req.body;
    const file = req.file;

    if (!text && !file) {
      return res.status(400).json({ success: false, message: 'Description or image is required' });
    }

    // Zone Multiplier Logic
    let priceMultiplier = 1.0;
    if (zone === 'metro') priceMultiplier = 1.2;
    else if (zone === 'rural') priceMultiplier = 0.8;

    // 1. Fetch dynamic categories and pricing
    const allServices = await ServicePricing.find({}).lean();
    let categoryListString = '';
    const validPairs = new Set();
    
    // Group sub-services by category
    const categoryMap = {};
    allServices.forEach(s => {
      if (!categoryMap[s.category]) categoryMap[s.category] = [];
      const adjMin = Math.round(s.minPrice * priceMultiplier);
      const adjMax = Math.round(s.maxPrice * priceMultiplier);
      categoryMap[s.category].push({ sub: s.subService, min: adjMin, max: adjMax });
      validPairs.add(`${s.category}:::${s.subService}`);
    });

    for (const [cat, subServices] of Object.entries(categoryMap)) {
      const subList = subServices.map(s => `${s.sub} (₹${s.min}-₹${s.max})`).join(', ');
      categoryListString += `- ${cat}: [${subList}]\n`;
    }

    // 2. Build Prompt
    const systemPrompt = `
You are the SmartFix AI Diagnosis Assistant. Your job is to analyze a customer's home service problem description and/or image.
You must categorize the issue into exactly ONE category and ONE subService from the list below.
Select priceMin and priceMax strictly based on the provided ranges for that sub-service. DO NOT invent prices.

Available Categories and Sub-services (with price ranges):
${categoryListString}

Rules:
1. If the photo is blurry, unrelated, or impossible to diagnose, set photoQualityOk: false and provide a followUpQuestion in ${language === 'ta' ? 'Tamil' : 'English'} asking for a clearer photo.
2. If you are unsure (confidence < 0.5), set confidence accordingly.
3. SAFETY RULE: If there is a gas smell, sparks, burning smell, electric shock, or flooding, urgency MUST be "Emergency". The first safety tip MUST be to switch off the source safely (e.g., main MCB, water valve, gas cylinder). Advice must be conservative; NEVER ask the user to open electrical panels or repair anything themselves.
4. Output reason, safetyTips (max 4), and followUpQuestion in the user's requested language (${language === 'ta' ? 'Tamil' : 'English'}).

Respond ONLY in strict JSON format:
{
  "category": "exact category name from list",
  "subService": "exact subService name from list",
  "urgency": "Low" | "Medium" | "Emergency",
  "priceMin": number,
  "priceMax": number,
  "safetyTips": ["tip 1", "tip 2"], 
  "confidence": <number between 0.0 and 1.0>,
  "reason": "1-2 sentence explanation",
  "photoQualityOk": boolean,
  "followUpQuestion": "question string or null"
}
`;

    let imageBase64;
    let imageMediaType;
    if (file) {
      imageBase64 = file.buffer.toString('base64');
      imageMediaType = file.mimetype;
    }

    const userPrompt = text ? `Customer Problem Description: "${text}"` : "Please diagnose the issue from the attached image.";

    const diagnosisResult = await askGroqJSON({
      system: systemPrompt,
      user: userPrompt,
      imageBase64,
      imageMediaType,
      maxTokens: 500
    });

    // Validation
    const isPairValid = validPairs.has(`${diagnosisResult.category}:::${diagnosisResult.subService}`);
    if (!isPairValid || diagnosisResult.confidence < 0.5 || diagnosisResult.photoQualityOk === false) {
       return res.status(200).json({
         success: true,
         fallback: true,
         followUpQuestion: diagnosisResult.followUpQuestion || (language === 'ta' ? 'இதை கண்டறிய முடியவில்லை. நீங்கள் எந்த வகையான சேவையை தேடுகிறீர்கள்?' : 'We could not diagnose the issue automatically. Please select manually.')
       });
    }

    return res.status(200).json({
      success: true,
      fallback: false,
      ...diagnosisResult
    });

  } catch (error) {
    console.error('Diagnosis Controller Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
