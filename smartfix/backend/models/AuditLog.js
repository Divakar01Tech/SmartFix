const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    action: {
      type: String,
      default: 'worker_review',
      index: true,
    },
    ip: String,
    details: mongoose.Schema.Types.Mixed,
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    aiVerdict: {
      type: String,
      default: 'none',
    },
    adminDecision: {
      type: String,
      required: false,
    },
    agreedWithAi: {
      type: Boolean,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
