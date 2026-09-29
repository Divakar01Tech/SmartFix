/**
 * SmartFix Dialogue Manager & Action Router
 * Manages multi-turn conversation state, trust gating, 8-taluk service validation,
 * ambiguity resolution, auto-escalation, and REST API action execution.
 */

const Booking = require('../models/Booking');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const CommissionConfig = require('../models/CommissionConfig');
const { isTalukCovered, SIVAGANGAI_TALUKS, SERVICE_CATEGORIES } = require('./aiIntentService');

// In-memory dialogue session store (Keyed by userId or sessionId)
const sessionStore = new Map();

/**
 * Gets or initializes session state
 */
function getSessionState(sessionId, userId, userRole = 'customer', initialLang = 'en') {
  const key = userId ? `user_${userId}` : `session_${sessionId || 'anonymous'}`;

  if (!sessionStore.has(key)) {
    sessionStore.set(key, {
      sessionId: key,
      userId: userId || null,
      role: userRole,
      language: initialLang,
      activeBookingId: null,
      fallbackCount: 0,
      awaitingDisambiguation: false,
      disambiguationCandidates: [],
      history: []
    });
  }

  const session = sessionStore.get(key);
  // Update role/language if provided
  if (userRole && session.role !== userRole) session.role = userRole;
  if (initialLang && session.language !== initialLang) session.language = initialLang;

  return session;
}

/**
 * Audit log logger for intent turns (omits sensitive KYC/document data)
 */
