/**
 * Safe Migration Script: migrateUsersAuth.js
 *
 * Updates User collection to align with Email-based Authentication & Google Sign-in:
 * 1. Safely drops any unique index on `phone` (phone becomes a profile detail only).
 * 2. Normalizes `email` (trim + lowercase). Provides non-destructive fallback email for legacy phone-only users.
 * 3. Initializes `isEmailVerified`, `authProviders`, `profileCompleted`, `failedLoginAttempts`, and `lockUntil`.
 * 4. NEVER touches existing passwords or password hashes.
 *
 * Usage:
 *   node scripts/migrateUsersAuth.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';

async function migrate() {
  console.log('🔄 Connecting to MongoDB for Auth Migration...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB at:', MONGO_URI.split('@').pop());

  const db = mongoose.connection.db;
  const usersCollection = db.collection('users');

  // 1. Drop unique index on phone if present
  console.log('\n--- Step 1: Checking and Updating Phone Index ---');
  try {
    const indexes = await usersCollection.indexes();
    const phoneIndex = indexes.find((idx) => idx.key && idx.key.phone && idx.unique);
    if (phoneIndex) {
      console.log(`Found unique index '${phoneIndex.name}' on phone. Dropping it...`);
      await usersCollection.dropIndex(phoneIndex.name);
      console.log('✅ Dropped unique index on phone.');
    } else {
      console.log('ℹ️ No unique index on phone found. Phone is already non-unique.');
    }
  } catch (idxErr) {
    console.warn('Notice while inspecting indexes:', idxErr.message);
  }

  // 2. Safely inspect and update user records
  console.log('\n--- Step 2: Migrating User Records ---');
  const cursor = usersCollection.find({});
  let totalUsers = 0;
  let updatedUsers = 0;

  while (await cursor.hasNext()) {
    const user = await cursor.next();
    totalUsers++;

    const updates = {};

    // Email check & normalization
    if (user.email) {
      const normalized = user.email.toLowerCase().trim();
      if (user.email !== normalized) {
        updates.email = normalized;
      }
    } else {
      // Legacy phone-only user: assign safe placeholder email
      const cleanPhone = (user.phone || '').replace(/\D/g, '');
      const placeholderEmail = `user_${cleanPhone || user._id}@smartfix.legacy`;
      updates.email = placeholderEmail;
      updates.isEmailVerified = false;
      console.log(`Assigned placeholder email '${placeholderEmail}' to legacy user ${user._id}`);
    }

    // isEmailVerified initialization
    if (typeof user.isEmailVerified !== 'boolean') {
      updates.isEmailVerified = user.email && !user.email.endsWith('@smartfix.legacy') ? true : false;
    }

    // authProviders initialization
    if (!Array.isArray(user.authProviders) || user.authProviders.length === 0) {
      const providers = [];
      if (user.googleUid || user.googleId) {
        providers.push('google');
      }
      if (user.password) {
        providers.push('password');
      }
      if (providers.length === 0) {
        providers.push('password');
      }
      updates.authProviders = providers;
    }

    // googleId sync
    if (user.googleUid && !user.googleId) {
      updates.googleId = user.googleUid;
    }

    // profileCompleted flag
    if (typeof user.profileCompleted !== 'boolean') {
      const hasPhone = !!user.phone && !user.phone.startsWith('google_');
      const hasAddress = !!user.address;
      updates.profileCompleted = hasPhone && hasAddress;
    }

    // Security lockout fields
    if (typeof user.failedLoginAttempts !== 'number') {
      updates.failedLoginAttempts = 0;
    }
    if (user.lockUntil === undefined) {
      updates.lockUntil = null;
    }

    if (Object.keys(updates).length > 0) {
      await usersCollection.updateOne({ _id: user._id }, { $set: updates });
      updatedUsers++;
    }
  }

  console.log(`\n=========================================`);
  console.log(`🎉 Migration Completed Successfully!`);
  console.log(`Total users scanned: ${totalUsers}`);
  console.log(`Users migrated/updated: ${updatedUsers}`);
  console.log(`All passwords remained untouched.`);
  console.log(`=========================================\n`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
