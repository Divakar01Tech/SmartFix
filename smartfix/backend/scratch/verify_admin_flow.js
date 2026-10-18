require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Otp = require('../models/Otp');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'muthudivakar01022006@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

async function checkAdminStatus() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    console.log('--- ADMIN FLOW DIAGNOSTIC ---');
    console.log('Configured ADMIN_EMAIL:', ADMIN_EMAIL);
    console.log('Configured ADMIN_PASSWORD_HASH:', ADMIN_PASSWORD_HASH);

    const admin = await User.findOne({ email: ADMIN_EMAIL }).select('+password');
    if (!admin) {
      console.log('❌ No admin user found in MongoDB with email:', ADMIN_EMAIL);
    } else {
      console.log('✅ Found Admin in MongoDB:');
      console.log('   ID:', admin._id);
      console.log('   Role:', admin.role);
      console.log('   Failed login attempts:', admin.failedLoginAttempts || 0);
      console.log('   Lock until:', admin.lockUntil);
      console.log('   Stored password hash:', admin.password);
      
      const testPasswords = ['admin123', 'DIVAKAR@123'];
      for (const p of testPasswords) {
        const matchesEnv = ADMIN_PASSWORD_HASH ? await bcrypt.compare(p, ADMIN_PASSWORD_HASH) : false;
        const matchesDb = admin.password ? await bcrypt.compare(p, admin.password) : false;
        console.log(`   Password "${p}": matches .env? ${matchesEnv} | matches MongoDB? ${matchesDb}`);
      }
    }

    const recentOtps = await Otp.find({ email: ADMIN_EMAIL, purpose: 'admin-login' }).sort({ createdAt: -1 }).limit(3);
    console.log('Recent Admin OTP docs in DB:', recentOtps.length);
    recentOtps.forEach(o => console.log('   OTP id:', o._id, 'expiresAt:', o.expiresAt, 'attempts:', o.attempts));

  } catch (err) {
    console.error('Diagnostic error:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('--- END DIAGNOSTIC ---');
  }
}

checkAdminStatus();
