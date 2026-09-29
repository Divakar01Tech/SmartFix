const { callGeminiJsonApi } = require('./geminiService');

const VALID_SMARTFIX_TRADES = [
  'Plumbing',
  'Electrical Repairs',
  'AC Service & Repair',
  'Refrigerator Repair',
  'Washing Machine Repair',
  'Water Purifier Service',
  'Other'
];

const DIAGNOSIS_SYSTEM_PROMPT = `
You are the AI Problem Diagnosis Engine for SmartFix home service platform in Tamil Nadu.
Analyze customer repair descriptions (and images if uploaded) and return a structured JSON evaluation.

Categories to choose from:
"AC", "Refrigerator", "Washing Machine", "TV", "Plumbing", "Electrical", "Laptop", "Computer", "Mobile", "RO / Water Purifier", "Geyser", "Fan", "Other"

Corresponding SmartFix Trades:
- "AC" -> "AC Service & Repair"
- "Refrigerator" -> "Refrigerator Repair"
- "Washing Machine" -> "Washing Machine Repair"
- "Plumbing" -> "Plumbing"
- "Electrical", "Fan", "Geyser" -> "Electrical Repairs"
- "RO / Water Purifier" -> "Water Purifier Service"
- "Laptop", "Computer", "Mobile", "TV", "Other" -> "Other"

Respond strictly in JSON format with this exact structure:
{
  "category": "AC | Refrigerator | Washing Machine | TV | Plumbing | Electrical | Laptop | Computer | Mobile | RO / Water Purifier | Geyser | Fan | Other",
  "trade": "Plumbing | Electrical Repairs | AC Service & Repair | Refrigerator Repair | Washing Machine Repair | Water Purifier Service | Other",
  "problem": "Brief 2-5 word summary of main problem",
  "additionalIssue": "Additional symptom or null",
  "priority": "High | Medium | Low",
  "confidence": 0.0 to 1.0,
  "recommendedAction": "Actionable recommendation for customer",
  "safetyWarning": "Safety alert string or null (e.g., Turn off MCB switch if short circuit)",
  "serviceRequestDraft": {
    "trade": "Matching trade name",
    "notes": "Clear description for handyman dispatch",
    "estimatedPrice": number in INR ₹ (e.g., 350 for plumbing, 500 for AC, 400 for electrical),
    "priority": "High | Medium | Low"
  }
}
`;

/**
 * Diagnoses customer problem text + optional image
 */
async function diagnoseProblem(problemDescription, imageBase64 = null) {
  if (!problemDescription && !imageBase64) {
    throw new Error('Problem description text or image is required for diagnosis.');
  }

  const prompt = `Customer Problem Query: "${problemDescription || 'Diagnose issue visible in the uploaded image.'}"`;

  const result = await callGeminiJsonApi(prompt, DIAGNOSIS_SYSTEM_PROMPT, imageBase64);

  if (result && result.category) {
    // Standardize trade matching
    if (!VALID_SMARTFIX_TRADES.includes(result.trade)) {
      result.trade = mapCategoryToTrade(result.category);
    }
    return result;
  }

  // Local rule-based fallback if AI API offline or unparseable
  return getFallbackDiagnosis(problemDescription || '');
}

function mapCategoryToTrade(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('plumb') || c.includes('water') || c.includes('tap') || c.includes('leak')) return 'Plumbing';
  if (c.includes('electr') || c.includes('mcb') || c.includes('fan') || c.includes('wire') || c.includes('geyser')) return 'Electrical Repairs';
  if (c.includes('ac') || c.includes('air cond')) return 'AC Service & Repair';
  if (c.includes('fridge') || c.includes('refrigerat')) return 'Refrigerator Repair';
  if (c.includes('wash')) return 'Washing Machine Repair';
  if (c.includes('purifier') || c.includes('ro')) return 'Water Purifier Service';
  return 'Other';
}

function getFallbackDiagnosis(text) {
  const trade = mapCategoryToTrade(text);
  let category = 'Other';
  let price = 350;

  if (trade === 'Plumbing') { category = 'Plumbing'; price = 350; }
  else if (trade === 'Electrical Repairs') { category = 'Electrical'; price = 400; }
  else if (trade === 'AC Service & Repair') { category = 'AC'; price = 500; }
  else if (trade === 'Refrigerator Repair') { category = 'Refrigerator'; price = 450; }
  else if (trade === 'Washing Machine Repair') { category = 'Washing Machine'; price = 450; }
  else if (trade === 'Water Purifier Service') { category = 'RO / Water Purifier'; price = 400; }

  return {
    category,
    trade,
    problem: text.substring(0, 50) || 'Home Repair Issue',
    additionalIssue: null,
    priority: 'Medium',
    confidence: 0.85,
    recommendedAction: 'Book a certified SmartFix technician for physical diagnosis.',
    safetyWarning: trade === 'Electrical Repairs' ? '⚡ Switch off main MCB before touching wires.' : null,
    serviceRequestDraft: {
      trade,
      notes: text || 'Service request created via SmartFix AI Assistant',
      estimatedPrice: price,
      priority: 'Medium'
    }
  };
}

module.exports = {
  diagnoseProblem,
  mapCategoryToTrade,
};
