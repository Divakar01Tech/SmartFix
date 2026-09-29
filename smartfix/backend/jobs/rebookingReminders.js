const cron = require('node-cron');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const { ServiceInterval } = require('../models/ServiceInterval');
const Notification = require('../models/Notification');
const { callGeminiApi } = require('../services/geminiService');
const { sendCustomSms } = require('../services/smsService');

const runRebookingReminders = async (io) => {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const intervals = await ServiceInterval.find();
    if (!intervals.length) return; // No seed data yet

    // Create a map for quick lookup
    const intervalMap = {};
    intervals.forEach(i => {
      intervalMap[`${i.category}-${i.subService}`] = i.recommendedIntervalDays;
    });

    const oneDay = 24 * 60 * 60 * 1000;
    const now = new Date();

    // Find the latest completed booking for each customer and sub-service
    const latestBookings = await Booking.aggregate([
      { $match: { status: { $in: ['Completed', 'Paid'] }, lastReminderSentAt: { $exists: false } } },
      { $sort: { createdAt: -1 } },
      { $group: {
          _id: { customer: "$customer", trade: "$trade", subService: { $arrayElemAt: ["$subServices", 0] } },
          bookingId: { $first: "$_id" },
          createdAt: { $first: "$createdAt" },
      }}
    ]);

    for (let i = 0; i < latestBookings.length; i += 20) {
      const batch = latestBookings.slice(i, i + 20);
      
      await Promise.all(batch.map(async (b) => {
        const { customer, trade, subService } = b._id;
        const bookingDate = b.createdAt;
        if (!bookingDate || !subService) return;

        const recommendedDays = intervalMap[`${trade}-${subService}`];
        if (!recommendedDays) return;

        const daysPassed = Math.floor((now - new Date(bookingDate)) / oneDay);
        if (daysPassed >= recommendedDays) {
          // Time for a reminder!
          const user = await mongoose.model('User').findById(customer);
          if (!user) return;
          const lang = user.preferredLanguage === 'ta' ? 'Tamil' : 'English';

          const prompt = `Write a short, friendly 1-2 sentence reminder message to a home service customer.
They last had "${subService}" service (${trade}) ${daysPassed} days ago.
Suggest it's a good time to book again for maintenance.
No pricing, no false urgency. Language: ${lang}.`;

          const payload = [{ role: 'user', content: prompt }];
          const aiResponseText = await callGeminiApi(payload, 0.4, 150);

          let message = aiResponseText && aiResponseText.text ? aiResponseText.text.trim() : `It's been a while since your last ${subService}. Consider booking a maintenance check today!`;

          // Create in-app notification
          const notification = new Notification({
            user: customer,
            title: `Time for your next ${subService}!`,
            message: message,
            type: 'REMINDER',
            actionData: {
              category: trade,
              subService: subService,
              link: `/book?category=${encodeURIComponent(trade)}&subService=${encodeURIComponent(subService)}`
            }
          });
          await notification.save();

          // Send SMS if preferred
          // We won't block on this
          sendCustomSms(user.phone, message).catch(err => console.warn('SMS reminder failed:', err.message));

          // Mark booking as reminded
          await Booking.findByIdAndUpdate(b.bookingId, { lastReminderSentAt: now });

          if (io) {
            io.to(`user-${customer}`).emit('new-notification', notification);
          }
        }
      }));
    }
  } catch (err) {
    console.error('⚠️ Predictive Rebooking Cron error:', err.message);
  }
};

const initRebookingCron = (io) => {
  // Run once daily at 10:00 AM
  cron.schedule('0 10 * * *', () => {
    console.log('⏰ Running daily predictive rebooking sweep...');
    runRebookingReminders(io);
  });
  console.log('⏰ Predictive Rebooking Cron initialized (runs at 10 AM daily).');
};

module.exports = { initRebookingCron, runRebookingReminders };
