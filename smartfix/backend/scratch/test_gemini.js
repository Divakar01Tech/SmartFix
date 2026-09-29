require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;

async function callGeminiApi(messagesPayload, temperature = 0.4, maxTokens = 500) {
  if (!apiKey) return null;
  
  let systemInstructionText = '';
  const contents = [];

  for (const msg of messagesPayload) {
    if (msg.role === 'system') {
      systemInstructionText += (systemInstructionText ? '\n\n' : '') + msg.content;
    } else {
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: msg.content }]
      });
    }
  }

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

  const modelsToTry = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];

  for (const modelName of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText) {
          return { text: candidateText, model: modelName };
        }
      } else {
        const errText = await res.text();
        console.log(`Model ${modelName} returned status ${res.status}:`, errText);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`Gemini API call (${modelName}) warning:`, err.message);
    }
  }

  return null;
}

async function runTest() {
  const testMessages = [
    { role: 'system', content: 'You are SmartFix AI assistant for home services in Tamil Nadu.' },
    { role: 'user', content: 'My kitchen sink tap is leaking. What is the estimated repair cost in Sivagangai?' }
  ];

  console.log('Sending query to Gemini API...');
  const result = await callGeminiApi(testMessages);
  console.log('\n--- RESULT ---');
  console.log('Model used:', result?.model);
  console.log('Response:', result?.text);
}

runTest();
