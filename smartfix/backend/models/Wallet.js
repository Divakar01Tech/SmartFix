const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  bookingRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  },
  paymentRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ['customer', 'handyman'],
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
    },
    totalEarned: {
      type: Number,
      default: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
    },
    transactions: [transactionSchema],
  },
  { timestamps: true }
);

// Method to credit wallet
walletSchema.methods.credit = function (amount, description, bookingRef, paymentRef) {
  this.balance += amount;
  this.totalEarned += amount;
  this.transactions.unshift({
    type: 'credit',
    amount,
    description,
    bookingRef,
    paymentRef,
  });
  return this.save();
};

// Method to debit wallet
walletSchema.methods.debit = function (amount, description, bookingRef) {
  if (this.balance < amount) throw new Error('Insufficient wallet balance');
  this.balance -= amount;
  this.totalWithdrawn += amount;
  this.transactions.unshift({
    type: 'debit',
    amount,
    description,
    bookingRef,
  });
  return this.save();
};

module.exports = mongoose.model('Wallet', walletSchema);
