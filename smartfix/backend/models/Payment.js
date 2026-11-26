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
      unique: true,
      sparse: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    razorpaySignature: {
      type: String,
    },
    // Payment method
    method: {
      type: String,
      enum: ['razorpay', 'cod', 'wallet'],
      default: 'razorpay',
    },

    // Integer paise calculations (MANDATORY standard)
    amountTotalPaise: {
      type: Number,
      required: true,
    },
    walletUsedPaise: {
      type: Number,
      default: 0,
    },
    amountPayablePaise: {
      type: Number,
      default: 0,
    },
    commissionPaise: {
      type: Number,
      default: 0,
    },
    workerPayoutPaise: {
      type: Number,
      default: 0,
    },
    bonusPaise: {
      type: Number,
      default: 0,
    },

    // Rates snapshot at time of order creation (stops historical rewriting)
    commissionPercentSnapshot: {
      type: Number,
      default: 10,
    },
    bonusPercentSnapshot: {
      type: Number,
    },

    // Amount breakdown in INR (kept in sync for backward compatibility)
    amountTotal: {
      type: Number,
      required: true,
    },
    walletUsed: {
      type: Number,
      default: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    commission: {
      type: Number,
      default: 0,
    },
    workerPayout: {
      type: Number,
      default: 0,
    },
    bonusCredited: {
      type: Number,
      default: 0,
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
      enum: ['created', 'paid', 'failed', 'refunded', 'partially_refunded'],
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
    orderExpiresAt: {
      type: Date,
    },
    notes: {
      type: Map,
      of: String,
    },

    // Admin Refunds Array
    refunds: [
      {
        refundId: { type: String },
        amountPaise: { type: Number, required: true },
        amountInr: { type: Number },
        reason: { type: String, default: '' },
        status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'processed' },
        initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Pre-save hook: keeps paise and INR representations in sync
paymentSchema.pre('save', function (next) {
  if (this.amountTotalPaise !== undefined) {
    this.amountTotal = Math.round(this.amountTotalPaise / 100);
  } else if (this.amountTotal !== undefined) {
    this.amountTotalPaise = Math.round(this.amountTotal * 100);
  }

  if (this.walletUsedPaise !== undefined) {
    this.walletUsed = Math.round(this.walletUsedPaise / 100);
  } else if (this.walletUsed !== undefined) {
    this.walletUsedPaise = Math.round(this.walletUsed * 100);
  }

  if (this.amountPayablePaise !== undefined) {
    this.amountPaid = Math.round(this.amountPayablePaise / 100);
    this.amount = this.amountPayablePaise;
  } else if (this.amountPaid !== undefined) {
    this.amountPayablePaise = Math.round(this.amountPaid * 100);
    this.amount = this.amountPayablePaise;
  }

  if (this.commissionPaise !== undefined) {
    this.commission = Math.round(this.commissionPaise / 100);
    this.commissionAmount = this.commission;
  }

  if (this.workerPayoutPaise !== undefined) {
    this.workerPayout = Math.round(this.workerPayoutPaise / 100);
    this.providerPayout = this.workerPayout;
  }

  if (this.bonusPaise !== undefined) {
    this.bonusCredited = Math.round(this.bonusPaise / 100);
    this.customerCashback = this.bonusCredited;
  }

  if (this.worker && !this.provider) {
    this.provider = this.worker;
  }
  if (this.provider && !this.worker) {
    this.worker = this.provider;
  }

  next();
});

module.exports = mongoose.model('Payment', paymentSchema);
