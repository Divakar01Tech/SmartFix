const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    commissionPercent: {
      type: Number,
      default: 10, // Platform cut from worker payout (%)
      min: 0,
      max: 50,
    },
    customerBonusPercent: {
      type: Number,
      default: 5, // Customer cashback wallet credit (%)
      min: 0,
      max: 30,
    },
    maxWalletPaymentPercent: {
      type: Number,
      default: 50, // Max % of booking value payable via wallet balance
      min: 0,
      max: 100,
    },
    slaBreachThresholdMinutes: {
      type: Number,
      default: 60, // SLA Breach limit for confirmed jobs before EnRoute (minutes)
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
