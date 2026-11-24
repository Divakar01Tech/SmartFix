const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const AiSettings = require('../models/AiSettings');
const { classify } = require('../services/triageService');
const { invalidateAiSettingsCache } = require('../services/aiService');

async function runPrompt3Test() {
  console.log('--- Testing Prompt 3: Emergency Triage ---');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  // Test 1: Critical Gas Leak detection via Stage 1 (Fast rules)
  console.log('\n[1] Testing Stage 1 Critical Gas Leak detection:');
  const gasTriage = await classify('gas cylinder smelling very strong in kitchen', 'Plumbing');
  console.log('Gas Leak Result:', gasTriage);
  if (gasTriage.level !== 'critical' || gasTriage.emergencyHelpline !== '1906' || !gasTriage.safetyTip.ta) {
    throw new Error('Gas leak triage failed to identify critical level or 1906 helpline');
  }
  console.log('✓ Gas leak triage identified critical level, helpline 1906, and Tamil safety tip!');

  // Test 2: Electrical Fire / Sparking detection (English & Tamil)
  console.log('\n[2] Testing Stage 1 Electrical Sparking / Fire detection (Tamil keyword):');
  const sparkTriage = await classify('மெயின் சுவிட்ச் தீப்பொறி பறக்கிறது உடனடி உதவி தேவை', 'Electrical Repairs');
  console.log('Sparking Result:', sparkTriage);
  if (sparkTriage.level !== 'critical' || sparkTriage.emergencyHelpline !== '112') {
    throw new Error('Sparking triage failed for Tamil keyword');
  }
  console.log('✓ Tamil keyword triage successfully classified as critical with 112 helpline!');

  // Test 3: Routine booking ("AC not cooling")
  console.log('\n[3] Testing routine non-emergency booking:');
  const routineTriage = await classify('AC is not cooling properly in master bedroom', 'AC Service and Repair');
  console.log('Routine Result:', routineTriage);
  if (routineTriage.level !== 'normal') {
    throw new Error('Routine booking incorrectly flagged as emergency');
  }
  console.log('✓ Routine booking correctly classified as normal!');

  // Test 4: Feature toggle disabling Stage 2 while Stage 1 still functions
  console.log('\n[4] Testing AI Feature toggle on/off for emergencyTriage:');
  let settings = await AiSettings.findOne({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  if (!settings) {
    settings = await AiSettings.create({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  }
  settings.emergencyTriage = false;
  await settings.save();
  invalidateAiSettingsCache();

  // Stage 1 rule must still work even when AI is disabled!
  const gasWhenDisabled = await classify('gas leak in stove connection', 'Plumbing');
  if (gasWhenDisabled.level !== 'critical') {
    throw new Error('Stage 1 rules should continue to function when emergencyTriage is disabled');
  }
  console.log('✓ Stage 1 rule verified to function even when AI toggle is off!');

  // Re-enable toggle
  settings.emergencyTriage = true;
  await settings.save();
  invalidateAiSettingsCache();

  // Test 5: Verify booking schema persists urgency
  console.log('\n[5] Testing Booking model urgency persistence:');
  const customer = await User.findOne({ role: 'customer' }) || await User.create({
    name: 'Triage Test Customer',
    email: `triage_cust_${Date.now()}@example.com`,
    phone: `+9199${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123!',
    role: 'customer',
  });

  const testBooking = await Booking.create({
    customer: customer._id,
    trade: 'Plumbing',
    address: 'Main Bazaar, Sivagangai, Tamil Nadu',
    district: 'Sivagangai',
    price: 450,
    notes: 'Severe gas cylinder smell in kitchen area',
    urgency: gasTriage,
  });

  const savedBooking = await Booking.findById(testBooking._id);
  console.log('Persisted booking urgency:', savedBooking.urgency);
  if (!savedBooking.urgency || savedBooking.urgency.level !== 'critical' || savedBooking.urgency.emergencyHelpline !== '1906') {
    throw new Error('Booking failed to persist urgency subdocument');
  }
  console.log('✓ Booking persisted urgency subdocument successfully!');

  // Cleanup
  await Booking.deleteOne({ _id: testBooking._id });
  await mongoose.disconnect();
  console.log('\nPrompt 3 Test Completed Successfully! 🎉');
}

runPrompt3Test().catch((err) => {
  console.error('Prompt 3 Test Failed:', err);
  process.exit(1);
});
