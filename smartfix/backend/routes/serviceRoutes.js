const express = require('express');
const router = express.Router();
const { SERVICE_CATEGORIES, SERVICE_KEYWORDS } = require('../config/serviceCategories');
const { askGroqJSON, aiRateLimiter } = require('../services/aiService');

// Normalize string for local matching
const normalizeString = (str) => {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
};

// @route  POST /api/services/search
// @desc   Search for services using local match and AI fallback
// @access Public (with AI rate limit)
router.post('/search', aiRateLimiter, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }
    
    if (query.length > 200) {
      return res.status(400).json({ success: false, message: 'Search query too long' });
    }

    const normQuery = normalizeString(query);
    const tokens = normQuery.split(/\s+/).filter(Boolean);

    // 1. Try local exact or keyword match
    let localMatches = [];
    
    // Check against SERVICE_KEYWORDS map
    if (SERVICE_KEYWORDS) {
      for (const cat of SERVICE_CATEGORIES) {
        for (const sub of cat.subServices) {
          const keywords = SERVICE_KEYWORDS[sub];
          if (!keywords) continue;

          // Merge English and Tamil keywords
          const allKeywords = [...(keywords.en || []), ...(keywords.ta || [])].map(normalizeString);
          
          let score = 0;
          
          // Exact match
          if (allKeywords.includes(normQuery) || normalizeString(sub) === normQuery) {
            score = 100;
          } else {
            // Partial token match
            let matchedTokens = 0;
            for (const token of tokens) {
              if (allKeywords.some(kw => kw.includes(token) || token.includes(kw))) {
                matchedTokens++;
              }
            }
            if (matchedTokens > 0) {
              score = Math.round((matchedTokens / tokens.length) * 100);
            }
          }

          if (score > 50) {
            localMatches.push({
              category: cat.name,
              trade: cat.trade,
              subService: sub,
              confidence: score,
            });
          }
        }
      }
    }
    
    if (localMatches.length > 0) {
      // Sort by confidence DESC, take top 3
      localMatches.sort((a, b) => b.confidence - a.confidence);
      return res.status(200).json({
        success: true,
        matches: localMatches.slice(0, 3)
      });
    }

    // 2. AI Fallback (Using Groq)
    const allowedCategories = SERVICE_CATEGORIES.map(c => ({
      category: c.name,
      trade: c.trade,
      subServices: c.subServices
    }));

    const systemPrompt = `You are a home service categorizer for SmartFix in Tamil Nadu.
The user will describe their problem in English, Tamil, or Tanglish.
Match their problem to the most relevant sub-services from the provided list.

Allowed Categories and Sub-services:
${JSON.stringify(allowedCategories, null, 2)}

Instructions:
1. Return a JSON object with a "matches" array containing up to 3 best matches.
2. If nothing is relevant, return an empty array.
3. Each match MUST have:
   - "category": The exact category name.
   - "subService": The exact sub-service name.
   - "confidence": An integer between 1 and 100.
4. Only use the EXACT names provided. Do not invent sub-services.`;

    const aiResponse = await askGroqJSON({
      system: systemPrompt,
      user: query,
      maxTokens: 500
    });

    let aiMatches = aiResponse.matches || [];
    
    // Clean and validate AI response
    aiMatches = aiMatches.filter(m => {
      const validCat = SERVICE_CATEGORIES.find(c => c.name === m.category);
      if (!validCat) return false;
      if (!validCat.subServices.includes(m.subService)) return false;
      return true;
    }).map(m => {
      const validCat = SERVICE_CATEGORIES.find(c => c.name === m.category);
      return {
        ...m,
        trade: validCat.trade
      };
    });
    
    // Sort and limit
    aiMatches.sort((a, b) => b.confidence - a.confidence);
    aiMatches = aiMatches.slice(0, 3);

    return res.status(200).json({
      success: true,
      matches: aiMatches
    });

  } catch (err) {
    console.error('Service Search Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during search' });
  }
});

module.exports = router;
