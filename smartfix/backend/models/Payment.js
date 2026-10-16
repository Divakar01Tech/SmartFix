const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Razorpay fields
    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      sparse: true,
      index: true,
    },
    razorpaySignature: {
      type: String,
    },
    // Amount breakdown in INR
    amountTotal: {
      type: Number,
      required: true, // Final price of the booking in INR
    },
    walletUsed: {
      type: Number,
      default: 0, // Amount covered by customer's wallet balance (INR)
    },
    amountPaid: {
      type: Number,
      default: 0, // Amount actually charged via Razorpay gateway (INR)
    },
    // Amount in paise (INR × 100) for Razorpay SDK compatibility
    amount: {
      type: Number,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    // Financial splits (in INR)
    commission: {
      type: Number,
      default: 0, // Platform commission retained
    },
    workerPayout: {
      type: Number,
      default: 0, // Net earnings credited to provider
    },
    bonusCredited: {
      type: Number,
      default: 0, // Customer cashback bonus credited to wallet
    },
    // Backward compatibility aliases
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
    // Lifecycle status
    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refunded'],
      default: 'created',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'Razorpay',
    },
    receipt: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    notes: {
      type: Map,
      of: String,
    },
  },
  { timestamps: true }
);

// Pre-save hook to keep alias fields in sync
paymentSchema.pre('save', function (next) {
  if (this.amountTotal !== undefined && this.amount === undefined) {
    this.amount = Math.round(this.amountPaid * 100);
  }
  if (this.worker && !this.provider) {
    this.provider = this.worker;
  }
  if (this.provider && !this.worker) {
    this.worker = this.provider;
  }
  if (this.commission !== undefined && !this.commissionAmount) {
    this.commissionAmount = this.commission;
  }
  if (this.workerPayout !== undefined && !this.providerPayout) {
    this.providerPayout = this.workerPayout;
  }
  if (this.bonusCredited !== undefined && !this.customerCashback) {
    this.customerCashback = this.bonusCredited;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
