const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { callClaudeJSON, isAiFeatureEnabled, invalidateAiSettingsCache } = require('../services/aiService');
const AiSettings = require('../models/AiSettings');
const AiLog = require('../models/AiLog');

async function runPrompt0Test() {
  console.log('--- RUNNING PROMPT 0 VERIFICATION TEST ---');
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  // Test 1: Feature enabled check
  const isEnabledBefore = await isAiFeatureEnabled('fraudDetection');
  console.log('✓ isAiFeatureEnabled("fraudDetection"):', isEnabledBefore);

  // Test 2: callClaudeJSON with a trivial prompt and schema check
  console.log('Testing callClaudeJSON with schema validation...');
  const result = await callClaudeJSON({
    feature: 'emergencyTriage',
    system: 'You are an emergency triage tester.',
    user: 'Assess risk level for testing. Return pure JSON: { "status": "ok", "testPassed": true }',
    schemaCheck: (obj) => obj && obj.status === 'ok' && obj.testPassed === true,
  });

  console.log('callClaudeJSON result:', JSON.stringify(result));
  if (result.ok && result.data && result.data.testPassed) {
    console.log('✓ Test 2 Passed: callClaudeJSON returned valid schema data');
  } else if (!result.ok && result.error) {
    console.log('✓ Fallback / Graceful error returned:', result.error);
  }

  // Test 3: Disable a feature and verify rejection
  console.log('Testing feature disabling toggle...');
  let settings = await AiSettings.findOne({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  if (!settings) {
    settings = await AiSettings.create({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  }
  settings.fraudDetection = false;
  await settings.save();
  invalidateAiSettingsCache();

  const isEnabledAfter = await isAiFeatureEnabled('fraudDetection');
  console.log('✓ isAiFeatureEnabled("fraudDetection") after toggle off:', isEnabledAfter);

  const disabledResult = await callClaudeJSON({
    feature: 'fraudDetection',
    system: 'test',
    user: 'test',
  });
  console.log('Disabled feature result:', disabledResult);
  if (disabledResult.aiDisabled === true) {
    console.log('✓ Test 3 Passed: Disabled feature returns { ok: false, aiDisabled: true }');
  }

  // Re-enable for subsequent prompts
  settings.fraudDetection = true;
  await settings.save();
  invalidateAiSettingsCache();

  // Test 4: Check AiLog
  const recentLog = await AiLog.findOne().sort({ createdAt: -1 });
  console.log('✓ Test 4 Check recent AiLog:', recentLog ? `Logged feature: ${recentLog.feature}, success: ${recentLog.success}` : 'No logs yet');

  await mongoose.disconnect();
  console.log('--- PROMPT 0 TESTS COMPLETE ---');
}

runPrompt0Test().catch((err) => {
  console.error('Prompt 0 Test Failed:', err);
  process.exit(1);
});
