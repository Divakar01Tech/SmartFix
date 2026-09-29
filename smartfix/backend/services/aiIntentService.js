/**
 * SmartFix Live Intent Recognition & Entity Extraction Engine
 * Implementation of HandyBook (SmartFix) AI Chatbot Intent Taxonomy
 * Supports Customer, Service Provider (Worker), and Admin intents in English and Tamil.
 */

const { callGeminiJsonApi } = require('./geminiService');

// 8 Sivagangai District Taluks allowlist (PRD §4, §8)
const SIVAGANGAI_TALUKS = [
  'Sivagangai',
  'Manamadurai',
  'Ilayangudi',
  'Singampunari',
  'Kalayarkoil',
  'Tirupathur',
  'Devakottai',
  'Karaikudi'
];

// 6 Fixed Service Categories and sub-services
const SERVICE_CATEGORIES = {
  'Plumbing': [
    'Tap leak repair', 'Pipe burst repair', 'Drain blockage clearing',
    'Overhead tank repair', 'Geyser installation/leak', 'Basin installation',
    'Flush tank repair', 'Water pump repair'
  ],
  'Electrical': [
    'MCB tripping fix', 'Ceiling fan repair/install', 'Switchboard wiring',
    'Tube light/LED repair', 'Geyser electrical wiring', 'Short circuit inspection',
    'Inverter wiring', 'House re-wiring'
  ],
  'Carpentry': [
    'Door latch/hinge repair', 'Furniture assembly', 'Cabinet lock repair',
    'Wooden shelf installation', 'Bed repair', 'Window latch repair',
    'Door alignment', 'Custom woodwork'
  ],
  'Painting': [
    'Touch-up wall painting', 'Full room painting', 'Waterproof wall coating',
    'Door/Window enamel paint', 'Exterior wall paint', 'Ceiling painting',
    'Wall putty application', 'Primer coating'
  ],
  'Cleaning': [
    'Deep home cleaning', 'Bathroom deep clean', 'Kitchen degreasing',
    'Sofa shampooing', 'Water tank cleaning', 'Sump cleaning',
    'Post-renovation cleanup', 'Disinfection service'
  ],
  'AC/Appliance Repair': [
    'AC water leakage fix', 'AC gas refill (R32/R410A)', 'Refrigerator defrost issue',
    'Washing machine drain pump', 'RO water purifier filter change', 'Microwave oven repair',
    'Treadmill service', 'Mixer/Grinder repair'
  ]
};

