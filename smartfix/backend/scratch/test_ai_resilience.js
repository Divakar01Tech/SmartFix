const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { callGeminiApi, callGeminiJsonApi } = require('../services/geminiService');
const { diagnoseProblem } = require('../services/aiDiagnosisService');

async function testAiResilience() {
  console.log('========================================================');
  console.log('🚀 Testing SmartFix Resilient AI Gemini Integration');
  console.log('========================================================\n');

  console.log('1. Testing Conversational Chat Query (callGeminiApi):');
  const chatMessages = [
    { role: 'user', content: 'My kitchen tap is leaking water continuously. What is the estimated cost in Tamil Nadu?' }
  ];
  const chatRes = await callGeminiApi(chatMessages, 0.4, 400);
  if (chatRes && chatRes.text) {
    console.log(`✅ Success via model [${chatRes.model}]!`);
    console.log('Response sample:\n', chatRes.text.substring(0, 250) + '...\n');
  } else {
    console.log('⚠️ Chat fallback triggered.');
  }

  console.log('2. Testing Structured JSON Diagnosis (diagnoseProblem):');
  const diagRes = await diagnoseProblem('AC is blowing warm air and making a loud clicking sound');
  console.log('✅ Structured JSON Output:');
  console.log(JSON.stringify(diagRes, null, 2));
  console.log('');

  console.log('========================================================');
  console.log('✅ Resilient Gemini Model Test Completed!');
  console.log('========================================================');
}

testAiResilience().catch(err => {
  console.error('❌ AI Test Error:', err);
  process.exit(1);
});
