const Booking = require('../models/Booking');
const User = require('../models/User');
const DemandStat = require('../models/DemandStat');
const WorkerInsight = require('../models/WorkerInsight');
const { callClaudeJSON, isAiFeatureEnabled } = require('./aiService');

const COMPLETED_STATUSES = ['completed', 'paid', 'reviewed', 'Completed', 'Paid', 'Reviewed'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * 1. Aggregation Job: Computes hourly demand buckets across Tamil Nadu
 */
async function aggregateDemandStats(minRequiredBookings = 30) {
  const totalCompleted = await Booking.countDocuments({ status: { $in: COMPLETED_STATUSES } });
  if (totalCompleted < minRequiredBookings) {
    return {
      hasEnoughData: false,
      totalCompleted,
      required: minRequiredBookings,
      message: `Not enough data yet. Requires at least ${minRequiredBookings} completed platform bookings.`,
    };
  }

  const aggregates = await Booking.aggregate([
    { $match: { status: { $in: COMPLETED_STATUSES } } },
    {
      $project: {
        district: { $ifNull: ['$district', 'Sivagangai'] },
        trade: { $ifNull: ['$trade', 'General'] },
        dayOfWeek: { $subtract: [{ $dayOfWeek: '$createdAt' }, 1] }, // 0=Sunday to 6=Saturday
        hourOfDay: { $hour: '$createdAt' }, // 0 to 23
        price: { $ifNull: ['$price', 350] },
      },
    },
    {
      $group: {
        _id: {
          district: '$district',
          trade: '$trade',
          dayOfWeek: '$dayOfWeek',
          hourOfDay: '$hourOfDay',
        },
        bookingCount: { $sum: 1 },
        avgPrice: { $avg: '$price' },
      },
    },
  ]);

  for (const item of aggregates) {
    const { district, trade, dayOfWeek, hourOfDay } = item._id;
    const count = item.bookingCount;
    const avgPrice = Math.round(item.avgPrice);
    const surgeIndex = Math.min(2.5, +(1.0 + count * 0.15).toFixed(2));

    await DemandStat.findOneAndUpdate(
      { district, trade, dayOfWeek, hourOfDay },
      {
        district,
        trade,
        dayOfWeek,
        hourOfDay,
        bookingCount: count,
        avgPrice,
        surgeIndex,
      },
      { upsert: true, new: true }
    );
  }

  return {
    hasEnoughData: true,
    totalCompleted,
    aggregatedBuckets: aggregates.length,
  };
}

/**
 * 2. Generate personalized demand guidance for a worker
 */
async function generateWorkerInsights(workerId, minRequiredBookings = 30) {
  const totalCompleted = await Booking.countDocuments({ status: { $in: COMPLETED_STATUSES } });

  // Non-negotiable rule: No fake data. If < threshold completed bookings, show honest empty state
  if (totalCompleted < minRequiredBookings) {
    return {
      hasEnoughData: false,
      sampleSize: totalCompleted,
      requiredBookings: minRequiredBookings,
      message: `Demand insights unlock after ${minRequiredBookings} platform bookings across Tamil Nadu.`,
    };
  }

  const worker = await User.findById(workerId);
  if (!worker) throw new Error('Worker not found');

  const trade = worker.trade || (worker.categories && worker.categories[0]) || 'Plumbing';
  const district = worker.district || 'Sivagangai';

  // Fetch demand stats for worker's trade and district
  const stats = await DemandStat.find({ trade, district }).sort({ bookingCount: -1 }).limit(10);

  // Compute top 3 best hours
  const bestHours = (stats || []).slice(0, 3).map((s) => {
    const dayName = DAYS[s.dayOfWeek] || 'Day';
    const hour12 = s.hourOfDay === 0 ? 12 : s.hourOfDay > 12 ? s.hourOfDay - 12 : s.hourOfDay;
    const ampm = s.hourOfDay >= 12 ? 'PM' : 'AM';
    return {
      hour: s.hourOfDay,
      dayOfWeek: s.dayOfWeek,
      label: `${dayName} ${hour12}:00 ${ampm} - ${hour12 + 1}:00 ${ampm}`,
    };
  });

  // Compute hot districts for worker's trade
  const districtDemand = await DemandStat.aggregate([
    { $match: { trade } },
    { $group: { _id: '$district', total: { $sum: '$bookingCount' } } },
    { $sort: { total: -1 } },
    { $limit: 2 },
  ]);

  const hotDistricts = districtDemand.map((d) => d._id);

  let aiTips = {
    en: `Peak booking request velocity occurs during ${bestHours[0]?.label || 'morning hours'}. Going online during these windows maximizes job offers.`,
    ta: `${bestHours[0]?.label || 'காலை நேரங்களில்'} அதிக முன்பதிவு கோரிக்கைகள் வருகின்றன. இந்த நேரத்தில் ஆன்லைனில் இருப்பது அதிக வருமானத்திற்கு உதவும்.`,
  };

  const enabled = await isAiFeatureEnabled('demandInsights');
  if (enabled) {
    try {
      const system = `You are an analytics advisor for handymen in Tamil Nadu, India.
Given aggregated historical demand numbers, generate 2 concise actionable tips in English and Tamil.
Never invent numbers. Return JSON ONLY:
{
  "tipsEn": string (max 2 sentences),
  "tipsTa": string (max 2 sentences in Tamil script)
}`;

      const aiRes = await callClaudeJSON({
        feature: 'demandInsights',
        system,
        user: `Worker Trade: ${trade}\nHome District: ${district}\nTop Demand Windows: ${JSON.stringify(bestHours)}\nHot Districts: ${JSON.stringify(hotDistricts)}`,
        userId: workerId,
        schemaCheck: (obj) => obj && typeof obj.tipsEn === 'string' && typeof obj.tipsTa === 'string',
      });

      if (aiRes.ok && aiRes.data) {
        aiTips = {
          en: aiRes.data.tipsEn,
          ta: aiRes.data.tipsTa,
        };
      }
    } catch (e) {
      // Degrade gracefully to baseline tips
    }
  }

  const insightDoc = await WorkerInsight.findOneAndUpdate(
    { workerId },
    {
      workerId,
      bestHours,
      hotDistricts,
      suggestedTradeFocus: [trade],
      aiTips,
      sampleSize: totalCompleted,
      generatedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  return {
    hasEnoughData: true,
    sampleSize: totalCompleted,
    insights: {
      bestHours: insightDoc.bestHours,
      hotDistricts: insightDoc.hotDistricts,
      suggestedTradeFocus: insightDoc.suggestedTradeFocus,
      aiTips: insightDoc.aiTips,
      generatedAt: insightDoc.generatedAt,
    },
  };
}

module.exports = {
  aggregateDemandStats,
  generateWorkerInsights,
  COMPLETED_STATUSES,
};
