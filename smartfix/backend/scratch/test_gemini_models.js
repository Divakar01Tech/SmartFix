const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testParallelModels() {
  const apiKey = process.env.GEMINI_API_KEY;

  const modelsToTest = [
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-pro-latest',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
  ];

  const results = await Promise.all(modelsToTest.map(async (m) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'OK' }] }]
        })
      });
      const text = await res.text();
      return { model: m, status: res.status, text: text.substring(0, 100) };
    } catch (e) {
      return { model: m, status: 'EXC', text: e.message };
    }
  }));

  console.log('\n--- MODEL TEST RESULTS ---');
  results.forEach(r => {
    console.log(`[${r.model}] => Status: ${r.status} ${r.status === 200 ? '✅ SUCCESS' : '❌ FAILED (' + r.text.trim() + ')'}`);
  });
}

testParallelModels();
