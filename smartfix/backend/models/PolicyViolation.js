const mongoose = require('mongoose');

const policyViolationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['Customer', 'Worker'], required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  violationType: { type: String, enum: ['contact_sharing_attempt'], required: true },
  count: { type: Number, default: 1 },
  lastAttemptAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PolicyViolation', policyViolationSchema);
