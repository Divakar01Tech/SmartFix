/**
 * Test Suite for SmartFix (SmartFix) AI Chatbot Intent Taxonomy & Dialogue Engine
 */

const { detectLiveIntent, isTalukCovered, extractStandardEntities, TAMILNADU_TALUKS, SERVICE_CATEGORIES } = require('../services/aiIntentService');
const { processDialogueTurn, enforceTrustGating } = require('../services/aiDialogueManager');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING HANDYBOOK AI CHATBOT NLU TAXONOMY TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Test 8 Tamil Nadu Taluks Geofence Validation
  console.log('--- 1. Testing Tamil Nadu 8-Taluk Service Area Allowlist ---');
  for (const taluk of TAMILNADU_TALUKS) {
    const res = isTalukCovered(`I am in ${taluk}`);
    assert(res.isCovered && res.matchedTaluk === taluk, `Covered taluk '${taluk}' recognized correctly`);
  }
  const invalidTaluk = isTalukCovered('I live in Madurai city');
  assert(!invalidTaluk.isCovered, "Out-of-scope city 'Madurai' rejected correctly");

  // 2. Test Standard Entity Extractors
  console.log('\n--- 2. Testing Standard Entity Extraction ---');
  const entitySample = extractStandardEntities('Book tap leak repair in Karaikudi for SF-20394 phone +919876543210 rating 5 stars amount ₹250');
  assert(entitySample.service_category === 'Plumbing', "Extracted category 'Plumbing'");
  assert(entitySample.sub_service === 'Tap leak repair', "Extracted sub-service 'Tap leak repair'");
  assert(entitySample.taluk === 'Karaikudi', "Extracted taluk 'Karaikudi'");
  assert(entitySample.booking_id === 'SF-20394', "Extracted booking_id 'SF-20394'");
  assert(entitySample.phone_number === '+919876543210', "Extracted phone_number '+919876543210'");
  assert(entitySample.rating === 5, "Extracted rating 5");
  assert(entitySample.wallet_amount === 250, "Extracted wallet_amount 250");

  // 3. Test Customer Intents Taxonomy
  console.log('\n--- 3. Testing Customer Intent Taxonomy ---');
  const customerTests = [
    { text: 'Hi, hello', expected: 'GreetIntent' },
    { text: 'Is Karaikudi in your service area?', expected: 'CheckServiceArea' },
    { text: 'How much for an AC repair charge?', expected: 'AskPricing' },
    { text: 'Book a plumber for tomorrow', expected: 'BookService' },
    { text: 'Where is my booking status for SF-20394?', expected: 'CheckBookingStatus' },
    { text: 'Where is the worker now live location ETA?', expected: 'TrackWorker' },
    { text: 'Can we move it to Friday reschedule', expected: 'RescheduleBooking' },
    { text: 'Cancel my booking I don\'t need this', expected: 'CancelBooking' },
    { text: 'The worker never showed up raise complaint', expected: 'RaiseComplaint' },
    { text: 'What\'s my wallet balance?', expected: 'CheckWalletBalance' },
    { text: 'Use my wallet for this booking redeem bonus', expected: 'RedeemWalletBonus' },
    { text: '5 stars he was great rate worker', expected: 'RateWorker' },
    { text: 'I want a refund request', expected: 'RequestRefund' },
    { text: 'Tamil-la pesu switch to english', expected: 'SwitchLanguage' },
    { text: 'Talk to a real person admin', expected: 'EscalateToHuman' }
  ];

  for (const t of customerTests) {
    const res = await detectLiveIntent(t.text, [], null, 'customer');
    assert(res.intent === t.expected, `Utterance "${t.text}" mapped to intent '${res.intent}' (Expected: ${t.expected})`);
    assert(res.confidence >= 0.70, `Confidence ${res.confidence} >= 0.70 threshold`);
  }

  // 4. Test Service Provider (Worker) Intents Taxonomy
  console.log('\n--- 4. Testing Provider (Worker) Intent Taxonomy ---');
  const workerTests = [
    { text: 'Is my KYC approved?', expected: 'CheckKYCStatus' },
    { text: 'How do I submit my document Aadhaar upload ID?', expected: 'SubmitKYCDocs' },
    { text: 'Any new jobs incoming?', expected: 'CheckIncomingJobs' },
    { text: 'Accept job request', expected: 'AcceptJobRequest' },
    { text: 'Can\'t take this job decline', expected: 'DeclineJobRequest' },
    { text: 'I\'m on my way arrived completed', expected: 'UpdateJobStatus' },
    { text: 'How much did I earn this week payout?', expected: 'CheckEarnings' },
    { text: 'What\'s the commission percentage?', expected: 'AskCommissionRate' },
    { text: 'I am offline for today duty status', expected: 'UpdateAvailability' },
    { text: 'Customer address is wrong raise support ticket', expected: 'RaiseSupportTicket' }
  ];

  for (const t of workerTests) {
    const res = await detectLiveIntent(t.text, [], null, 'handyman');
    assert(res.intent === t.expected, `Worker utterance "${t.text}" mapped to '${res.intent}' (Expected: ${t.expected})`);
  }

  // 5. Test Admin Intents Taxonomy
  console.log('\n--- 5. Testing Admin Intent Taxonomy ---');
  const adminTests = [
    { text: 'Show pending KYC list queue', expected: 'QueryPendingKYC' },
    { text: 'Any SLA breaches today?', expected: 'QuerySLABreaches' },
    { text: 'Show revenue metrics total earnings', expected: 'QueryRevenueMetrics' },
    { text: 'How many active bookings right now?', expected: 'QueryActiveBookings' },
    { text: 'Set commission rate to 15%', expected: 'UpdateCommissionConfig' }
  ];

  for (const t of adminTests) {
    const res = await detectLiveIntent(t.text, [], null, 'admin');
    assert(res.intent === t.expected, `Admin utterance "${t.text}" mapped to '${res.intent}' (Expected: ${t.expected})`);
  }

  // 6. Test Trust Gating Policy
  console.log('\n--- 6. Testing Trust Gating Policy ---');
  const mockPendingBooking = { status: 'Pending', worker: { name: 'Ramesh', phone: '+919876543210', rating: 4.9 } };
  const mockPayload = { workerDetails: { name: 'Ramesh', phone: '+919876543210', rating: 4.9 } };
  const gated = enforceTrustGating(mockPendingBooking, mockPayload);
  assert(gated.workerDetails.phone === '[Withheld until Booking Confirmed]', 'Worker phone withheld for Pending booking');
  assert(gated.workerDetails.rating === '[Withheld until Booking Confirmed]', 'Worker rating withheld for Pending booking');

  const mockConfirmedBooking = { status: 'Confirmed', worker: { name: 'Ramesh', phone: '+919876543210', rating: 4.9 } };
  const mockConfirmedPayload = { workerDetails: { name: 'Ramesh', phone: '+919876543210', rating: 4.9 } };
  const ungated = enforceTrustGating(mockConfirmedBooking, mockConfirmedPayload);
  assert(ungated.workerDetails.phone === '+919876543210', 'Worker phone visible for Confirmed booking');

  // 7. Test Dialogue Auto-Escalation
  console.log('\n--- 7. Testing Dialogue Auto-Escalation ---');
  const sessionTurn1 = await processDialogueTurn('user_123', 'sess_123', 'qwertyuiop random gibberish', 'customer', { intent: 'FallbackIntent', confidence: 0.4, language: 'en' });
  assert(sessionTurn1.intentData.intent === 'FallbackIntent', 'First unrecognized input results in FallbackIntent');

  const sessionTurn2 = await processDialogueTurn('user_123', 'sess_123', 'another unrecognized input', 'customer', { intent: 'FallbackIntent', confidence: 0.4, language: 'en' });
  assert(sessionTurn2.intentData.intent === 'EscalateToHuman', '2nd consecutive FallbackIntent triggers auto-escalation to EscalateToHuman');

  console.log('\n====================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
}

runTests().catch(err => console.error('Test execution error:', err));
