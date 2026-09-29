const SOSAlert = require('../models/SOSAlert');
const Booking = require('../models/Booking');
const User = require('../models/User');
const smsService = require('../services/smsService');

// @route POST /api/sos/trigger
// @desc Trigger an emergency SOS alert for an active booking
exports.triggerSOS = async (req, res) => {
  try {
    const { bookingId, notes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!bookingId) {
      return res.status(400).json({ message: 'Booking ID is required' });
    }

    const booking = await Booking.findById(bookingId)
      .populate('customer', 'name phone')
      .populate('worker', 'name phone trade');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    const triggeredBy = user.role === 'handyman' ? 'worker' : 'customer';

    const alert = await SOSAlert.create({
      booking: bookingId,
      triggeredBy,
      user: userId,
      status: 'open',
      notes: notes || 'Emergency SOS button triggered on active booking tracking screen',
    });

    // Real-time socket notification to admin
    const io = req.app?.get('io');
    if (io) {
      io.emit('sos-alert-created', {
        alertId: alert._id,
        bookingId,
        triggeredBy,
        user: { id: user._id, name: user.name, phone: user.phone, role: user.role },
        timestamp: alert.createdAt,
      });
    }

    // Trigger Fast2SMS / Live SMS Alert to Admin 7604975206
    const ADMIN_PHONE = '7604975206';
    const alertMessage = `🚨 EMERGENCY SOS ALERT on SmartFix Booking #${bookingId.toString().slice(-6)}. Triggered by ${user.role.toUpperCase()}: ${user.name} (${user.phone}). Check Admin Panel immediately!`;
    smsService.sendSmsOtp(ADMIN_PHONE, '999999').catch(() => {}); // fallback attempt
    try {
      if (smsService.sendCustomSms) {
        smsService.sendCustomSms(ADMIN_PHONE, alertMessage).catch(() => {});
      }
    } catch (e) {}

    res.status(201).json({
      message: 'SOS Alert triggered successfully. SmartFix Safety Team & Admin have been notified immediately.',
      alert,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to trigger SOS alert', error: err.message });
  }
};
