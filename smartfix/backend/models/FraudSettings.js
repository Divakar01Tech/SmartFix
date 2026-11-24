const mongoose = require('mongoose');

const fraudSettingsSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    default: 'DEFAULT_FRAUD_SETTINGS',
    unique: true,
  },
  cancelsIn7Days: { type: Number, default: 3 },
  repeatPairIn14Days: { type: Number, default: 3 },
  minJobMinutes: { type: Number, default: 10 },
  bookingsPerHour: { type: Number, default: 4 },
  flagScore: { type: Number, default: 60 },
  holdScore: { type: Number, default: 80 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('FraudSettings', fraudSettingsSchema);
