const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      index: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    purpose: {
      type: String,
      default: 'login', // could be 'login', 'signup', 'reset_password'
    },
    otpHash: {
      type: String,
      required: [true, 'OTP hash is required'],
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index on expiresAt with expireAfterSeconds: 0 for automatic document deletion
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);