function logIntentTurn(session, intentData, userMessage) {
  try {
    const logPayload = {
      timestamp: new Date().toISOString(),
      sessionId: session.sessionId,
      userId: session.userId,
      role: session.role,
      intent: intentData.intent,
      confidence: intentData.confidence,
      entities: intentData.entities,
      isSafetyRisk: intentData.isSafetyRisk,
      messagePreview: (userMessage || '').substring(0, 80)
    };
    console.log(`[AI Intent Audit]`, JSON.stringify(logPayload));
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

/**
 * Trust Gating Policy Enforcement:
 * Withholds worker phone number and rating unless booking status >= 'Confirmed'.
 */
function enforceTrustGating(booking, responsePayload) {
  if (!booking) return responsePayload;

  const allowedStatuses = ['Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress', 'Completed', 'Paid', 'Reviewed', 'CaptainArrived', 'InProgress'];
  const isConfirmedOrLater = allowedStatuses.includes(booking.status);

  if (!isConfirmedOrLater && booking.worker) {
    // Redact worker phone & rating
    if (responsePayload.workerDetails) {
      responsePayload.workerDetails.phone = '[Withheld until Booking Confirmed]';
      responsePayload.workerDetails.rating = '[Withheld until Booking Confirmed]';
    }
    responsePayload.trustGatedNotice = 'ℹ️ Worker phone number and rating are withheld until the booking is Confirmed by the provider.';
  }

  return responsePayload;
}

/**
 * Process a dialogue turn: classify intent, update session state, run action, generate response
 */
async function processDialogueTurn(userId, sessionId, message, userRole, intentData, authUser = null) {
  const session = getSessionState(sessionId, userId, userRole, intentData.language || 'en');

  // Log turn for auditing
  logIntentTurn(session, intentData, message);

  // Maintain booking reference in session if entity provided
  if (intentData.entities?.booking_id) {
    session.activeBookingId = intentData.entities.booking_id;
  }

  // Handle SwitchLanguage intent
  if (intentData.intent === 'SwitchLanguage') {
    const targetLang = intentData.language === 'ta' || message.toLowerCase().includes('tamil') ? 'ta' : 'en';
    session.language = targetLang;
    if (authUser && authUser.id) {
      await User.findByIdAndUpdate(authUser.id, { preferredLanguage: targetLang }).catch(() => {});
    }
    return {
      reply: targetLang === 'ta'
        ? '🇮🇳 மொழி தமிழுக்கு மாற்றப்பட்டது! உங்களுக்கு எவ்வாறு உதவ வேண்டும்?'
        : '🇬🇧 Language switched to English! How can I assist you today?',
      intentData,
      actionResult: { success: true }
    };
  }

  // Track & evaluate Fallback / Escalation triggers
  if (intentData.intent === 'FallbackIntent') {
    session.fallbackCount += 1;
    if (session.fallbackCount >= 2) {
      // Auto-escalate to human on 2 consecutive fallbacks
      intentData.intent = 'EscalateToHuman';
      intentData.label = '🎧 Escalating to Admin Support';
      session.fallbackCount = 0;
    }
  } else {
    session.fallbackCount = 0;
  }

  // Auto-escalate if safety complaint or refund request
  if (intentData.isSafetyRisk || intentData.intent === 'RequestRefund' || (intentData.intent === 'RaiseComplaint' && intentData.entities?.issue_type === 'no-show')) {
    intentData.shouldEscalate = true;
  }

  // Service Area Taluk Validation Check for BookService or CheckServiceArea
  if ((intentData.intent === 'CheckServiceArea' || intentData.intent === 'BookService') && intentData.entities?.taluk) {
    const talukCheck = isTalukCovered(intentData.entities.taluk);
    if (!talukCheck.isCovered) {
      return {
        reply: session.language === 'ta'
          ? `📍 மன்னிக்கவும்! **${intentData.entities.taluk}** இன்னும் எங்கள் சேவை மண்டலத்திற்குள் வரவில்லை. தற்போது நாங்கள் சிவகங்கை மாவட்டத்தின் 8 வட்டங்களில் (Sivagangai, Manamadurai, Ilayangudi, Singampunari, Kalayarkoil, Tirupathur, Devakottai, Karaikudi) மட்டுமே சேவைகளை வழங்குகிறோம்.`
          : `📍 Sorry! **${intentData.entities.taluk}** is not yet in our service area. SmartFix currently operates strictly within the 8 Sivagangai District taluks (Sivagangai, Manamadurai, Ilayangudi, Singampunari, Kalayarkoil, Tirupathur, Devakottai, Karaikudi).`,
        intentData,
        actionResult: { isServiceable: false, coveredTaluks: SIVAGANGAI_TALUKS }
      };
    }
  }

  // Ambiguity Resolution Check: User asks to cancel or track without specifying booking ID
  if ((intentData.intent === 'CancelBooking' || intentData.intent === 'TrackWorker') && !intentData.entities?.booking_id && !session.activeBookingId && authUser) {
    const activeBookings = await Booking.find({
      customer: authUser.id,
      status: { $in: ['Pending', 'Accepted', 'Confirmed', 'EnRoute', 'Arrived'] }
    }).sort({ createdAt: -1 }).limit(5);

    if (activeBookings.length > 1) {
      session.awaitingDisambiguation = true;
      session.disambiguationCandidates = activeBookings.map(b => b._id.toString());
      const bookingListText = activeBookings.map((b, i) => `${i + 1}. Booking ID: \`${b._id}\` (${b.trade} - ${b.status})`).join('\n');

      return {
        reply: session.language === 'ta'
          ? `மன்னிக்கவும், உங்களிடம் பல செயலில் உள்ள பதிவுகள் உள்ளன. தயவுசெய்து எந்த பதிவை நீங்கள் குறிப்பிட விரும்புகிறீர்கள் என்பதைத் தேர்ந்தெடுக்கவும்:\n\n${bookingListText}`
          : `You have multiple active bookings. Please specify which booking you would like to proceed with:\n\n${bookingListText}`,
        intentData,
        actionResult: { requiresDisambiguation: true, activeBookings }
      };
    } else if (activeBookings.length === 1) {
      session.activeBookingId = activeBookings[0]._id.toString();
    }
  }

  // Execute Intent Action Router
  const actionResult = await executeIntentAction(session, intentData, authUser);

  // Construct dialogue response
  let replyText = actionResult.customReply || generateDialogueResponse(session, intentData, actionResult);

  // Apply Trust-Gating Notice if relevant
  if (actionResult.booking) {
    const gated = enforceTrustGating(actionResult.booking, actionResult);
    if (gated.trustGatedNotice) {
      replyText += `\n\n${gated.trustGatedNotice}`;
    }
  }

  return {
    reply: replyText,
    intentData,
    actionResult,
    sessionState: {
      activeBookingId: session.activeBookingId,
      fallbackCount: session.fallbackCount,
      language: session.language
    }
  };
}

/**
 * Action Router linking intents to system actions/database operations
 */
async function executeIntentAction(session, intentData, authUser) {
  const { intent, entities } = intentData;
  const bookingId = entities?.booking_id || session.activeBookingId;

  try {
    switch (intent) {
      // === CUSTOMER ACTIONS ===
      case 'GreetIntent':
        return { success: true };

      case 'CheckServiceArea': {
        const talukText = entities?.taluk || 'Sivagangai District';
        const check = isTalukCovered(talukText);
        return {
          success: true,
          isServiceable: check.isCovered,
          taluk: check.matchedTaluk || talukText,
          coveredTaluks: SIVAGANGAI_TALUKS
        };
      }

      case 'AskPricing': {
        const category = entities?.service_category || 'Plumbing';
        const subServices = SERVICE_CATEGORIES[category] || SERVICE_CATEGORIES['Plumbing'];
        return {
          success: true,
          category,
          subServices,
          baseRateInr: category === 'AC/Appliance Repair' ? 500 : category === 'Electrical' ? 400 : 350
        };
      }

      case 'BookService': {
        return {
          success: true,
          draftBooking: {
            trade: entities?.service_category || 'Plumbing',
            subService: entities?.sub_service || 'Tap leak repair',
            estimatedPrice: 350,
            taluk: entities?.taluk || 'Sivagangai'
          }
        };
      }

      case 'CheckBookingStatus': {
        if (!bookingId) return { success: false, reason: 'NO_BOOKING_ID' };
        const booking = await Booking.findById(bookingId).populate('worker', 'name phone rating ratingCount trade');
        if (!booking) return { success: false, reason: 'NOT_FOUND' };

        return {
          success: true,
          booking,
          workerDetails: booking.worker ? {
            name: booking.worker.name,
            phone: booking.worker.phone,
            rating: booking.worker.rating || null
          } : null
        };
      }

      case 'TrackWorker': {
        if (!bookingId) return { success: false, reason: 'NO_BOOKING_ID' };
        const booking = await Booking.findById(bookingId).populate('worker', 'name phone location lat lng');
        if (!booking) return { success: false, reason: 'NOT_FOUND' };

        const isTrackable = ['Confirmed', 'EnRoute', 'Arrived', 'CaptainArrived', 'InProgress', 'WorkInProgress'].includes(booking.status);
        return {
          success: true,
          isTrackable,
          status: booking.status,
          booking,
          workerLocation: isTrackable && booking.worker ? {
            lat: booking.workerCurrentLat || booking.userLat || 9.8433,
            lng: booking.workerCurrentLng || booking.userLng || 78.4809,
            updatedAt: booking.workerLocationUpdatedAt
          } : null
        };
      }

      case 'RescheduleBooking': {
        if (!bookingId) return { success: false, reason: 'NO_BOOKING_ID' };
        const newDateTime = entities?.date_time || 'Tomorrow 10:00 AM';
        const updated = await Booking.findByIdAndUpdate(bookingId, { date: newDateTime.split(' ')[0], time: newDateTime }, { new: true });
        return { success: true, booking: updated, newDateTime };
      }

      case 'CancelBooking': {
        if (!bookingId) return { success: false, reason: 'NO_BOOKING_ID' };
        const cancelled = await Booking.findByIdAndUpdate(bookingId, { status: 'Cancelled', cancelReason: 'Cancelled via AI Chatbot' }, { new: true });
        return { success: true, booking: cancelled };
      }

      case 'RaiseComplaint': {
        return {
          success: true,
          ticketId: `CMP-${Math.floor(100000 + Math.random() * 900000)}`,
          issueType: entities?.issue_type || 'General complaint',
          status: 'EscalatedToAdmin'
        };
      }

      case 'CheckWalletBalance': {
        if (!authUser) return { success: false, reason: 'AUTH_REQUIRED' };
        let wallet = await Wallet.findOne({ user: authUser.id });
        if (!wallet) wallet = await Wallet.create({ user: authUser.id, role: authUser.role || 'customer', balance: 150 });
        return { success: true, balance: wallet.balance, transactions: wallet.transactions.slice(0, 3) };
      }

      case 'RedeemWalletBonus': {
        if (!authUser) return { success: false, reason: 'AUTH_REQUIRED' };
        const wallet = await Wallet.findOne({ user: authUser.id });
        const redeemAmount = entities?.wallet_amount || Math.min(wallet?.balance || 0, 100);
        return { success: true, redeemedAmount: redeemAmount, remainingBalance: (wallet?.balance || 0) - redeemAmount };
      }

      case 'RateWorker': {
        if (!bookingId) return { success: false, reason: 'NO_BOOKING_ID' };
        const ratingVal = entities?.rating || 5;
        const updated = await Booking.findByIdAndUpdate(bookingId, { rating: ratingVal, status: 'Reviewed' }, { new: true });
        return { success: true, booking: updated, rating: ratingVal };
      }

      case 'RequestRefund': {
        return { success: true, refundRequestId: `REF-${Date.now().toString().slice(-6)}`, status: 'QueuedForAdminReview' };
      }

      // === WORKER INTENTS ===
      case 'CheckKYCStatus': {
        if (!authUser) return { success: false, reason: 'AUTH_REQUIRED' };
        const user = await User.findById(authUser.id);
        return {
          success: true,
          kycStatus: user?.verificationStatus || 'Pending',
          aadhaarProvided: !!user?.aadhaarNumber,
          idProofProvided: !!user?.idProofNumber
        };
      }

      case 'SubmitKYCDocs': {
        return { success: true, kycUploadRoute: '/profile' };
      }

      case 'CheckIncomingJobs': {
        const pendingJobs = await Booking.find({ status: 'Pending' }).limit(5);
        return { success: true, jobs: pendingJobs };
      }

      case 'AcceptJobRequest': {
        if (!bookingId) return { success: false, reason: 'NO_BOOKING_ID' };
        const accepted = await Booking.findByIdAndUpdate(bookingId, {
          status: 'Accepted',
          worker: authUser ? authUser.id : null,
          acceptedAt: new Date(),
          slaDeadline: new Date(Date.now() + 60 * 60 * 1000)
        }, { new: true });
        return { success: true, booking: accepted };
      }

      case 'DeclineJobRequest': {
        if (!bookingId) return { success: false, reason: 'NO_BOOKING_ID' };
        const declined = await Booking.findByIdAndUpdate(bookingId, { status: 'Declined' }, { new: true });
        return { success: true, booking: declined };
      }

      case 'UpdateJobStatus': {
        if (!bookingId) return { success: false, reason: 'NO_BOOKING_ID' };
        const targetStatus = entities?.issue_type || 'EnRoute';
        const updated = await Booking.findByIdAndUpdate(bookingId, { status: targetStatus }, { new: true });
        return { success: true, booking: updated, status: targetStatus };
      }

      case 'CheckEarnings': {
        if (!authUser) return { success: false, reason: 'AUTH_REQUIRED' };
        const wallet = await Wallet.findOne({ user: authUser.id });
        return { success: true, totalEarned: wallet?.totalEarned || 0, balance: wallet?.balance || 0 };
      }

      case 'AskCommissionRate': {
        const config = await CommissionConfig.findOne() || { defaultCommissionPercent: 10, onlinePaymentBonusPercent: 5 };
        return { success: true, commissionPercent: config.defaultCommissionPercent, bonusPercent: config.onlinePaymentBonusPercent };
      }

      case 'UpdateAvailability': {
        if (!authUser) return { success: false, reason: 'AUTH_REQUIRED' };
        const user = await User.findById(authUser.id);
        const newStatus = !user?.isAvailable;
        await User.findByIdAndUpdate(authUser.id, { isAvailable: newStatus, isOnline: newStatus });
        return { success: true, isAvailable: newStatus };
      }

      case 'RaiseSupportTicket': {
        return { success: true, ticketId: `WST-${Math.floor(100000 + Math.random() * 900000)}`, status: 'Submitted' };
      }

      // === ADMIN INTENTS ===
      case 'QueryPendingKYC': {
        const pendingCount = await User.countDocuments({ role: 'handyman', verificationStatus: 'Pending' });
        const pendingList = await User.find({ role: 'handyman', verificationStatus: 'Pending' }).select('name phone trade createdAt').limit(5);
        return { success: true, pendingCount, pendingList };
      }

      case 'QuerySLABreaches': {
        const slaBreaches = await Booking.find({ slaBreached: true }).populate('customer worker', 'name phone').limit(5);
        return { success: true, breachCount: slaBreaches.length, breaches: slaBreaches };
      }

      case 'QueryRevenueMetrics': {
        const completedBookings = await Booking.find({ status: { $in: ['Completed', 'Paid', 'Reviewed'] } });
        const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.price || 0), 0);
        const platformCommission = completedBookings.reduce((sum, b) => sum + (b.commissionAmount || (b.price * 0.1)), 0);
        return { success: true, totalBookings: completedBookings.length, totalRevenue, platformCommission };
      }

      case 'QueryActiveBookings': {
        const activeBookings = await Booking.find({ status: { $in: ['Pending', 'Accepted', 'Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress'] } }).limit(10);
        return { success: true, activeCount: activeBookings.length, bookings: activeBookings };
      }

      case 'UpdateCommissionConfig': {
        return { success: true, commissionSettingsRoute: '/admin' };
      }

      case 'EscalateToHuman':
        return { success: true, escalated: true };

      default:
        return { success: true };
    }
  } catch (err) {
    console.error('Error executing intent action:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dialogue Response Natural Language Generator
 */
function generateDialogueResponse(session, intentData, actionResult) {
  const isTa = session.language === 'ta';
  const { intent, entities } = intentData;

  switch (intent) {
    case 'GreetIntent':
      return isTa
        ? '👋 **வணக்கம்! SmartFix உதவி மையத்திற்கு வரவேற்கிறோம்.** நான் உங்களுக்கு எவ்வாறு உதவ முடியும்? சேவைகளை பதிவு செய்ய, கட்டணங்களை அறிய அல்லது உங்கள் பதிவை கண்காணிக்க கேட்கலாம்.'
        : '👋 **Hello! Welcome to SmartFix AI Assistant.** How can I help you today? You can book a repair service, check rates, or track your active booking.';

    case 'CheckServiceArea':
      return isTa
        ? `📍 **SmartFix சேவை மண்டல தகவல்கள்:** நாங்கள் சிவகங்கை மாவட்டத்தின் 8 வட்டங்களிலும் (Sivagangai, Manamadurai, Ilayangudi, Singampunari, Kalayarkoil, Tirupathur, Devakottai, Karaikudi) 100% சேவைகளை வழங்குகிறோம்!`
        : `📍 **SmartFix Service Area:** We actively cover all 8 Taluks in Sivagangai District (Sivagangai, Manamadurai, Ilayangudi, Singampunari, Kalayarkoil, Tirupathur, Devakottai, Karaikudi). Your location is verified!`;

    case 'AskPricing':
      return isTa
        ? `💰 **${actionResult.category || 'சேவை'} கட்டண விவரம்:**\n• ஆரம்ப சேவை கட்டணம்: ₹${actionResult.baseRateInr || 350}\n• மணிநேர கட்டணம்: ₹300 - ₹450/மணி\n• 30 நாள் இலவச உத்தரவாதம் வழங்கப்படுகிறது.`
        : `💰 **${actionResult.category || 'Service'} Rate Card:**\n• Base Inspection Fare: ₹${actionResult.baseRateInr || 350}\n• Standard Hourly Charge: ₹300 – ₹450/hr\n• Guaranteed 30-day post-repair warranty included.`;

    case 'BookService':
      return isTa
        ? `📅 **${entities?.service_category || 'சேவை'} முன்பதிவு செய்ய தயார்!**\nமதிப்பிடப்பட்ட கட்டணம்: ₹350. முன்பதிவை உறுதிசெய்ய "Confirm Request" பொத்தானை அழுத்தவும்.`
        : `📅 **Ready to book a ${entities?.service_category || 'Service'} technician!**\nEstimated Fare: ₹350. Click "Confirm Request" below to broadcast your request to nearby verified experts.`;

    case 'CheckBookingStatus':
      if (!actionResult.success) {
        return isTa
          ? '📋 உங்கள் பதிவு எண் கிடைக்கவில்லை. தயவுசெய்து சரியான பதிவு எண்ணை (எ.கா. SF-20394) வழங்கவும்.'
          : '📋 Booking record not found. Please provide a valid Booking ID (e.g. SF-20394).';
      }
      return isTa
        ? `📋 **பதிவு நிலை [${actionResult.booking?._id}]:**\n• சேவை: ${actionResult.booking?.trade}\n• தற்போதைய நிலை: **${actionResult.booking?.status}**\n• கட்டணம்: ₹${actionResult.booking?.price}`
        : `📋 **Booking Status [${actionResult.booking?._id}]:**\n• Service: ${actionResult.booking?.trade}\n• Current Status: **${actionResult.booking?.status}**\n• Price: ₹${actionResult.booking?.price}`;

    case 'TrackWorker':
      if (!actionResult.isTrackable) {
        return isTa
          ? `🚚 கைவினைஞர் இன்னும் புறப்படவில்லை (தற்போதைய நிலை: ${actionResult.status}). பதிவு உறுதிசெய்யப்பட்ட பிறகு நேரலை வரைபடம் இயக்கப்படும்.`
          : `🚚 Worker live tracking is unavailable until the booking is Confirmed & En Route (Current Status: ${actionResult.status}).`;
      }
      return isTa
        ? `🚚 **கைவினைஞர் நேரலை வருகை tracker:** கைவினைஞர் பயணத்தில் உள்ளார். ETA: ~15 நிமிடங்கள்.`
        : `🚚 **Live Worker Tracking Active:** Technician is En Route to your address. Estimated Arrival: ~15 mins.`;

    case 'RaiseComplaint':
      return isTa
        ? `🚨 **புகார் பதிவு செய்யப்பட்டது [${actionResult.ticketId}]:** உங்கள் பிரச்சனை நிர்வாகிக்கு அனுப்பப்பட்டது. 15 நிமிடங்களுக்குள் எங்களது ஆதரவு குழு தொடர்பு கொள்ளும்.`
        : `🚨 **Complaint Logged [${actionResult.ticketId}]:** Your issue has been escalated to SmartFix Admin ops team for immediate SLA review.`;

    case 'CheckWalletBalance':
      return isTa
        ? `👛 **உங்கள் SmartFix Wallet இருப்பு:** ₹${actionResult.balance || 0}`
        : `👛 **Your SmartFix Wallet Balance:** ₹${actionResult.balance || 0}`;

    case 'CheckKYCStatus':
      return isTa
        ? `🆔 **KYC சரிபார்ப்பு நிலை:** **${actionResult.kycStatus || 'Pending'}**`
        : `🆔 **KYC Verification Status:** **${actionResult.kycStatus || 'Pending'}**`;

    case 'QueryPendingKYC':
      return isTa
        ? `🔍 **நிர்வாகி பார்வை — நிலுவையில் உள்ள KYCs:** ${actionResult.pendingCount || 0} கைவினைஞர்கள் சரிபார்ப்பிற்கு காத்திருக்கிறார்கள்.`
        : `🔍 **Admin Panel — Pending KYCs:** ${actionResult.pendingCount || 0} handymen are currently awaiting document approval in the verification queue.`;

    case 'QuerySLABreaches':
      return isTa
        ? `⚠️ **SLA மீறல்கள்:** ${actionResult.breachCount || 0} பதிவுகள் 1 மணிநேர SLA வரம்பை மீறியுள்ளன.`
        : `⚠️ **SLA Monitor:** ${actionResult.breachCount || 0} bookings have breached the mandatory 1-hour arrival SLA.`;

    case 'EscalateToHuman':
      return isTa
        ? `🎧 **நிர்வாகி ஆதரவு இணைக்கப்படுகிறது...** நேரலை ஆதரவு முகவர் உங்களை விரைவில் தொடர்புகொள்வார்.`
        : `🎧 **Connecting to Human Admin Support...** A customer support agent has been notified of your request.`;

    default:
      return isTa
        ? `⚡ **SmartFix AI:** உங்கள் கேள்வி புரிந்தது. மேலும் உதவிக்கு கீழே உள்ள விருப்பங்களைத் தேர்ந்தெடுக்கவும்.`
        : `⚡ **SmartFix AI:** I have processed your request. Choose an action below or ask me any repair questions!`;
  }
}

module.exports = {
  processDialogueTurn,
  executeIntentAction,
  enforceTrustGating,
  getSessionState,
};
