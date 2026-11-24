const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AiSettings = require('../models/AiSettings');
const { parseVoiceIntent, VALID_CATEGORIES } = require('../services/voiceIntentService');
const { invalidateAiSettingsCache } = require('../services/aiService');

async function runPrompt6Test() {
  console.log('--- Testing Prompt 6: Tamil Voice Booking ---');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  // Test 1: Spoken Tamil Fan Repair Request
  console.log('\n[1] Testing Tamil spoken phrase: "ஃபேன் சுத்தல, பயங்கர சத்தம் வருது, இன்னைக்கு சாயங்காலம் வாங்க":');
  const tamilSpeech = 'ஃபேன் சுத்தல, பயங்கர சத்தம் வருது, இன்னைக்கு சாயங்காலம் வாங்க';
  const res1 = await parseVoiceIntent(tamilSpeech);
  console.log('Extracted Voice Intent 1:', res1);

  if (res1.category !== 'Electrical Repairs') {
    throw new Error(`Expected category "Electrical Repairs", got "${res1.category}"`);
  }
  if (res1.preferredTime !== 'evening') {
    throw new Error(`Expected preferredTime "evening", got "${res1.preferredTime}"`);
  }
  const todayStr = new Date().toISOString().split('T')[0];
  if (res1.preferredDate !== todayStr) {
    throw new Error(`Expected preferredDate "${todayStr}", got "${res1.preferredDate}"`);
  }
  if (!res1.missingFields.includes('address')) {
    throw new Error('Expected address to be in missingFields list');
  }
  console.log('✓ Successfully extracted category (Electrical Repairs), today date, evening time, and missing address!');

  // Test 2: Tanglish Kitchen Sink Overflow Request with Emergency Triage Hook
  console.log('\n[2] Testing Tanglish phrase: "kitchen sink overflow aagudhu sewage varudhu":');
  const tanglishSpeech = 'kitchen sink overflow aagudhu sewage varudhu';
  const res2 = await parseVoiceIntent(tanglishSpeech);
  console.log('Extracted Voice Intent 2:', res2);

  if (res2.category !== 'Plumbing') {
    throw new Error(`Expected category "Plumbing", got "${res2.category}"`);
  }
  if (!res2.urgency || (res2.urgency.level !== 'urgent' && res2.urgency.level !== 'critical')) {
    throw new Error('Expected triage urgency level to be urgent or critical');
  }
  console.log(`✓ Successfully extracted category (Plumbing) and triggered Prompt 3 Triage level (${res2.urgency.level})!`);

  // Test 3: Disabled Feature Toggle
  console.log('\n[3] Testing AI toggle disabled for voiceBooking:');
  let settings = await AiSettings.findOne({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  if (!settings) {
    settings = await AiSettings.create({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  }
  settings.voiceBooking = false;
  await settings.save();
  invalidateAiSettingsCache();

  const disabledRes = await parseVoiceIntent('AC cooling illa');
  console.log('Disabled feature result:', disabledRes);
  if (!disabledRes.aiDisabled) {
    throw new Error('Expected aiDisabled: true when toggle is false');
  }
  console.log('✓ Disabled toggle gating verified!');

  // Re-enable toggle
  settings.voiceBooking = true;
  await settings.save();
  invalidateAiSettingsCache();

  await mongoose.disconnect();
  console.log('\nPrompt 6 Test Completed Successfully! 🎉');
}

runPrompt6Test().catch((err) => {
  console.error('Prompt 6 Test Failed:', err);
  process.exit(1);
});