const SUPPORTED_INTENTS = {
  // === CUSTOMER INTENTS ===
  GreetIntent: {
    code: 'GreetIntent',
    role: 'customer',
    label: '👋 Greet / Welcome',
    priority: 'Low',
    suggestedActions: [
      { label: '📅 Book a Service', action: 'BookService' },
      { label: '💰 Check Pricing', action: 'AskPricing' },
      { label: '📍 Check Coverage Area', action: 'CheckServiceArea' }
    ]
  },
  CheckServiceArea: {
    code: 'CheckServiceArea',
    role: 'customer',
    label: '📍 Service Area Verification',
    priority: 'Medium',
    suggestedActions: [
      { label: '📍 Check Sivagangai Taluks', action: 'CheckServiceArea' },
      { label: '📅 Book Technician', action: 'BookService' }
    ]
  },
  AskPricing: {
    code: 'AskPricing',
    role: 'customer',
    label: '💰 Service Pricing & Rate Inquiry',
    priority: 'Medium',
    suggestedActions: [
      { label: '🚰 Plumbing Rates', action: 'AskPricing', params: { category: 'Plumbing' } },
      { label: '⚡ Electrical Rates', action: 'AskPricing', params: { category: 'Electrical' } },
      { label: '❄️ AC Repair Rates', action: 'AskPricing', params: { category: 'AC/Appliance Repair' } }
    ]
  },
  BookService: {
    code: 'BookService',
    role: 'customer',
    label: '📅 Create Service Booking',
    priority: 'High',
    suggestedActions: [
      { label: '📝 Confirm Booking Details', action: 'CREATE_BOOKING' },
      { label: '👨‍🔧 Browse Technicians', action: 'MATCH_WORKERS' }
    ]
  },
  CheckBookingStatus: {
    code: 'CheckBookingStatus',
    role: 'customer',
    label: '📋 Check Booking Status',
    priority: 'High',
    suggestedActions: [
      { label: '🚚 Track Worker ETA', action: 'TrackWorker' },
      { label: '📞 Call Technician', action: 'CALL_WORKER' }
    ]
  },
  TrackWorker: {
    code: 'TrackWorker',
    role: 'customer',
    label: '🚚 Live Worker Tracking / ETA',
    priority: 'High',
    suggestedActions: [
      { label: '📍 View Live Map', action: 'TRACK_MAP' }
    ]
  },
  RescheduleBooking: {
    code: 'RescheduleBooking',
    role: 'customer',
    label: '🕒 Reschedule Booking Date/Time',
    priority: 'Medium',
    suggestedActions: [
      { label: '🗓️ Select New Date', action: 'RESCHEDULE' }
    ]
  },
  CancelBooking: {
    code: 'CancelBooking',
    role: 'customer',
    label: '❌ Cancel Booking',
    priority: 'High',
    suggestedActions: [
      { label: '⚠️ Confirm Cancellation', action: 'CONFIRM_CANCEL' }
    ]
  },
  RaiseComplaint: {
    code: 'RaiseComplaint',
    role: 'customer',
    label: '🚨 Report Complaint / Issue',
    priority: 'Critical',
    suggestedActions: [
      { label: '📩 Connect to Support', action: 'EscalateToHuman' }
    ]
  },
  CheckWalletBalance: {
    code: 'CheckWalletBalance',
    role: 'customer',
    label: '👛 Wallet & Bonus Balance',
    priority: 'Low',
    suggestedActions: [
      { label: '🎁 Redeem Bonus', action: 'RedeemWalletBonus' }
    ]
  },
  RedeemWalletBonus: {
    code: 'RedeemWalletBonus',
    role: 'customer',
    label: '🎁 Redeem Wallet Bonus',
    priority: 'Medium',
    suggestedActions: [
      { label: '💳 Apply Wallet to Booking', action: 'APPLY_WALLET' }
    ]
  },
  RateWorker: {
    code: 'RateWorker',
    role: 'customer',
    label: '⭐ Rate & Review Technician',
    priority: 'Medium',
    suggestedActions: [
      { label: '⭐ Submit Rating', action: 'SUBMIT_RATING' }
    ]
  },
  RequestRefund: {
    code: 'RequestRefund',
    role: 'customer',
    label: '💸 Request Payment Refund',
    priority: 'High',
    suggestedActions: [
      { label: '💬 Talk to Admin', action: 'EscalateToHuman' }
    ]
  },
  SwitchLanguage: {
    code: 'SwitchLanguage',
    role: 'customer',
    label: '🌐 Toggle Language (English / தமிழ்)',
    priority: 'Low',
    suggestedActions: [
      { label: '🇮🇳 தமிழ் (Tamil)', action: 'TOGGLE_TA' },
      { label: '🇬🇧 English', action: 'TOGGLE_EN' }
    ]
  },

  // === SERVICE PROVIDER (WORKER) INTENTS ===
  CheckKYCStatus: {
    code: 'CheckKYCStatus',
    role: 'handyman',
    label: '🆔 Check KYC Verification Status',
    priority: 'High',
    suggestedActions: [
      { label: '📄 Submit Documents', action: 'SubmitKYCDocs' }
    ]
  },
  SubmitKYCDocs: {
    code: 'SubmitKYCDocs',
    role: 'handyman',
    label: '📄 Submit KYC ID Documents',
    priority: 'High',
    suggestedActions: [
      { label: '📸 Upload Aadhaar / DL', action: 'UPLOAD_DOCS' }
    ]
  },
  CheckIncomingJobs: {
    code: 'CheckIncomingJobs',
    role: 'handyman',
    label: '🔔 View Incoming Job Requests',
    priority: 'High',
    suggestedActions: [
      { label: '✅ Accept Job', action: 'AcceptJobRequest' }
    ]
  },
  AcceptJobRequest: {
    code: 'AcceptJobRequest',
    role: 'handyman',
    label: '✅ Accept Job Request',
    priority: 'High',
    suggestedActions: [
      { label: '🚀 Start Navigation', action: 'START_ENROUTE' }
    ]
  },
  DeclineJobRequest: {
    code: 'DeclineJobRequest',
    role: 'handyman',
    label: '🚫 Decline Job Request',
    priority: 'Medium',
    suggestedActions: [
      { label: '❌ Confirm Decline', action: 'DECLINE_JOB' }
    ]
  },
  UpdateJobStatus: {
    code: 'UpdateJobStatus',
    role: 'handyman',
    label: '🔄 Update Job Progress (En Route / Arrived / Done)',
    priority: 'High',
    suggestedActions: [
      { label: '📍 Mark En Route', action: 'STATUS_ENROUTE' },
      { label: '🏡 Mark Arrived', action: 'STATUS_ARRIVED' },
      { label: '✅ Mark Job Completed', action: 'STATUS_COMPLETED' }
    ]
  },
  CheckEarnings: {
    code: 'CheckEarnings',
    role: 'handyman',
    label: '💰 View Earnings & Payout Breakdown',
    priority: 'Medium',
    suggestedActions: [
      { label: '📊 View Weekly Earnings', action: 'VIEW_EARNINGS' }
    ]
  },
  AskCommissionRate: {
    code: 'AskCommissionRate',
    role: 'handyman',
    label: 'ℹ️ Platform Commission & Bonus Info',
    priority: 'Low',
    suggestedActions: [
      { label: '📜 Commission Policy', action: 'COMMISSION_INFO' }
    ]
  },
  UpdateAvailability: {
    code: 'UpdateAvailability',
    role: 'handyman',
    label: '🟢 Toggle Duty Status (Online / Offline)',
    priority: 'High',
    suggestedActions: [
      { label: '🟢 Go Online', action: 'GO_ONLINE' },
      { label: '🔴 Go Offline', action: 'GO_OFFLINE' }
    ]
  },
  RaiseSupportTicket: {
    code: 'RaiseSupportTicket',
    role: 'handyman',
    label: '🎫 Raise Worker Support Ticket',
    priority: 'High',
    suggestedActions: [
      { label: '📩 Contact Support', action: 'EscalateToHuman' }
    ]
  },

  // === ADMIN INTENTS ===
  QueryPendingKYC: {
    code: 'QueryPendingKYC',
    role: 'admin',
    label: '🔍 Query Pending Worker KYCs',
    priority: 'High',
    suggestedActions: [
      { label: '📋 View Pending List', action: 'LIST_PENDING_KYC' }
    ]
  },
  QuerySLABreaches: {
    code: 'QuerySLABreaches',
    role: 'admin',
    label: '⚠️ Query 1-Hour SLA Breached Bookings',
    priority: 'Critical',
    suggestedActions: [
      { label: '🚨 View SLA Breaches', action: 'LIST_SLA_BREACHES' }
    ]
  },
  QueryRevenueMetrics: {
    code: 'QueryRevenueMetrics',
    role: 'admin',
    label: '📈 Platform Revenue & Commission Totals',
    priority: 'Medium',
    suggestedActions: [
      { label: '📊 View Revenue Dashboard', action: 'VIEW_REVENUE' }
    ]
  },
  QueryActiveBookings: {
    code: 'QueryActiveBookings',
    role: 'admin',
    label: '📊 Query Live Active Bookings',
    priority: 'Medium',
    suggestedActions: [
      { label: '⚡ Active Dispatch List', action: 'LIST_ACTIVE_BOOKINGS' }
    ]
  },
  UpdateCommissionConfig: {
    code: 'UpdateCommissionConfig',
    role: 'admin',
    label: '⚙️ Modify Platform Commission Rates',
    priority: 'High',
    suggestedActions: [
      { label: '⚙️ Open Commission Settings', action: 'CONFIG_COMMISSION' }
    ]
  },

  // === CROSS-CUTTING FALLBACK & ESCALATION ===
  FallbackIntent: {
    code: 'FallbackIntent',
    role: 'all',
    label: '❓ Unrecognized Query',
    priority: 'Low',
    suggestedActions: [
      { label: '📅 Book Service', action: 'BookService' },
      { label: '💬 Talk to Admin', action: 'EscalateToHuman' }
    ]
  },
  EscalateToHuman: {
    code: 'EscalateToHuman',
    role: 'all',
    label: '🎧 Escalating to Admin Support',
    priority: 'Critical',
    suggestedActions: [
      { label: '🚨 Contact Admin Support', action: 'EscalateToHuman' }
    ]
  }
};

