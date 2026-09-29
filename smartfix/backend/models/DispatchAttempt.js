const mongoose = require('mongoose');

const dispatchAttemptSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rank: { type: Number, required: true },
  score: { type: Number, required: true },
  scoreBreakdown: { type: Object, default: {} },
  status: { type: String, enum: ['Sent', 'Accepted', 'Declined', 'TimedOut'], default: 'Sent' },
  sentAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('DispatchAttempt', dispatchAttemptSchema);
