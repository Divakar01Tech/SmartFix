require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const User = require('../models/User');
const DemandStat = require('../models/DemandStat');
const WorkerInsight = require('../models/WorkerInsight');
const AiSettings = require('../models/AiSettings');
const { aggregateDemandStats, generateWorkerInsights } = require('../services/demandInsightService');

async function runTest() {
  console.log('--- TEST PROMPT 8: Worker Demand Insights ---');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix');

  try {
    // 1. Setup a test worker
    const worker = await User.findOneAndUpdate(
      { email: 'prompt8_worker@test.com' },
      {
        name: 'Kumar Electrician',
        email: 'prompt8_worker@test.com',
        phone: '9876543210',
        role: 'worker',
        trade: 'Electrical Repairs',
        district: 'Sivagangai',
        verificationStatus: 'verified',
        currentLocation: {
          type: 'Point',
          coordinates: [78.4809, 9.8433],
        },
      },
      { upsert: true, new: true }
    );

    // Clean up test bookings and stats
    await Booking.deleteMany({ notes: 'test_prompt8_booking' });
    await DemandStat.deleteMany({ district: 'Sivagangai', trade: 'Electrical Repairs' });
    await WorkerInsight.deleteMany({ workerId: worker._id });

    // Ensure AiSettings has demandInsights enabled
    await AiSettings.findOneAndUpdate({}, { demandInsights: true }, { upsert: true });

    // CASE A: When total completed bookings < threshold (honest empty state check)
    console.log('\n[Case A] Testing when total completed bookings < required threshold...');
    const insightsA = await generateWorkerInsights(worker._id, 999999);
    console.log('Insights response (< threshold):', {
      hasEnoughData: insightsA.hasEnoughData,
      sampleSize: insightsA.sampleSize,
      requiredBookings: insightsA.requiredBookings,
    });

    if (insightsA.hasEnoughData !== false || insightsA.requiredBookings !== 999999) {
      throw new Error('Case A failed: should return hasEnoughData: false with requiredBookings');
    }
    console.log('✔ Case A Passed: Honest empty state returned without hallucinated charts.');

    // CASE B: Create 32 completed bookings to reach >= 30 threshold
    console.log('\n[Case B] Creating test completed bookings to reach >= 30...');
    const testBookings = [];
    const districts = ['Sivagangai', 'Madurai', 'Sivagangai'];
    for (let i = 0; i < 35; i++) {
      testBookings.push({
        customer: worker._id,
        worker: worker._id,
        trade: 'Electrical Repairs',
        category: 'Electrical Repairs',
        district: districts[i % districts.length],
        address: '12 Gandhi Road, Sivagangai',
        status: 'completed',
        price: 450 + (i % 5) * 50,
        createdAt: new Date(Date.now() - (i % 7) * 24 * 3600 * 1000 - (i % 4) * 3600 * 1000),
        notes: 'test_prompt8_booking',
      });
    }
    await Booking.insertMany(testBookings);

    // Run aggregation
    console.log('Running aggregateDemandStats()...');
    const aggResult = await aggregateDemandStats();
    console.log('Aggregation result:', aggResult);

    if (!aggResult.hasEnoughData || aggResult.totalCompleted < 30) {
      throw new Error('Aggregation failed to detect >= 30 completed bookings');
    }

    const demandStatsCount = await DemandStat.countDocuments({ trade: 'Electrical Repairs' });
    console.log(`DemandStat rows created for Electrical Repairs: ${demandStatsCount}`);

    // Generate worker insights
    console.log('Generating worker insights...');
    const insightsB = await generateWorkerInsights(worker._id);
    console.log('Insights response (>= 30):', {
      hasEnoughData: insightsB.hasEnoughData,
      bestHoursCount: insightsB.insights?.bestHours?.length,
      hotDistricts: insightsB.insights?.hotDistricts,
      aiTips: insightsB.insights?.aiTips,
    });

    if (!insightsB.hasEnoughData) {
      throw new Error('Case B failed: should return hasEnoughData: true');
    }
    if (!insightsB.insights?.bestHours || !insightsB.insights?.hotDistricts) {
      throw new Error('Case B failed: missing bestHours or hotDistricts');
    }
    if (!insightsB.insights?.aiTips?.en || !insightsB.insights?.aiTips?.ta) {
      throw new Error('Case B failed: missing bilingual aiTips');
    }
    console.log('✔ Case B Passed: Aggregation populated DemandStat and generated personalized bilingual insights.');

    // CASE C: Toggle demandInsights OFF and verify graceful fallback
    console.log('\n[Case C] Testing feature toggle OFF...');
    await AiSettings.findOneAndUpdate({}, { demandInsights: false });
    const insightsC = await generateWorkerInsights(worker._id);
    console.log('Insights when feature OFF:', {
      hasEnoughData: insightsC.hasEnoughData,
      aiTips: insightsC.insights?.aiTips,
    });

    if (!insightsC.insights?.aiTips?.en || !insightsC.insights?.aiTips?.ta) {
      throw new Error('Case C failed: should still provide rule-based tips when AI is toggled off');
    }
    console.log('✔ Case C Passed: Graceful rule-based bilingual tips returned when AI feature is off.');

    // Cleanup
    await Booking.deleteMany({ notes: 'test_prompt8_booking' });
    await DemandStat.deleteMany({ district: 'Sivagangai', trade: 'Electrical Repairs' });
    await WorkerInsight.deleteMany({ workerId: worker._id });
    await User.deleteOne({ _id: worker._id });
    await AiSettings.findOneAndUpdate({}, { demandInsights: true });

    console.log('\n🎉 ALL PROMPT 8 ACCEPTANCE TESTS PASSED!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
