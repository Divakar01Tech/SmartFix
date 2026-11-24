const mongoose = require('mongoose');

const demandStatSchema = new mongoose.Schema(
  {
    district: {
      type: String,
      required: true,
      index: true,
    },
    trade: {
      type: String,
      required: true,
      index: true,
    },
    hourOfDay: {
      type: Number,
      min: 0,
      max: 23,
      required: true,
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      required: true,
    },
    bookingCount: {
      type: Number,
      default: 0,
    },
    avgPrice: {
      type: Number,
      default: 0,
    },
    surgeIndex: {
      type: Number,
      default: 1.0,
      min: 1.0,
      max: 2.5,
    },
    windowStart: { type: Date },
    windowEnd: { type: Date },
  },
  { timestamps: true }
);

demandStatSchema.index({ district: 1, trade: 1, dayOfWeek: 1, hourOfDay: 1 }, { unique: true });

module.exports = mongoose.model('DemandStat', demandStatSchema);