// System prompt for Gemini AI NLU Intent Classifier
const INTENT_CLASSIFIER_PROMPT = `
You are the official AI Intent & Entity Extraction Classifier for the SmartFix platform operating in Sivagangai District, Tamil Nadu.
Your job is to analyze user queries (in English, Tamil script, or transliterated Tanglish) and classify them into exactly ONE intent from the taxonomy.

Covered Sivagangai District Taluks: Sivagangai, Manamadurai, Ilayangudi, Singampunari, Kalayarkoil, Tirupathur, Devakottai, Karaikudi.
Covered Categories: Plumbing, Electrical, Carpentry, Painting, Cleaning, AC/Appliance Repair.

Intent Set:
CUSTOMER: GreetIntent, CheckServiceArea, AskPricing, BookService, CheckBookingStatus, TrackWorker, RescheduleBooking, CancelBooking, RaiseComplaint, CheckWalletBalance, RedeemWalletBonus, RateWorker, RequestRefund, SwitchLanguage
WORKER: CheckKYCStatus, SubmitKYCDocs, CheckIncomingJobs, AcceptJobRequest, DeclineJobRequest, UpdateJobStatus, CheckEarnings, AskCommissionRate, UpdateAvailability, RaiseSupportTicket
ADMIN: QueryPendingKYC, QuerySLABreaches, QueryRevenueMetrics, QueryActiveBookings, UpdateCommissionConfig
COMMON: FallbackIntent, EscalateToHuman

CRITICAL CLASSIFICATION RULE:
- General repair questions, problem descriptions (e.g. "my ac is leaking", "how to fix tap", "fridge not cooling", "mcb tripping"), diagnostic inquiries, and troubleshooting MUST NOT be classified as 'BookService'. Classify them as 'FallbackIntent' (or 'AskPricing' if asking about cost/fare).
- Classify as 'BookService' ONLY when the user explicitly requests to book or hire a technician (e.g., "book a plumber", "hire electrician", "schedule repair").

Respond STRICTLY in valid JSON matching this structure:
{
  "intent": "IntentName",
  "confidence": 0.0 to 1.0,
  "language": "en | ta | tanglish",
  "isSafetyRisk": boolean,
  "entities": {
    "service_category": "Plumbing | Electrical | Carpentry | Painting | Cleaning | AC/Appliance Repair | null",
    "sub_service": "string or null",
    "taluk": "Sivagangai | Manamadurai | Ilayangudi | Singampunari | Kalayarkoil | Tirupathur | Devakottai | Karaikudi | null",
    "booking_id": "string (e.g. SF-20394) or null",
    "date_time": "string or null",
    "phone_number": "E.164 string or null",
    "wallet_amount": number or null,
    "rating": number (1-5) or null,
    "issue_type": "string or null"
  }
}
`;

