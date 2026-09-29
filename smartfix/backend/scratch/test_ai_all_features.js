require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { diagnoseProblem } = require('../services/aiDiagnosisService');
const { matchWorkersForCategory } = require('../services/aiWorkerMatchingService');
const { callGeminiApi } = require('../services/geminiService');

async function testAllAiBackendServices() {
  console.log('--- 1. Testing AI Diagnosis Service ---');
  const diagnosis = await diagnoseProblem('My refrigerator is not cooling and water is leaking on the kitchen floor.');
  console.log('Diagnosis Result:', JSON.stringify(diagnosis, null, 2));

  console.log('\n--- 2. Testing AI Worker Matching Service ---');
  const workers = await matchWorkersForCategory('Plumbing');
  console.log('Worker Match Count:', workers.count);

  console.log('\n--- 3. Testing Multimodal Vision AI ---');
  // Small 1x1 test image base64
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const visionRes = await callGeminiApi(
    [{ role: 'user', content: 'What is visible in this test image?' }],
    0.3,
    200,
    { mimeType: 'image/png', data: testImageBase64 }
  );
  console.log('Vision AI Output:', visionRes?.text || 'No vision output');
}

testAllAiBackendServices().catch(console.error);
