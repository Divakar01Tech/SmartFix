// SmartFix Live Intent Engine Test Suite
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { detectLiveIntent } = require('../services/aiIntentService');

async function testLiveIntents() {
  console.log('========================================================');
  console.log('🚀 Running SmartFix Live Intent Classifier Test Suite');
  console.log('========================================================\n');

  const testPrompts = [
    { title: '1. Electrical Safety Emergency', query: 'My main switchboard is sparking and MCB tripped with a loud pop sound!' },
    { title: '2. Service Booking Request', query: 'I want to book an experienced plumber to fix my bathroom pipe leak tomorrow.' },
    { title: '3. Cost & Rate Estimate', query: 'How much does AC gas refilling R32 cost in Tamil Nadu?' },
    { title: '4. Technician Lookup', query: 'Find available top-rated electricians near me.' },
    { title: '5. Booking Status Track', query: 'Where is the handyman I booked? Has he arrived yet?' },
    { title: '6. Tamil Regional Query', query: 'Vanakkam, kitchen tap tanni leak aagudhu, yaravadhu plumber irukangala?' },
    { title: '7. Water Burst Emergency', query: 'Overhead tank pipe burst! Water flooding kitchen floor rapidly!' },
    { title: '8. General Platform FAQ', query: 'Do you offer a 30-day warranty on washing machine repairs?' },
  ];

  for (const item of testPrompts) {
    console.log(`📌 ${item.title}`);
    console.log(`   User Query: "${item.query}"`);
    const intentData = await detectLiveIntent(item.query);
    console.log(`   Intent Detected: ${intentData.intent} (${intentData.label})`);
    console.log(`   Confidence: ${intentData.confidence} | Safety Risk: ${intentData.isSafetyRisk ? '🚨 YES' : 'NO'}`);
    console.log(`   Extracted Trade: ${intentData.entities?.trade || 'None'} | Urgency: ${intentData.entities?.urgency || 'Normal'}`);
    console.log(`   Action Chips: [${(intentData.suggestedActions || []).map(a => a.label).join(' | ')}]`);
    console.log('--------------------------------------------------------\n');
  }

  console.log('========================================================');
  console.log('✅ All 8 Live Intent Tests Completed!');
  console.log('========================================================');
}

testLiveIntents().catch(err => {
  console.error('❌ Intent Test Error:', err);
  process.exit(1);
});
