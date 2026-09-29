const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'SYSTEM' }, // 'REMINDER', 'BOOKING', 'SYSTEM'
  isRead: { type: Boolean, default: false },
  actionData: {
    category: String,
    subService: String,
    link: String
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);
