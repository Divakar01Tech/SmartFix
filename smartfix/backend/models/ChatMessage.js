const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['Customer', 'Worker', 'System'], required: true },
  text: { type: String, required: true },
  flagged: { type: Boolean, default: false },
  flagReason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
