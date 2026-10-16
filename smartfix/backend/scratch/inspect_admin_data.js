const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix');
  const pending = await User.find({
    role: { $in: ['worker', 'handyman'] },
    verificationStatus: { $in: ['pending_verification', 'Pending'] }
  });
  console.log('Pending workers count:', pending.length);
  pending.forEach(w => {
    console.log('-', w._id.toString(), '| Name:', w.name, '| Email:', w.email, '| Trade:', w.trade, '| Status:', w.verificationStatus);
    console.log('   KYC:', JSON.stringify(w.kyc));
    console.log('   Interview:', JSON.stringify(w.interview));
  });

  const verified = await User.find({
    role: { $in: ['worker', 'handyman'] },
    verificationStatus: { $in: ['approved', 'Verified'] }
  });
  console.log('\nVerified workers count:', verified.length);
  verified.forEach(w => {
    console.log('-', w._id.toString(), '| Name:', w.name, '| Trade:', w.trade, '| Rating:', w.rating, '| Status:', w.verificationStatus);
  });

  await mongoose.disconnect();
})();
