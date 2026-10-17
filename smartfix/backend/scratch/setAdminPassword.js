require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'muthudivakar01022006@gmail.com').toLowerCase().trim();
const ADMIN_PHONE = process.env.TWILIO_PHONE_NUMBER || '+917604975206';
const NEW_PASSWORD = process.argv[2] || 'admin123';

async function setAdminPassword() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);

    let admin = await User.findOne({
      $or: [
        { email: ADMIN_EMAIL },
        { phone: ADMIN_PHONE },
        { role: 'admin' },
      ],
    }).select('+password');

    if (!admin) {
      admin = new User({
        name: 'Platform Administrator',
        email: ADMIN_EMAIL,
        phone: ADMIN_PHONE,
        role: 'admin',
        password: hashedPassword,
        isEmailVerified: true,
      });
      await admin.save();
      console.log(`👑 Created new Administrator account: ${ADMIN_EMAIL}`);
    } else {
      admin.email = ADMIN_EMAIL;
      admin.role = 'admin';
      admin.password = hashedPassword;
      admin.isEmailVerified = true;
      admin.failedLoginAttempts = 0;
      admin.lockUntil = null;
      await admin.save();
      console.log(`👑 Updated Administrator password for: ${admin.email || admin.phone}`);
    }

    console.log(`🔑 Admin Password set successfully to: "${NEW_PASSWORD}"`);
  } catch (err) {
    console.error('❌ Error setting admin password:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

setAdminPassword();
