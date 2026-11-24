const mongoose = require('mongoose');

const fraudFlagSchema = new mongoose.Schema({
  subjectUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  relatedUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null,
  },
  type: {
    type: String,
    enum: [
      'cancel_farming',
      'linked_accounts',
      'self_booking',
      'repeat_pair',
      'instant_complete',
      'velocity',
      'proof_reuse',
      'multiple_signals',
    ],
    required: true,
    index: true,
  },
  score: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
  },
  signals: [{
    code: { type: String, required: true },
    detail: { type: String, required: true },
    weight: { type: Number, required: true },
  }],
  aiExplanation: {
    summary: { type: String, default: '' },
    likelyBenign: { type: Boolean, default: false },
    suggestedAdminChecks: [{ type: String }],
  },
  status: {
    type: String,
    enum: ['open', 'cleared', 'confirmed'],
    default: 'open',
    index: true,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  adminNote: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('FraudFlag', fraudFlagSchema);
