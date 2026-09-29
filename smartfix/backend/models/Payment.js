const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Razorpay fields
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    // Amount in paise (INR × 100)
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refunded'],
      default: 'created',
    },
    // Commission splits (in INR)
    commissionPercent: {
      type: Number,
      default: 10,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    providerPayout: {
      type: Number,
      default: 0,
    },
    cashbackPercent: {
      type: Number,
      default: 5,
    },
    customerCashback: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      default: 'Razorpay',
    },
    paidAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
