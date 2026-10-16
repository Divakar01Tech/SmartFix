/**
 * Utility script to generate a bcrypt hash for the SmartFix Admin password.
 * Usage:
 *   node scripts/generateAdminHash.js "yourSecretAdminPassword"
 */
const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('\n❌ Error: Please provide a password to hash.');
  console.log('Usage: node scripts/generateAdminHash.js <password>\n');
  process.exit(1);
}

if (password.length < 8) {
  console.warn('\n⚠️ Warning: Admin password should be at least 8 characters long for security.');
}

(async () => {
  try {
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('\n=========================================');
    console.log('🔑 SmartFix Admin Bcrypt Password Hash');
    console.log('=========================================');
    console.log(`Generated Hash (12 rounds):\n${hash}\n`);
    console.log('Add this hash to your backend .env file:');
    console.log(`ADMIN_PASSWORD_HASH=${hash}`);
    console.log('=========================================\n');
  } catch (err) {
    console.error('Failed to generate hash:', err);
    process.exit(1);
  }
})();
