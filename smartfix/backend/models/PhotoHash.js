const mongoose = require('mongoose');

const photoHashSchema = new mongoose.Schema(
  {
    sha256: {
      type: String,
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    kind: {
      type: String,
      enum: ['before', 'after'],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PhotoHash', photoHashSchema);
