const mongoose = require('mongoose');

const workerInsightSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    bestHours: [
      {
        hour: Number,
        dayOfWeek: Number,
        label: String,
      },
    ],
    hotDistricts: [{ type: String }],
    suggestedTradeFocus: [{ type: String }],
    aiTips: {
      en: { type: String, default: '' },
      ta: { type: String, default: '' },
    },
    sampleSize: {
      type: Number,
      default: 0,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // TTL 24 hours
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WorkerInsight', workerInsightSchema);
