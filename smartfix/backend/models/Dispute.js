const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  raisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  raisedByRole: {
    type: String,
    enum: ['customer', 'handyman'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Open', 'UnderReview', 'Resolved', 'Rejected'],
    default: 'Open'
  },
  aiSummary: String,
  aiRecommendation: String, // 'full_refund' | 'partial_refund' | 'reassign_worker' | 'no_action' | 'needs_more_info'
  aiConfidence: Number, // 0-1
  aiReasoning: String,
  aiSummaryFailed: {
    type: Boolean,
    default: false
  },
  adminDecision: String,
  adminNotes: String,
  resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Dispute', disputeSchema);
