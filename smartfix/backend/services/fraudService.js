const FraudFlag = require('../models/FraudFlag');
const FraudSettings = require('../models/FraudSettings');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { callClaudeJSON, isAiFeatureEnabled } = require('./aiService');

/**
 * Fetch or initialize singleton fraud settings
 */
async function getFraudSettings() {
  try {
    let settings = await FraudSettings.findOne({ singletonKey: 'DEFAULT_FRAUD_SETTINGS' });
    if (!settings) {
      settings = await FraudSettings.create({ singletonKey: 'DEFAULT_FRAUD_SETTINGS' });
    }
    return settings;
  } catch (err) {
    return {
      cancelsIn7Days: 3,
      repeatPairIn14Days: 3,
      minJobMinutes: 10,
      bookingsPerHour: 4,
      flagScore: 60,
      holdScore: 80,
    };
  }
}

/**
 * Normalizes text string for address matching
 */
function normalizeAddress(addr) {
  if (!addr) return '';
  return String(addr).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Record IP and device ID for a user request
 */
async function recordUserDeviceAndIp(userId, ip, deviceId) {
  if (!userId) return;
  try {
    const updateOps = {};
    if (ip) {
      updateOps.$addToSet = { ...(updateOps.$addToSet || {}), lastKnownIps: ip };
    }
    if (deviceId) {
      updateOps.$addToSet = { ...(updateOps.$addToSet || {}), deviceIds: deviceId };
    }
    if (Object.keys(updateOps).length > 0) {
      await User.findByIdAndUpdate(userId, updateOps);
    }
  } catch (err) {
    // Non-blocking telemetry
  }
}

/**
 * Rule Evaluation Engine
 */
async function evaluate({ bookingId = null, userId = null, customSignals = [] }) {
  const settings = await getFraudSettings();
  let booking = null;
  let targetUserId = userId;

  if (bookingId) {
    booking = await Booking.findById(bookingId).populate('customer').populate('worker');
    if (booking && !targetUserId) {
      targetUserId = booking.customer?._id || booking.customer;
    }
  }

  if (!targetUserId) return null;

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) return null;

  const signals = [];
  if (Array.isArray(customSignals) && customSignals.length > 0) {
    signals.push(...customSignals);
  }
  const relatedUserIds = [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // 1. Cancel Farming Signal
  try {
    const cancelsCount = await Booking.countDocuments({
      customer: targetUserId,
      status: { $in: ['Cancelled', 'cancelled'] },
      createdAt: { $gte: sevenDaysAgo },
    });

    const userWallet = await Wallet.findOne({ user: targetUserId });
    const hasBonus = userWallet?.transactions?.some((t) => t.category === 'bonus' || t.description?.toLowerCase().includes('bonus') || t.description?.toLowerCase().includes('cashback'));

    if (cancelsCount >= settings.cancelsIn7Days && hasBonus) {
      signals.push({
        code: 'cancel_farming',
        detail: `Customer cancelled ${cancelsCount} bookings in last 7 days after receiving wallet bonus credits.`,
        weight: 40,
      });
    }
  } catch (err) {}

  // 2. Velocity Signal (> bookingsPerHour in 1 hr)
  try {
    const recentVelocityCount = await Booking.countDocuments({
      customer: targetUserId,
      createdAt: { $gte: oneHourAgo },
    });
    if (recentVelocityCount > settings.bookingsPerHour) {
      signals.push({
        code: 'velocity',
        detail: `Customer generated ${recentVelocityCount} bookings in the past 60 minutes (Threshold: ${settings.bookingsPerHour}/hr).`,
        weight: 40,
      });
    }
  } catch (err) {}

  // 3. Self-Booking & Linked Accounts Checks (if booking present with worker)
  if (booking && booking.worker && booking.customer) {
    const customer = booking.customer;
    const worker = booking.worker;

    // Check shared Device IDs
    const sharedDevices = (customer.deviceIds || []).filter((d) => (worker.deviceIds || []).includes(d));
    if (sharedDevices.length > 0) {
      signals.push({
        code: 'self_booking',
        detail: `Customer and assigned Worker share the same hardware device identifier (${sharedDevices[0]}).`,
        weight: 70,
      });
      relatedUserIds.push(worker._id || worker);
    }

    // Check shared IP addresses
    const sharedIps = (customer.lastKnownIps || []).filter((ip) => (worker.lastKnownIps || []).includes(ip));
    if (sharedIps.length > 0) {
      signals.push({
        code: 'linked_accounts',
        detail: `Customer and Worker logged in from the same network IP address (${sharedIps[0]}).`,
        weight: 50,
      });
      if (!relatedUserIds.includes(worker._id || worker)) {
        relatedUserIds.push(worker._id || worker);
      }
    }

    // Check normalized address match between customer & worker
    const custAddrNorm = normalizeAddress(customer.address);
    const workerAddrNorm = normalizeAddress(worker.address);
    if (custAddrNorm && workerAddrNorm && custAddrNorm === workerAddrNorm) {
      signals.push({
        code: 'self_booking',
        detail: 'Customer and Worker share identical residential address strings.',
        weight: 60,
      });
    }

    // 4. Repeat Pair Check (>= threshold in 14 days)
    try {
      const pairCount = await Booking.countDocuments({
        customer: customer._id || customer,
        worker: worker._id || worker,
        status: { $in: ['Completed', 'completed', 'WorkCompleted'] },
        createdAt: { $gte: fourteenDaysAgo },
      });
      if (pairCount >= settings.repeatPairIn14Days) {
        signals.push({
          code: 'repeat_pair',
          detail: `Same Customer–Worker pair completed ${pairCount} bookings in 14 days (Threshold: ${settings.repeatPairIn14Days}).`,
          weight: 35,
        });
        if (!relatedUserIds.includes(worker._id || worker)) {
          relatedUserIds.push(worker._id || worker);
        }
      }
    } catch (err) {}

    // 5. Instant Complete Check (from Arrived to Completed < minJobMinutes)
    if (booking.arrivedAt && booking.completedAt) {
      const durationMinutes = (new Date(booking.completedAt) - new Date(booking.arrivedAt)) / (1000 * 60);
      if (durationMinutes >= 0 && durationMinutes < settings.minJobMinutes) {
        signals.push({
          code: 'instant_complete',
          detail: `Job marked complete in only ${Math.round(durationMinutes)} minutes after arrival (Threshold: ${settings.minJobMinutes} mins).`,
          weight: 45,
        });
      }
    }
  }

  // Calculate weighted total score (capped at 100)
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.min(100, totalWeight);

  if (score < settings.flagScore) {
    return { score, signals, flagged: false };
  }

  // Determine primary flag type
  const primaryType = signals.length === 1 ? signals[0].code : 'multiple_signals';

  // AI Explanation Generation via callClaudeJSON
  let aiExplanation = {
    summary: `System flagged ${signals.length} anomalies with combined risk score of ${score}/100.`,
    likelyBenign: false,
    suggestedAdminChecks: ['Review customer booking history', 'Verify worker distance travel log'],
  };

  const enabled = await isAiFeatureEnabled('fraudDetection');
  if (enabled) {
    const anonymizedSignals = signals.map((s) => ({
      code: s.code,
      weight: s.weight,
      detail: s.detail.replace(/\b\d{10}\b/g, '[PHONE]').replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]'),
    }));

    const aiRes = await callClaudeJSON({
      feature: 'fraudDetection',
      system: 'You are an objective fraud detection analyst for a home service marketplace. Analyze these risk signals. Output pure JSON only: { "summary": string (max 3 sentences), "likelyBenign": boolean, "suggestedAdminChecks": string[] }',
      user: `Risk Score: ${score}/100\nSignals: ${JSON.stringify(anonymizedSignals)}`,
      schemaCheck: (obj) => obj && typeof obj.summary === 'string' && Array.isArray(obj.suggestedAdminChecks),
      userId: targetUserId,
    });

    if (aiRes.ok && aiRes.data) {
      aiExplanation = aiRes.data;
    }
  }

  // Create or update open FraudFlag
  let flag = await FraudFlag.findOne({
    subjectUserId: targetUserId,
    status: 'open',
  });

  if (flag) {
    flag.score = score;
    flag.signals = signals;
    flag.type = primaryType;
    flag.aiExplanation = aiExplanation;
    if (bookingId) flag.bookingId = bookingId;
    signals.forEach((s) => {
      if (!flag.signals.some((existing) => existing.code === s.code)) {
        flag.signals.push(s);
      }
    });
    relatedUserIds.forEach((rid) => {
      if (!flag.relatedUserIds.includes(rid)) flag.relatedUserIds.push(rid);
    });
    await flag.save();
  } else {
    flag = await FraudFlag.create({
      subjectUserId: targetUserId,
      relatedUserIds,
      bookingId: bookingId || null,
      type: primaryType,
      score,
      signals,
      aiExplanation,
      status: 'open',
    });
  }

  // If score >= holdScore, put newly credited bonus transactions on pending_review
  if (score >= settings.holdScore) {
    try {
      const userWallet = await Wallet.findOne({ user: targetUserId });
      if (userWallet && Array.isArray(userWallet.transactions)) {
        let changed = false;
        userWallet.transactions.forEach((tx) => {
          if (
            tx.status === 'available' &&
            (tx.category === 'bonus' || tx.description?.toLowerCase().includes('bonus') || tx.description?.toLowerCase().includes('cashback'))
          ) {
            tx.status = 'pending_review';
            changed = true;
          }
        });
        if (changed) {
          await userWallet.save();
        }
      }
    } catch (holdErr) {
      console.warn('[FraudService] Failed to hold bonus transactions:', holdErr.message);
    }
  }

  return {
    score,
    signals,
    flagged: true,
    flagId: flag._id,
  };
}

/**
 * Add custom signal hook (e.g. proof_reuse from Prompt 7)
 */
async function addSignal({ userId, bookingId, code, detail, weight = 65 }) {
  if (!userId) return null;
  return evaluate({
    userId,
    bookingId,
    customSignals: [{ code, detail, weight }],
  });
}

module.exports = {
  getFraudSettings,
  recordUserDeviceAndIp,
  evaluate,
  addSignal,
};
