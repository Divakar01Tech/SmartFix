const mongoose = require('mongoose');

const otpRequestSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
      alias: 'phone',
    },
    hashedOtp: {
      type: String,
      required: [true, 'Hashed OTP is required'],
      alias: 'otpHash',
    },
    purpose: {
      type: String,
      enum: ['register', 'login', 'reset_password', 'registration', 'password-reset'],
      required: [true, 'OTP purpose is required'],
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      alias: 'attempts',
    },
    verified: {
      type: Boolean,
      default: false,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Indexes:
// 1. Fast lookup by phone and purpose
otpRequestSchema.index({ phoneNumber: 1, purpose: 1 });

// 2. TTL index: MongoDB automatically removes documents when expiresAt is reached (5 minutes from generation)
otpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpRequest', otpRequestSchema);