/**
 * Validates whether a location string corresponds to one of the 8 Sivagangai Taluks
 */
function isTalukCovered(locationText) {
  if (!locationText) return { isCovered: false, matchedTaluk: null };
  const norm = locationText.toLowerCase();
  for (const taluk of SIVAGANGAI_TALUKS) {
    if (norm.includes(taluk.toLowerCase())) {
      return { isCovered: true, matchedTaluk: taluk };
    }
  }
  return { isCovered: false, matchedTaluk: null };
}

/**
 * Normalizes and extracts standard entities from message text
 */
function extractStandardEntities(text) {
  const q = text.toLowerCase();
  let service_category = null;
  let sub_service = null;
  let taluk = null;
  let booking_id = null;
  let phone_number = null;
  let wallet_amount = null;
  let rating = null;

  // 1. Taluk extraction
  const talukCheck = isTalukCovered(text);
  if (talukCheck.isCovered) {
    taluk = talukCheck.matchedTaluk;
  }

  // 2. Booking ID regex match (SF-XXXXX or 24-char Mongo ID)
  const bookingMatch = text.match(/\b(SF-\d{4,8}|[a-f0-9]{24})\b/i);
  if (bookingMatch) {
    booking_id = bookingMatch[1];
  }

  // 3. Phone Number regex match (+91 or 10 digits)
  const phoneMatch = text.match(/(\+91[\s-]?)?[6-9]\d{9}\b/);
  if (phoneMatch) {
    phone_number = phoneMatch[0].replace(/[\s-]/g, '');
  }

  // 4. Rating match (1-5 stars)
  const ratingMatch = text.match(/([1-5])\s*(star|stars|⭐|\/5)/i);
  if (ratingMatch) {
    rating = parseInt(ratingMatch[1], 10);
  }

  // 5. Category & Sub-service extraction
  if (q.includes('plumb') || q.includes('water') || q.includes('tap') || q.includes('pipe') || q.includes('leak')) {
    service_category = 'Plumbing';
    if (q.includes('tap')) sub_service = 'Tap leak repair';
    else if (q.includes('pipe')) sub_service = 'Pipe burst repair';
    else if (q.includes('drain')) sub_service = 'Drain blockage clearing';
    else if (q.includes('tank')) sub_service = 'Overhead tank repair';
  } else if (q.includes('electr') || q.includes('mcb') || q.includes('fan') || q.includes('wire') || q.includes('switch') || q.includes('light')) {
    service_category = 'Electrical';
    if (q.includes('mcb')) sub_service = 'MCB tripping fix';
    else if (q.includes('fan')) sub_service = 'Ceiling fan repair/install';
    else if (q.includes('switch')) sub_service = 'Switchboard wiring';
  } else if (q.includes('carpent') || q.includes('wood') || q.includes('door') || q.includes('shelf') || q.includes('latch')) {
    service_category = 'Carpentry';
    if (q.includes('door')) sub_service = 'Door latch/hinge repair';
    else if (q.includes('furniture')) sub_service = 'Furniture assembly';
  } else if (q.includes('paint') || q.includes('wall') || q.includes('putty')) {
    service_category = 'Painting';
    if (q.includes('touch')) sub_service = 'Touch-up wall painting';
    else if (q.includes('full')) sub_service = 'Full room painting';
  } else if (q.includes('clean') || q.includes('bath') || q.includes('kitchen') || q.includes('sofa')) {
    service_category = 'Cleaning';
    if (q.includes('deep')) sub_service = 'Deep home cleaning';
    else if (q.includes('bath')) sub_service = 'Bathroom deep clean';
  } else if (q.includes('ac') || q.includes('cool') || q.includes('fridge') || q.includes('wash') || q.includes('purifier') || q.includes('ro')) {
    service_category = 'AC/Appliance Repair';
    if (q.includes('ac')) sub_service = 'AC water leakage fix';
    else if (q.includes('fridge')) sub_service = 'Refrigerator defrost issue';
    else if (q.includes('wash')) sub_service = 'Washing machine drain pump';
  }

  // 6. Wallet amount match (e.g. ₹150, rs 200, 150 rupees)
  const walletMatch = text.match(/(?:₹|rs\.?|rupees?\s*)(\d+)/i) || text.match(/(\d+)\s*(?:₹|rs\.?|rupees?)/i);
  if (walletMatch) {
    wallet_amount = parseInt(walletMatch[1], 10);
  }

  return {
    service_category,
    sub_service,
    taluk,
    booking_id,
    phone_number,
    wallet_amount,
    rating
  };
}

