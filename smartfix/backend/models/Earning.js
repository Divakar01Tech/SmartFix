const mongoose = require('mongoose');

const earningSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
    },
    grossPaise: {
      type: Number,
      required: true,
    },
    commissionPaise: {
      type: Number,
      required: true,
    },
    netPaise: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending_payout', 'paid_out', 'reversed'],
      default: 'pending_payout',
      index: true,
    },
    payoutRef: {
      type: String,
      default: null,
    },
    paidOutAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Earning', earningSchema);
