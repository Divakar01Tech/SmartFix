const mongoose = require('mongoose');

const WaitlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  districtId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  }
}, { timestamps: true });

WaitlistSchema.index({ userId: 1, districtId: 1 }, { unique: true });

module.exports = mongoose.model('Waitlist', WaitlistSchema);
