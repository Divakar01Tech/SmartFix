const mongoose = require('mongoose');

const aiLogSchema = new mongoose.Schema({
  feature: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  success: {
    type: Boolean,
    required: true,
  },
  latencyMs: {
    type: Number,
    default: 0,
  },
  inputTokens: {
    type: Number,
    default: 0,
  },
  outputTokens: {
    type: Number,
    default: 0,
  },
  errorCode: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 90 * 24 * 60 * 60, // 90-day TTL auto-cleanup
  },
});

module.exports = mongoose.model('AiLog', aiLogSchema);
