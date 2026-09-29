const User = require('../models/User');
const InterviewSession = require('../models/InterviewSession');

const GROK_API_KEY = process.env.GROK_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || '';

async function callAnthropicLlm(messagesPayload, temperature = 0.4, maxTokens = 600) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  const llmMessages = messagesPayload.map((m) => {
    // Grok supports system natively, but to be safe for openrouter fallback, we can keep the mapping if not Grok
    return m;
  });

  try {
    let url = 'https://openrouter.ai/api/v1/chat/completions';
    let apiKey = OPENROUTER_API_KEY;
    let model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

    if (GROK_API_KEY) {
      url = 'https://api.x.ai/v1/chat/completions';
      apiKey = GROK_API_KEY;
      model = 'grok-beta';
    } else {
      llmMessages.forEach(m => {
        if (m.role === 'system') {
          m.role = 'user';
          m.content = `[SYSTEM INSTRUCTION]\n${m.content}`;
        }
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: llmMessages,
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
    console.warn('⚠️ Bio Generation AI call warning:', err.message);
    return null;
  }
}

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

    const payload = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Worker Category: ${worker.trade || session.category}
Sub-services: ${(worker.subServices || []).join(', ')}
Strongest Interview Answers:
${bestQnA}` }
    ];

    const resultText = await callAnthropicLlm(payload, 0.4, 600);
    if (resultText) {
      let cleanedJson = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
      // attempt to match a json object
      const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleanedJson = jsonMatch[0];

      const parsed = JSON.parse(cleanedJson);
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