/**
 * Classifies user intent using Gemini LLM API with confidence threshold check (0.70)
 * and falls back to robust rule-based pattern matching.
 */
async function detectLiveIntent(messageText, history = [], imageBase64 = null, userRole = 'customer') {
  const text = (messageText || '').trim();
  const extractedEntities = extractStandardEntities(text);

  // 1. Attempt LLM NLU intent classification
  if (text || imageBase64) {
    try {
      const prompt = `User Query: "${text || 'Media attachment'}" (User Role: ${userRole})`;
      const aiResult = await callGeminiJsonApi(prompt, INTENT_CLASSIFIER_PROMPT, imageBase64);

      if (aiResult && aiResult.intent && SUPPORTED_INTENTS[aiResult.intent]) {
        const confidence = Number(aiResult.confidence) || 0.85;

        // Enforce confidence threshold of 0.70
        if (confidence >= 0.70) {
          const intentDef = SUPPORTED_INTENTS[aiResult.intent];
          const mergedEntities = { ...extractedEntities, ...(aiResult.entities || {}) };

          return {
            intent: aiResult.intent,
            label: intentDef.label,
            role: intentDef.role,
            confidence,
            language: aiResult.language || 'en',
            isSafetyRisk: !!aiResult.isSafetyRisk,
            entities: mergedEntities,
            suggestedActions: intentDef.suggestedActions,
          };
        }
      }
    } catch (e) {
      console.warn('AI LLM intent classification error, using fallback:', e.message);
    }
  }

  // 2. High-speed rule-based fallback pattern matcher
  return detectFallbackIntent(text, userRole, extractedEntities);
}

