const mongoose = require('mongoose');

const aiSettingsSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    default: 'DEFAULT_AI_SETTINGS',
    unique: true,
  },
  fraudDetection: { type: Boolean, default: true },
  kycCheck: { type: Boolean, default: true },
  emergencyTriage: { type: Boolean, default: true },
  chatTranslation: { type: Boolean, default: true },
  supportBot: { type: Boolean, default: true },
  voiceBooking: { type: Boolean, default: true },
  jobProofCheck: { type: Boolean, default: true },
  demandInsights: { type: Boolean, default: true },
  appliancePassport: { type: Boolean, default: true },
  upskilling: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AiSettings', aiSettingsSchema);
