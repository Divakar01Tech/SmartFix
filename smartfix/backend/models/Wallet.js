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

const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', transactionSchema);

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['customer', 'handyman', 'worker'],
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

// Method to credit wallet (supports optional mongoose session for transactions)
walletSchema.methods.credit = function (amount, description, bookingRef, paymentRef, session = null) {
  const num = Math.round(Number(amount) || 0);
  if (num <= 0) return Promise.resolve(this);

  this.balance += num;
  this.totalEarned += num;
  this.transactions.unshift({
    type: 'credit',
    amount: num,
    description,
    bookingRef,
    paymentRef,
    createdAt: new Date(),
  });

  const opts = session ? { session } : {};
  return this.save(opts);
};

// Method to debit wallet (supports optional mongoose session for transactions)
walletSchema.methods.debit = function (amount, description, bookingRef, paymentRef = null, session = null) {
  const num = Math.round(Number(amount) || 0);
  if (num <= 0) return Promise.resolve(this);

  if (this.balance < num) {
    throw new Error(`Insufficient wallet balance. Available: ₹${this.balance}, Required: ₹${num}`);
  }

  this.balance -= num;
  this.totalWithdrawn += num;
  this.transactions.unshift({
    type: 'debit',
    amount: num,
    description,
    bookingRef,
    paymentRef,
    createdAt: new Date(),
  });

  const opts = session ? { session } : {};
  return this.save(opts);
};

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);

Wallet.WalletTransaction = WalletTransaction;

module.exports = Wallet;
