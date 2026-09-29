const mongoose = require('mongoose');

const workerLocationSchema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: false,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    heading: {
      type: Number,
      default: 0,
    },
    speed: {
      type: Number,
      default: 0,
    },
    batteryLevel: {
      type: Number,
      default: 100,
    },
  },
  { timestamps: true }
);

// Index for fast geospatial / time-series query
workerLocationSchema.index({ worker: 1, createdAt: -1 });
workerLocationSchema.index({ booking: 1, createdAt: -1 });

module.exports = mongoose.model('WorkerLocation', workerLocationSchema);
