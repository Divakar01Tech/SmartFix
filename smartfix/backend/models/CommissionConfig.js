const mongoose = require('mongoose');

const commissionConfigSchema = new mongoose.Schema(
  {
    // Key to identify the singleton document
    key: {
      type: String,
      default: 'platform_commission',
      unique: true,
    },
    // Platform takes this % of booking price
    commissionPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 50,
    },
    // Customer gets this % of commission as cashback (e.g., 5% of 10% = 0.5% of total)
    cashbackPercent: {
      type: Number,
      default: 5,
      min: 0,
      max: 100,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommissionConfig', commissionConfigSchema);
