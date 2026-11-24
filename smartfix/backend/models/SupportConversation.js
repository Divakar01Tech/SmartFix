const mongoose = require('mongoose');

const supportConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['customer', 'worker', 'admin'],
      default: 'customer',
    },
    messages: [
      {
        role: {
          type: String,
          enum: ['user', 'assistant', 'tool'],
          required: true,
        },
        content: { type: String, default: '' },
        toolName: { type: String },
        toolArgs: { type: mongoose.Schema.Types.Mixed },
        toolResult: { type: mongoose.Schema.Types.Mixed },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['open', 'escalated', 'resolved'],
      default: 'open',
      index: true,
    },
    escalatedAt: { type: Date },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportConversation', supportConversationSchema);