/**
 * Rule-based fallback classifier covering English & Tamil/Tanglish
 */
function detectFallbackIntent(text, userRole = 'customer', predefinedEntities = null) {
  const q = text.toLowerCase();
  const entities = predefinedEntities || extractStandardEntities(text);

  let intentKey = 'FallbackIntent';
  let isSafetyRisk = false;
  let language = 'en';

  // Check language
  if (q.includes('vanakkam') || q.includes('tanni') || q.includes('odala') || q.includes('illai') || q.includes('vela') || q.includes('iruku') || q.includes('tamil') || q.includes('தமிழ்')) {
    language = 'ta';
  }

  // Common Escalation & Safety Triggers
  if (q.includes('talk to a real person') || q.includes('human') || q.includes('admin') || q.includes('speak to agent') || q.includes('customer care')) {
    intentKey = 'EscalateToHuman';
  } else if (q.includes('mcb') || q.includes('short circuit') || q.includes('spark') || q.includes('fire') || q.includes('gas leak') || q.includes('main pipe burst')) {
    intentKey = 'RaiseComplaint';
    isSafetyRisk = true;
  }

  // ROLE-BASED MATCHING
  if (intentKey === 'FallbackIntent') {
    if (userRole === 'admin') {
      if (q.includes('pending kyc') || q.includes('verification queue') || q.includes('kyc list')) {
        intentKey = 'QueryPendingKYC';
      } else if (q.includes('sla') || q.includes('breach') || q.includes('delayed booking')) {
        intentKey = 'QuerySLABreaches';
      } else if (q.includes('revenue') || q.includes('metric') || q.includes('total earnings') || q.includes('platform commission')) {
        intentKey = 'QueryRevenueMetrics';
      } else if (q.includes('active booking') || q.includes('live jobs') || q.includes('running bookings')) {
        intentKey = 'QueryActiveBookings';
      } else if (q.includes('set commission') || q.includes('update commission') || q.includes('commission rate')) {
        intentKey = 'UpdateCommissionConfig';
      }
    } else if (userRole === 'handyman' || userRole === 'worker') {
      if (q.includes('kyc') || q.includes('approved') || q.includes('verification status')) {
        intentKey = 'CheckKYCStatus';
      } else if (q.includes('upload id') || q.includes('aadhaar') || q.includes('license') || q.includes('submit document')) {
        intentKey = 'SubmitKYCDocs';
      } else if (q.includes('new jobs') || q.includes('incoming') || q.includes('job requests')) {
        intentKey = 'CheckIncomingJobs';
      } else if (q.includes('accept') || q.includes('accept job')) {
        intentKey = 'AcceptJobRequest';
      } else if (q.includes('decline') || q.includes('reject job') || q.includes('can\'t take')) {
        intentKey = 'DeclineJobRequest';
      } else if (q.includes('on my way') || q.includes('en route') || q.includes('arrived') || q.includes('job done') || q.includes('completed')) {
        intentKey = 'UpdateJobStatus';
      } else if (q.includes('earning') || q.includes('payout') || q.includes('weekly income')) {
        intentKey = 'CheckEarnings';
      } else if (q.includes('commission percentage') || q.includes('what is the commission')) {
        intentKey = 'AskCommissionRate';
      } else if (q.includes('offline') || q.includes('online') || q.includes('availability') || q.includes('duty status')) {
        intentKey = 'UpdateAvailability';
      } else if (q.includes('support ticket') || q.includes('report customer') || q.includes('wrong address')) {
        intentKey = 'RaiseSupportTicket';
      }
    }

    // CUSTOMER INTENTS (or fallback for general users)
    if (intentKey === 'FallbackIntent') {
      if (q.includes('cancel')) {
        intentKey = 'CancelBooking';
      } else if (q.includes('reschedule') || q.includes('change date') || q.includes('move to')) {
        intentKey = 'RescheduleBooking';
      } else if (q.includes('status') || q.includes('where is my booking') || q.includes('sf-')) {
        intentKey = 'CheckBookingStatus';
      } else if (q.includes('where is the worker') || q.includes('track') || q.includes('eta') || q.includes('how long till')) {
        intentKey = 'TrackWorker';
      } else if (q.includes('redeem') || q.includes('use my wallet')) {
        intentKey = 'RedeemWalletBonus';
      } else if (q.includes('wallet balance') || q.includes('cashback') || q.includes('bonus balance') || q.includes('wallet')) {
        intentKey = 'CheckWalletBalance';
      } else if (q.includes('star') || q.includes('rating') || q.includes('review') || q.includes('rate worker') || q.includes('was great')) {
        intentKey = 'RateWorker';
      } else if (q.includes('refund')) {
        intentKey = 'RequestRefund';
      } else if (q.includes('complaint') || q.includes('never showed') || q.includes('bad service') || q.includes('taking too long')) {
        intentKey = 'RaiseComplaint';
      } else if (q.includes('english') || q.includes('tamil-la pesu') || q.includes('switch to english') || q.includes('tamil')) {
        intentKey = 'SwitchLanguage';
      } else if (q.includes('serve') || q.includes('covered') || q.includes('service area') || q.includes('karaikudi') || q.includes('sivagangai') || q.includes('taluk')) {
        intentKey = 'CheckServiceArea';
      } else if (q.includes('cost') || q.includes('price') || q.includes('rate') || q.includes('charge') || q.includes('how much') || q.includes('fare')) {
        intentKey = 'AskPricing';
      } else if (/\b(book|hire|schedule|reserve)\b/i.test(q) || q.includes('need plumber') || q.includes('need electrician') || q.includes('want to book') || q.includes('need to book')) {
        intentKey = 'BookService';
      } else if (/\b(hi|hello|hey|vanakkam|good morning)\b/i.test(q)) {
        intentKey = 'GreetIntent';
      }
    }
  }

  const intentDef = SUPPORTED_INTENTS[intentKey] || SUPPORTED_INTENTS.FallbackIntent;
  const confidence = intentKey === 'FallbackIntent' ? 0.40 : 0.88;

  return {
    intent: intentDef.code,
    label: intentDef.label,
    role: intentDef.role,
    confidence,
    language,
    isSafetyRisk,
    entities,
    suggestedActions: intentDef.suggestedActions
  };
}

module.exports = {
  detectLiveIntent,
  isTalukCovered,
  extractStandardEntities,
  SIVAGANGAI_TALUKS,
  SERVICE_CATEGORIES,
  SUPPORTED_INTENTS,
};

