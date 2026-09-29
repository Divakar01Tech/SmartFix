const Wallet = require('../models/Wallet');

// GET /api/wallet/me
// Returns logged-in user's wallet + transaction history
exports.getMyWallet = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;

    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({ user: userId, role: role || 'customer', balance: 0 });
    }

    res.status(200).json({ wallet });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch wallet', error: err.message });
  }
};

// GET /api/wallet/admin/all
// Returns all wallets for admin console
exports.getAllWallets = async (req, res) => {
  try {
    const wallets = await Wallet.find().populate('user', 'name phone role');
    res.status(200).json({ wallets });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch wallets', error: err.message });
  }
};

// POST /api/wallet/withdraw
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, payoutMethod, upiPhone, upiId, bankAccountName, bankAccountNumber, bankIfscCode, bankName } = req.body;
    const userId = req.user?.id;

    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({ user: userId, role: req.user?.role || 'handyman', balance: 0 });
    }

    const withdrawAmt = Number(amount) || 0;
    const desc = payoutMethod === 'UPI'
      ? `Instant Payout to Mobile/UPI: ${upiPhone || upiId}`
      : `Bank Payout to ${bankName || 'Bank'} A/c ****${String(bankAccountNumber).slice(-4)}`;

    await wallet.debit(withdrawAmt, desc);

    res.status(200).json({
      message: `Withdrawal request of ₹${withdrawAmt} processed successfully!`,
      wallet,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to process withdrawal' });
  }
};

// GET /api/wallet/settings
exports.getSettings = async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ commissionPercent: 10, customerBonusPercent: 5, maxWalletPaymentPercent: 50 });
    }
    res.status(200).json({ settings });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch settings', error: err.message });
  }
};

// PUT /api/wallet/settings (Admin)
exports.updateSettings = async (req, res) => {
  try {
    const Settings = require('../models/Settings');
    const { commissionPercent, customerBonusPercent, maxWalletPaymentPercent } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    if (typeof commissionPercent === 'number') settings.commissionPercent = commissionPercent;
    if (typeof customerBonusPercent === 'number') settings.customerBonusPercent = customerBonusPercent;
    if (typeof maxWalletPaymentPercent === 'number') settings.maxWalletPaymentPercent = maxWalletPaymentPercent;
    settings.updatedBy = req.user?.id;

    await settings.save();

    res.status(200).json({ message: 'System commission & cashback settings updated!', settings });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update settings', error: err.message });
  }
};

// POST /api/wallet/pay-with-wallet
exports.payWithWallet = async (req, res) => {
  try {
    const Booking = require('../models/Booking');
    const Settings = require('../models/Settings');
    const { bookingId, amount } = req.body;
    const userId = req.user?.id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet || wallet.balance <= 0) {
      return res.status(400).json({ message: 'No wallet balance available.' });
    }

    let settings = await Settings.findOne();
    const maxWalletPct = settings?.maxWalletPaymentPercent || 50;
    const maxDeductible = Math.round(booking.price * (maxWalletPct / 100));

    const requestedDeduct = Math.min(wallet.balance, Number(amount) || maxDeductible, maxDeductible);
    if (requestedDeduct <= 0) {
      return res.status(400).json({ message: 'Invalid wallet redemption amount.' });
    }

    await wallet.debit(requestedDeduct, `Wallet Payment for Booking #${bookingId.toString().slice(-6)}`, bookingId);

    const remainingPrice = Math.max(0, booking.price - requestedDeduct);

    if (remainingPrice === 0) {
      booking.status = 'Paid';
      booking.paymentStatus = 'Paid';
      booking.paymentMethod = 'Wallet';
      booking.paidAt = new Date();
    }

    await booking.save();

    res.status(200).json({
      message: `₹${requestedDeduct} wallet credit applied to booking #${bookingId.toString().slice(-6)}.`,
      walletBalance: wallet.balance,
      remainingPrice,
      booking,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Wallet payment failed' });
  }
};
