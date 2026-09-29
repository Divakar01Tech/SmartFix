const mongoose = require('mongoose');

const ReviewFlagSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  signals: [{ type: String }],
  riskScore: { type: Number, default: 0 },
  aiAssessment: { type: String },
  status: { type: String, enum: ['Open', 'Dismissed', 'Removed'], default: 'Open' },
  adminNotes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ReviewFlag', ReviewFlagSchema);
