const User = require('../models/User');
const Booking = require('../models/Booking');

const ADMIN_PHONE = '+917604975206';

const seedDatabase = async () => {
  try {
    // Ensure authorized admin user exists
    let admin = await User.findOne({ phone: ADMIN_PHONE }).select('+password');
    const adminEmail = (process.env.ADMIN_EMAIL || 'muthudivakar01022006@gmail.com').toLowerCase().trim();
    if (!admin) {
      admin = await User.create({
        name: 'Platform Administrator',
        email: adminEmail,
        phone: ADMIN_PHONE,
        password: process.env.ADMIN_PASSWORD_HASH || 'DIVAKAR@123',
        role: 'admin',
        isEmailVerified: true,
      });
      console.log(`👑 Created primary authorized admin user: ${ADMIN_PHONE} (${adminEmail})`);
    } else {
      admin.role = 'admin';
      if (!admin.email) {
        admin.email = adminEmail;
      }
      if (!admin.password) {
        admin.password = process.env.ADMIN_PASSWORD_HASH || 'DIVAKAR@123';
      }
      admin.currentLocation = undefined; // Clear invalid geo object
      await admin.save();
      console.log(`👑 Verified primary admin user: ${ADMIN_PHONE} (${admin.email})`);
    }
  } catch (err) {
    console.warn('⚠️ Database setup notice:', err.message);
  }
};

module.exports = seedDatabase;
