const User = require('../models/User');
const Booking = require('../models/Booking');

const ADMIN_PHONE = '+917604975206';

const seedDatabase = async () => {
  try {
    // Ensure authorized admin user exists
    let admin = await User.findOne({ phone: ADMIN_PHONE }).select('+password');
    if (!admin) {
      admin = await User.create({
        name: 'Platform Administrator',
        phone: ADMIN_PHONE,
        password: 'admin123',
        role: 'admin',
      });
      console.log(`👑 Created primary authorized admin user: ${ADMIN_PHONE}`);
    } else {
      admin.role = 'admin';
      admin.password = 'admin123';
      admin.currentLocation = undefined; // Clear invalid geo object
      await admin.save();
      console.log(`👑 Reset & verified primary admin user password: ${ADMIN_PHONE}`);
    }
  } catch (err) {
    console.warn('⚠️ Database setup notice:', err.message);
  }
};

module.exports = seedDatabase;
