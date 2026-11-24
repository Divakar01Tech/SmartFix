require('dotenv').config();
const mongoose = require('mongoose');
const Appliance = require('../models/Appliance');
const Booking = require('../models/Booking');
const User = require('../models/User');
const AiSettings = require('../models/AiSettings');
const {
  extractApplianceFromImage,
  syncBookingToAppliance,
  getExpiringAppliances,
  normalizeCategory,
} = require('../services/applianceService');

async function runTest() {
  console.log('--- TEST PROMPT 9: Appliance Passport ---');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix');

  try {
    // 1. Setup test users: Customer and Worker
    const customer = await User.findOneAndUpdate(
      { email: 'prompt9_customer@test.com' },
      {
        name: 'Arun Customer',
        email: 'prompt9_customer@test.com',
        phone: '9840112233',
        role: 'customer',
        currentLocation: { type: 'Point', coordinates: [78.4809, 9.8433] },
      },
      { upsert: true, new: true }
    );

    const worker = await User.findOneAndUpdate(
      { email: 'prompt9_worker@test.com' },
      {
        name: 'Ravi AC Expert',
        email: 'prompt9_worker@test.com',
        phone: '9840998877',
        role: 'worker',
        trade: 'AC Repair',
        currentLocation: { type: 'Point', coordinates: [78.4809, 9.8433] },
      },
      { upsert: true, new: true }
    );

    // Clean up past test appliances & bookings
    await Appliance.deleteMany({ user: customer._id });
    await Booking.deleteMany({ notes: 'test_prompt9_booking' });

    // Enable appliancePassport in AiSettings
    await AiSettings.findOneAndUpdate({}, { appliancePassport: true }, { upsert: true });

    // CASE 1: Category Normalization & QR Code Auto-Generation
    console.log('\n[Case 1] Testing Category Normalization & QR Code Generation...');
    if (normalizeCategory('Inverter Split AC 1.5T') !== 'Air Conditioner') {
      throw new Error('normalizeCategory failed for AC');
    }
    if (normalizeCategory('Fully Automatic Washing Machine') !== 'Washing Machine') {
      throw new Error('normalizeCategory failed for Washing Machine');
    }

    const appliance = await Appliance.create({
      user: customer._id,
      category: 'Air Conditioner',
      brand: 'Daikin',
      modelNumber: 'FTKF50TV16U',
      serialNumber: 'SN-DKN-9021',
      capacityOrSpecs: '1.5 Ton 5 Star Inverter',
      installDate: new Date('2023-04-10'),
      warrantyExpiry: new Date(Date.now() + 15 * 24 * 3600 * 1000), // Expiring in 15 days
    });

    console.log('Created Appliance Passport:', {
      id: appliance._id,
      qrCodeId: appliance.qrCodeId,
      category: appliance.category,
      brand: appliance.brand,
    });

    if (!appliance.qrCodeId || !appliance.qrCodeId.startsWith('SF-APP-')) {
      throw new Error('Case 1 failed: qrCodeId was not auto-generated with SF-APP- prefix');
    }
    console.log('✔ Case 1 Passed: Appliance created with unique SF-APP- QR identifier.');

    // CASE 2: Proactive Warranty Expiry Query
    console.log('\n[Case 2] Testing Proactive Warranty Expiry Query...');
    const expiringList = await getExpiringAppliances(customer._id, 30);
    console.log(`Found ${expiringList.length} appliances expiring within 30 days.`);
    if (expiringList.length === 0 || expiringList[0]._id.toString() !== appliance._id.toString()) {
      throw new Error('Case 2 failed: Expiring appliance was not detected by getExpiringAppliances');
    }
    console.log('✔ Case 2 Passed: Warranty expiring within 15 days correctly detected.');

    // CASE 3: Booking Completion & Service History Sync
    console.log('\n[Case 3] Testing Booking Lifecycle & Service History Sync...');
    const booking = await Booking.create({
      customer: customer._id,
      worker: worker._id,
      trade: 'AC Repair',
      category: 'AC Repair',
      district: 'Sivagangai',
      address: '45 Gandhi Road, Sivagangai',
      appliance: appliance._id,
      price: 650,
      status: 'completed',
      notes: 'test_prompt9_booking',
    });

    // Sync booking to appliance passport
    await syncBookingToAppliance(booking._id);

    const refreshedAppliance = await Appliance.findById(appliance._id);
    console.log('Refreshed Appliance Service History:', refreshedAppliance.serviceHistory);

    if (refreshedAppliance.serviceHistory.length !== 1) {
      throw new Error('Case 3 failed: Service history was not updated with completed booking');
    }
    const historyItem = refreshedAppliance.serviceHistory[0];
    if (historyItem.bookingId.toString() !== booking._id.toString() || historyItem.cost !== 650) {
      throw new Error('Case 3 failed: Incorrect history item details');
    }
    console.log('✔ Case 3 Passed: Completed booking automatically synced to appliance maintenance passport.');

    // CASE 4: AI Extraction Graceful Degradation when Feature Toggled OFF
    console.log('\n[Case 4] Testing AI Feature Toggle OFF...');
    await AiSettings.findOneAndUpdate({}, { appliancePassport: false });

    // Dummy 1x1 image buffer
    const dummyBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    const extractRes = await extractApplianceFromImage({
      imageBuffer: dummyBuffer,
      mimeType: 'image/gif',
      userId: customer._id,
    });
    console.log('Extract response when feature disabled:', extractRes);

    if (!extractRes.aiDisabled) {
      throw new Error('Case 4 failed: extractApplianceFromImage did not respect aiDisabled: true');
    }
    console.log('✔ Case 4 Passed: Graceful degradation when AI appliancePassport is toggled off.');

    // Cleanup
    await Appliance.deleteMany({ user: customer._id });
    await Booking.deleteMany({ notes: 'test_prompt9_booking' });
    await User.deleteMany({ _id: { $in: [customer._id, worker._id] } });
    await AiSettings.findOneAndUpdate({}, { appliancePassport: true });

    console.log('\n🎉 ALL PROMPT 9 ACCEPTANCE TESTS PASSED!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
