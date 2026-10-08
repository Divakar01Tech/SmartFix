const crypto = require('crypto');

/**
 * Custom Error for AI Service failures
 */
class AIServiceError extends Error {
  /**
   * @param {string} code - 'TIMEOUT', 'BAD_JSON', or 'UPSTREAM'
   * @param {string} message - Error description
   */
  constructor(code, message) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
  }
}

// In-memory cache: Map<hash, { data: object, expiresAt: number }>
const aiCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Helper to hash cache keys
 * @param {string} system 
 * @param {string} user 
 * @returns {string} SHA-256 hash
 */
const getCacheKey = (system, user) => {
  return crypto.createHash('sha256').update(system + user).digest('hex');
};

/**
 * Ask Groq via OpenAI compatibility API.
 * 
 * @param {Object} params
 * @param {string} params.system - System prompt
 * @param {string} params.user - User prompt
 * @param {string} [params.imageBase64] - Base64 encoded image data (without data:image/... prefix)
 * @param {string} [params.imageMediaType] - e.g., 'image/jpeg' or 'image/png'
 * @param {number} [params.maxTokens=800] - Max output tokens
 * @returns {Promise<Object>} - Parsed JSON object from Groq
 * @throws {AIServiceError}
 */
async function askGroqJSON({ system, user, imageBase64, imageMediaType, maxTokens = 800, model: modelOverride }) {
  const hasImage = !!imageBase64;
  const cacheKey = getCacheKey(system, user);

  // Check cache only if there's no image
  if (!hasImage && aiCache.has(cacheKey)) {
    const cached = aiCache.get(cacheKey);
    if (Date.now() < cached.expiresAt) {
      return cached.data;
    }
    aiCache.delete(cacheKey); // Expired
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    throw new AIServiceError('UPSTREAM', 'Groq API key is not configured.');
  }

  const makeRequest = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Add explicit JSON instruction to system prompt
    const enhancedSystem = system + "\n\nCRITICAL: Respond ONLY with valid JSON. Do not include markdown formatting or explanations.";

    const messages = [
      { role: 'system', content: enhancedSystem }
    ];

    if (hasImage) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: user },
          {
            type: 'image_url',
            image_url: {
              url: `data:${imageMediaType || 'image/jpeg'};base64,${cleanBase64}`
            }
          }
        ]
      });
    } else {
      messages.push({ role: 'user', content: user });
    }

    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelOverride || (hasImage ? 'meta-llama/llama-4-scout-17b-16e-instruct' : 'llama-3.1-8b-instant'),
          max_tokens: maxTokens,
          messages,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new AIServiceError('UPSTREAM', `Groq API error: ${res.status} - ${errText}`);
      }

      const data = await res.json();
      let textContent = data.choices?.[0]?.message?.content || '';
      
      // Strip markdown JSON fences
      textContent = textContent.replace(/```json/gi, '').replace(/```/g, '').trim();

      try {
        return JSON.parse(textContent);
      } catch (parseErr) {
        throw new AIServiceError('BAD_JSON', 'Failed to parse JSON from AI response');
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError' || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
        throw new AIServiceError('TIMEOUT', 'AI request timed out after 15s');
      }
      if (err instanceof AIServiceError) throw err;
      throw new AIServiceError('UPSTREAM', `Network error: ${err.message}`);
    }
  };

  // 1 retry on invalid JSON or network error
  try {
    const result = await makeRequest();
    if (!hasImage) {
      aiCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return result;
  } catch (err) {
    if (err.code === 'BAD_JSON' || err.code === 'TIMEOUT' || err.code === 'UPSTREAM') {
      console.warn(`[AI Service] Retrying due to: ${err.message}`);
      const retryResult = await makeRequest();
      if (!hasImage) {
        aiCache.set(cacheKey, { data: retryResult, expiresAt: Date.now() + CACHE_TTL_MS });
      }
      return retryResult;
    }
    throw err;
  }
}

const userRequestCounts = new Map();

/**
 * Express middleware to rate limit AI requests.
 * Max 10 requests per user per hour.
 * 
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const aiRateLimiter = (req, res, next) => {
  const identifier = req.user?.id || req.user?._id || req.ip;
  if (!identifier) {
    return res.status(401).json({ message: 'Unable to identify requester for rate limiting.' });
  }

  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour

  if (!userRequestCounts.has(identifier)) {
    userRequestCounts.set(identifier, []);
  }

  const timestamps = userRequestCounts.get(identifier);
  // Filter out timestamps older than 1 hour
  const validTimestamps = timestamps.filter(t => now - t < windowMs);
  
  if (validTimestamps.length >= 10) {
    return res.status(429).json({
      success: false,
      message: 'You have reached the maximum of 10 AI requests per hour. Please try again later. \n\nநீங்கள் ஒரு மணி நேரத்திற்கு 10 AI கோரிக்கைகளை மட்டுமே பயன்படுத்த முடியும். தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.'
    });
  }

  validTimestamps.push(now);
  userRequestCounts.set(identifier, validTimestamps);
  next();
};

module.exports = {
  AIServiceError,
  askGroqJSON,
  aiRateLimiter
};
