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
  status: {
    type: String,
    enum: ['available', 'pending_review', 'revoked'],
    default: 'available',
  },
  category: {
    type: String,
    enum: ['bonus', 'earnings', 'cashback', 'payout', 'refund', 'general'],
    default: 'general',
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
    reservedBalance: {
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

// Method to get spendable balance (excluding active checkout reservations)
walletSchema.methods.getSpendableBalance = function () {
  return Math.max(0, (this.balance || 0) - (this.reservedBalance || 0));
};

// Method to reserve funds during checkout
walletSchema.methods.reserve = function (amount, bookingRef, session = null) {
  const num = Math.round(Number(amount) || 0);
  if (num <= 0) return Promise.resolve(this);

  const spendable = this.getSpendableBalance();
  if (spendable < num) {
    throw new Error(`Insufficient spendable wallet balance. Available: ₹${spendable}, Requested reservation: ₹${num}`);
  }

  this.reservedBalance = (this.reservedBalance || 0) + num;
  const opts = session ? { session } : {};
  return this.save(opts);
};

// Method to release reserved funds on payment failure or expiry
walletSchema.methods.releaseReservation = function (amount, bookingRef, session = null) {
  const num = Math.round(Number(amount) || 0);
  if (num <= 0) return Promise.resolve(this);

  this.reservedBalance = Math.max(0, (this.reservedBalance || 0) - num);
  const opts = session ? { session } : {};
  return this.save(opts);
};

// Method to commit reserved funds when payment succeeds
walletSchema.methods.commitReservation = function (amount, description, bookingRef, paymentRef = null, session = null) {
  const num = Math.round(Number(amount) || 0);
  if (num <= 0) return Promise.resolve(this);

  this.reservedBalance = Math.max(0, (this.reservedBalance || 0) - num);
  this.balance = Math.max(0, (this.balance || 0) - num);
  this.totalWithdrawn = (this.totalWithdrawn || 0) + num;

  this.transactions.unshift({
    type: 'debit',
    amount: num,
    description,
    bookingRef,
    paymentRef,
    category: 'general',
    status: 'available',
    createdAt: new Date(),
  });

  const opts = session ? { session } : {};
  return this.save(opts);
};

const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);

Wallet.WalletTransaction = WalletTransaction;

module.exports = Wallet;
