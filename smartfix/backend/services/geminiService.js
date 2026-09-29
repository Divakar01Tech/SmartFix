/**
 * SmartFix Gemini LLM Integration Service
 * Provides direct access to Google Gemini models (Gemini 3.6 Flash / Gemini Flash Latest / Fallback Chain)
 * Supports Text, Vision/Multimodal Image Analysis, Voice Audio, and Structured JSON Extraction
 */

const DEFAULT_SAFETY_GUARDRAILS = `
SAFETY MANDATE:
You are an expert Home Services & Repair AI Assistant for SmartFix.
- For high-voltage electrical, short circuit, live wire, gas leaks, fire risks, or heavy plumbing bursts:
  DO NOT provide risky DIY step-by-step repair instructions that could cause electrocution, injury, or severe damage.
- Always recommend safety precautions first (e.g. "Switch off main MCB trip", "Turn off main water inlet valve").
- Recommend booking a background-checked, qualified SmartFix technician.
`;

/**
 * Formats message history and optional image/audio base64 into Gemini API payload
 */
function prepareGeminiPayload(messagesPayload, temperature = 0.4, maxTokens = 600, imageBase64 = null) {
  let systemInstructionText = DEFAULT_SAFETY_GUARDRAILS;
  const contents = [];

  for (const msg of messagesPayload) {
    if (msg.role === 'system') {
      systemInstructionText += '\n\n' + msg.content;
    } else {
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      const parts = [{ text: msg.content || '' }];

      // If user message includes image or audio base64 attachment
      if (role === 'user' && (msg.image || msg.audio)) {
        const mediaObj = msg.image || msg.audio;
        const mimeType = mediaObj.mimeType || (msg.audio ? 'audio/webm' : 'image/jpeg');
        const rawData = mediaObj.data || mediaObj;
        if (typeof rawData === 'string') {
          const cleanBase64 = rawData.replace(/^data:(image|audio|video)\/[\w\-+.]+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType,
              data: cleanBase64
            }
          });
        }
      }

      contents.push({ role, parts });
    }
  }

  // Handle single standalone image or audio passed as parameter
  if (imageBase64 && contents.length > 0) {
    const lastUserMsg = contents.find(c => c.role === 'user');
    if (lastUserMsg) {
      const mimeType = imageBase64.mimeType || (typeof imageBase64 === 'string' && imageBase64.startsWith('data:audio') ? 'audio/webm' : 'image/jpeg');
      const rawData = imageBase64.data || imageBase64;
      const cleanData = typeof rawData === 'string' ? rawData.replace(/^data:(image|audio|video)\/[\w\-+.]+;base64,/, '') : '';
      if (cleanData) {
        lastUserMsg.parts.push({
          inlineData: {
            mimeType,
            data: cleanData
          }
        });
      }
    }
  }

  if (contents.length === 0) return null;

  const payload = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    }
  };

  if (systemInstructionText) {
    payload.systemInstruction = {
      parts: [{ text: systemInstructionText }]
    };
  }

  return payload;
}

/**
 * Call Gemini API with resilient multi-model fallback chain for high-availability
 */
/**
 * Call Gemini API with resilient multi-model fallback chain and OpenRouter fallback
 */
async function callGeminiApi(messagesPayload, temperature = 0.4, maxTokens = 600, imageBase64 = null) {
  const grokApiKey = process.env.GROK_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  const payload = prepareGeminiPayload(messagesPayload, temperature, maxTokens, imageBase64);

  // 1. Try Grok (xAI) API Models if GROK_API_KEY is present
  if (grokApiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const grokMessages = messagesPayload.map((m) => {
      if (m.role === 'user' && imageBase64) {
        const rawData = imageBase64.data || imageBase64;
        const mimeType = imageBase64.mimeType || (typeof rawData === 'string' && rawData.startsWith('data:image/png') ? 'image/png' : 'image/jpeg');
        const prefix = typeof rawData === 'string' && rawData.startsWith('data:') ? '' : `data:${mimeType};base64,`;
        
        return {
          role: 'user',
          content: [
            { type: 'text', text: m.content },
            { type: 'image_url', image_url: { url: `${prefix}${rawData}` } }
          ]
        };
      }
      return m;
    });

    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${grokApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: imageBase64 ? 'grok-2-vision-1212' : 'grok-beta',
          messages: grokMessages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const candidateText = data?.choices?.[0]?.message?.content;
        if (candidateText) {
          return {
            text: candidateText,
            model: data?.model || 'grok-beta',
            provider: 'xAI Grok',
            usage: data?.usage || null,
          };
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn('Grok API Warning:', err.message);
    }
  }

  // 2. Try Google Gemini API Models if GEMINI_API_KEY is present
  if (geminiApiKey && geminiApiKey.startsWith('AIza') && payload) {
    const modelsToTry = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ];

    for (const modelName of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            return {
              text: candidateText,
              model: modelName,
              provider: 'Google Gemini LLM',
              usage: data?.usageMetadata || null,
            };
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
      }
    }
  }

  // 2. OpenRouter Fallback if Gemini fails or is unconfigured
  if (openRouterApiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const openRouterMessages = messagesPayload.map((m) => {
      if (m.role === 'system') {
        return { role: 'user', content: `[SYSTEM INSTRUCTION]\n${m.content}` };
      }
      return m;
    });

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5000',
          'X-Title': 'SmartFix AI Assistant',
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
          messages: openRouterMessages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const candidateText = data?.choices?.[0]?.message?.content;
        if (candidateText) {
          return {
            text: candidateText,
            model: data?.model || 'OpenRouter LLM',
            provider: 'OpenRouter Gateway',
            usage: data?.usage || null,
          };
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

/**
 * Call Gemini API expecting structured JSON response
 */
async function callGeminiJsonApi(prompt, systemPrompt = '', imageBase64 = null) {
  const messagesPayload = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    {
      role: 'user',
      content: `${prompt}\n\nIMPORTANT: Return ONLY strict valid JSON without markdown fences or extra text.`
    }
  ];

  const result = await callGeminiApi(messagesPayload, 0.1, 1200, imageBase64);
  if (!result || !result.text) return null;

  try {
    let raw = result.text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) raw = match[0];
    // Remove trailing commas before } or ]
    raw = raw.replace(/,\s*([\}\]])/g, '$1');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.warn('⚠️ AI JSON Parse Warning:', err.message);
    return null;
  }
}

module.exports = {
  callGeminiApi,
  callGeminiJsonApi,
};
