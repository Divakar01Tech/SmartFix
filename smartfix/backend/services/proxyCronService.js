const cron = require('node-cron');
const Booking = require('../models/Booking');
const { closeProxySession } = require('../utils/twilioProxy');

exports.initProxyCron = () => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

      // Find bookings with an active proxy session that were created/accepted > 48 hours ago
      // and haven't been successfully closed (e.g. maybe still in progress, or status webhook was missed)
      const staleBookings = await Booking.find({
        proxySessionSid: { $ne: null },
        acceptedAt: { $lte: fortyEightHoursAgo }
      });

      for (const booking of staleBookings) {
        await closeProxySession(booking.proxySessionSid);
        booking.proxySessionSid = null;
        await booking.save();
      }

      if (staleBookings.length > 0) {
        console.log(`🧹 ProxyCron: Force-closed ${staleBookings.length} stale Twilio Proxy sessions.`);
      }
    } catch (err) {
      console.error('Error in Twilio Proxy safety-net cron:', err.message);
    }
  });
  console.log('⏰ Proxy Safety-Net Cron Initialized');
};
