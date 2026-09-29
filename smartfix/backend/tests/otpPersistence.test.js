const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const OtpRequest = require('../models/OtpRequest');
const otpService = require('../services/otpService');

describe('Persistent OTP Storage & Security Suite', () => {
  const testPhone = '+919876543299';
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { family: 4 });
    }
    await OtpRequest.deleteMany({ phoneNumber: testPhone });
  });

  afterAll(async () => {
    await OtpRequest.deleteMany({ phoneNumber: testPhone });
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('1. should store OTP strictly as a bcrypt hash with 5-minute TTL and no plaintext', async () => {
    await otpService.generateOtp(testPhone, 'register');
    const doc = await OtpRequest.findOne({ phoneNumber: testPhone, purpose: 'register' });

    expect(doc).toBeDefined();
    expect(doc.phoneNumber).toBe(testPhone);
    expect(doc.hashedOtp).toBeDefined();
    expect(doc.hashedOtp.startsWith('$2')).toBe(true); // bcrypt hash signature
    expect(doc.attemptCount).toBe(0);

    // Verify expiry is within ~5 minutes
    const now = Date.now();
    const expiryTime = new Date(doc.expiresAt).getTime();
    expect(expiryTime).toBeGreaterThan(now + 4 * 60 * 1000);
    expect(expiryTime).toBeLessThanOrEqual(now + 5 * 60 * 1000 + 5000);

    // Verify TTL index exists on collection
    const indexes = await OtpRequest.collection.indexes();
    const ttlIndex = indexes.find(i => i.key.expiresAt !== undefined && i.expireAfterSeconds !== undefined);
    expect(ttlIndex).toBeDefined();
    expect(ttlIndex.expireAfterSeconds).toBe(0);
  });

  it('2. should strictly reject hardcoded "123456" backdoor when it does not match the generated OTP', async () => {
    await expect(otpService.verifyOtp(testPhone, 'register', '123456')).rejects.toThrow();
  });

  it('3. should enforce brute-force lock out after 5 failed attempts', async () => {
    // 1st attempt already failed above. Perform 4 more failed attempts.
    for (let i = 2; i <= 5; i++) {
      try {
        await otpService.verifyOtp(testPhone, 'register', '000000');
      } catch (err) {
        // expected failure
      }
    }

    const doc = await OtpRequest.findOne({ phoneNumber: testPhone, purpose: 'register' });
    expect(doc.attemptCount).toBeGreaterThanOrEqual(5);

    // 6th attempt must be rejected with lockout error
    await expect(otpService.verifyOtp(testPhone, 'register', '000000')).rejects.toThrow(
      'Too many failed attempts. Please request a new OTP.'
    );
  });

  it('4. should survive server restart and verify valid OTP after reconnection', async () => {
    const restartPhone = '+919876543298';
    await OtpRequest.deleteMany({ phoneNumber: restartPhone });

    const rawCode = '839201';
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(rawCode, salt);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpRequest.create({
      phoneNumber: restartPhone,
      hashedOtp,
      purpose: 'login',
      expiresAt,
      attemptCount: 0,
      verified: false,
    });

    // Simulate process disconnect and reconnect
    await mongoose.disconnect();
    expect(mongoose.connection.readyState).toBe(0);

    await mongoose.connect(mongoUri, { family: 4 });
    expect(mongoose.connection.readyState).toBe(1);

    // Verify document persists and can be verified
    const result = await otpService.verifyOtp(restartPhone, 'login', rawCode);
    expect(result.success).toBe(true);
    expect(result.record.verified).toBe(true);

    await OtpRequest.deleteMany({ phoneNumber: restartPhone });
  });
});
