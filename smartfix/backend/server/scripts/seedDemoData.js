#!/usr/bin/env node
/**
 * SmartFix Demo Data Seeder
 * ─────────────────────────────────────────────────────────────────
 * Generates realistic demo data for dashboards and charts.
 *
 * Usage:
 *   npm run seed:demo               # seed with defaults
 *   npm run seed:demo -- --customers=50 --workers=20 --bookings=300 --reviews=180
 *   npm run seed:demo:clear         # remove all isDemo documents
 *
 * NEVER runs automatically on server start.
 * Refuses to run in NODE_ENV=production.
 * Every generated document carries isDemo: true.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Safety guard — must be the very first check ───────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('\n❌  REFUSED: seedDemoData.js must not run in production.\n');
  process.exit(1);
}

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const dns      = require('dns');

// ── Models ────────────────────────────────────────────────────────
const User    = require('../../models/User');
const Booking = require('../../models/Booking');

// ── Service categories (official SmartFix list) ───────────────────
const { SERVICE_CATEGORIES } = require('../../config/serviceCategories');

// ── AI service (Groq) ─────────────────────────────────────────────
const { askGroqJSON } = require('../../services/aiService');

// ══════════════════════════════════════════════════════════════════
//  CLI ARGUMENT PARSING
// ══════════════════════════════════════════════════════════════════
function parseArgs() {
  const args   = process.argv.slice(2);
  const get    = (key, def) => {
    const found = args.find(a => a.startsWith(`--${key}=`));
    return found ? parseInt(found.split('=')[1], 10) : def;
  };
  const hasFlag = flag => args.includes(flag);
  return {
    customers : get('customers', 30),
    workers   : get('workers',   15),
    bookings  : get('bookings',  200),
    reviews   : get('reviews',   120),
    clear     : hasFlag('--clear'),
  };
}

// ══════════════════════════════════════════════════════════════════
//  STATIC DATA  — Tamil names, addresses, phone ranges, etc.
// ══════════════════════════════════════════════════════════════════

// Phone numbers in an obviously fake range: +91 700-000-xxxx
// Base is time-randomized so re-runs don't collide
const FAKE_PHONE_BASE = 7000000000;
let phoneCounter = Date.now() % 1000000; // Start from a pseudo-random offset
function nextFakePhone() {
  phoneCounter += 1;
  const suffix = (phoneCounter % 10000000).toString().padStart(7, '0');
  return `+91700${suffix}`;
}

const TAMIL_FIRST_NAMES = [
  'Arjun','Karthik','Murugan','Selvam','Ravi','Balamurugan','Vijay',
  'Senthil','Mani','Durai','Ganesan','Anand','Surya','Rajesh',
  'Prasanth','Suresh','Dinesh','Venkat','Hariharan','Kumaresan',
  'Priya','Kavitha','Meena','Lakshmi','Nithya','Saranya','Deepa',
  'Sangeetha','Malathi','Revathi','Tamilarasi','Kokilam','Vasantha',
  'Padmavathi','Sumathi','Sundari','Jayanthi','Kalpana','Umarani',
  'Nalini','Bhavani','Indhumathi','Ponniyin','Valli','Sathya',
  'Sivakami','Rajalakshmi','Annamalai','Thirumalai','Ponnusamy',
];

const TAMIL_LAST_NAMES = [
  'Pillai','Nadar','Chettiar','Mudaliar','Gounder','Palaniswamy',
  'Krishnamurthy','Subramanian','Ramasamy','Venkatesan','Arunachalam',
  'Marimuthu','Thangavelu','Palanivel','Sivakumar','Periasamy',
  'Natarajan','Sundaram','Kandasamy','Velusamy',
];

// All 8 Sivagangai taluks with realistic lat/lng bounding boxes
const SIVAGANGAI_TALUKS = [
  { name: 'Sivagangai',   lat: [9.80, 9.88],   lng: [78.44, 78.56] },
  { name: 'Karaikudi',    lat: [10.04, 10.09],  lng: [78.75, 78.82] },
  { name: 'Devakottai',   lat: [9.93, 9.97],    lng: [78.81, 78.89] },
  { name: 'Manamadurai',  lat: [9.67, 9.72],    lng: [78.44, 78.52] },
  { name: 'Ilayangudi',   lat: [9.86, 9.91],    lng: [78.61, 78.68] },
  { name: 'Singampunari', lat: [10.13, 10.17],  lng: [78.52, 78.58] },
  { name: 'Tirupattur',   lat: [9.94, 9.99],    lng: [78.54, 78.60] },
  { name: 'Kalayarkoil',  lat: [9.91, 9.95],    lng: [78.65, 78.72] },
];

const STREET_PREFIXES = ['Anna','Gandhi','Nehru','Bharathi','Periyar','MGR','Rajaji'];
const STREET_TYPES    = ['Street','Road','Nagar','Colony','Layout','Main Road'];

// ── helpers ───────────────────────────────────────────────────────
function randomInt(min, max)   { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr)             { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n)         { return [...arr].sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length)); }
function randFloat(min, max)   { return parseFloat((Math.random() * (max - min) + min).toFixed(6)); }
function daysAgo(d)            { return new Date(Date.now() - d * 24 * 60 * 60 * 1000); }
function randomTamilName()     { return `${pick(TAMIL_FIRST_NAMES)} ${pick(TAMIL_LAST_NAMES)}`; }

function randomAddress(taluk) {
  const no     = randomInt(1, 250);
  const street = `${pick(STREET_PREFIXES)} ${pick(STREET_TYPES)}`;
  return `${no}, ${street}, ${taluk.name}, Sivagangai District, Tamil Nadu`;
}
function randomTalukCoord(taluk) {
  return {
    lat: randFloat(taluk.lat[0], taluk.lat[1]),
    lng: randFloat(taluk.lng[0], taluk.lng[1]),
  };
}

// ══════════════════════════════════════════════════════════════════
//  BOOKING STATUS DISTRIBUTION
// ══════════════════════════════════════════════════════════════════
// Mostly Completed/Reviewed, some Cancelled, a few SLABreached
const STATUS_WEIGHTS = [
  { status: 'Reviewed',    weight: 45 },
  { status: 'Completed',   weight: 20 },
  { status: 'Paid',        weight: 10 },
  { status: 'Cancelled',   weight: 15 },
  { status: 'SLABreached', weight:  5 },
  { status: 'Accepted',    weight:  3 },
  { status: 'EnRoute',     weight:  2 },
];
const TOTAL_WEIGHT = STATUS_WEIGHTS.reduce((s, w) => s + w.weight, 0);

function randomStatus() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const { status, weight } of STATUS_WEIGHTS) {
    r -= weight;
    if (r <= 0) return status;
  }
  return 'Reviewed';
}

function randomPrice() {
  return pick([199, 299, 399, 499, 599, 699, 799, 999, 1299, 1499, 1999]);
}

// ══════════════════════════════════════════════════════════════════
//  FALLBACK TEXTS  (used if AI call fails)
// ══════════════════════════════════════════════════════════════════
const FALLBACK_REVIEWS = [
  'Very good work. Quick and clean service.',
  'Nalla velai pannaanga. Satisfied.',
  'AC now running perfectly. Happy with the service!',
  'Tap was leaking for days, fixed in 20 minutes. 👍',
  'Motor sound pochi, repair panni koduthe. Romba nandri.',
  'Washing machine back to normal. Fast response.',
  'Service okay. Could have been faster.',
  'Technician was polite and explained everything clearly.',
  'Refrigerator freezing issue solved quickly.',
  'Purifier filter change panni neat ah clean panni poanaar.',
  'Good work but came a bit late.',
  'Excellent service! Will book again for AC service.',
  'Switch board fix aagidichi. Enga family happy.',
  'Price reasonable, work quality top class.',
  'Prompt service. Worker was professional.',
  'Romba satisfied! Time la vandhu problem solve pannaaanga.',
  'Good 👍 but price konjam jaasthi.',
  'Water leakage problem fully solved. No complaints.',
  'Washing machine drum fixed properly. Thanks!',
  'Quick service. Will recommend to friends.',
];

const FALLBACK_DESCRIPTIONS = [
  'AC not cooling properly, need gas refill check.',
  'Pipe leaking under kitchen sink since morning.',
  'Ceiling fan not working, makes noise when switched on.',
  'Refrigerator not freezing ice properly.',
  'Washing machine drum not spinning correctly.',
  'RO purifier filter needs replacement, water tastes bad.',
  'MCB trips frequently when AC is turned on.',
  'Bathroom tap dripping constantly, need new washer.',
  'AC water leaking from indoor unit.',
  'Inverter battery not charging, power backup gone.',
  'Toilet flush not working properly.',
  'Light tube blinking, might need replacement.',
  'Water purifier UV lamp issue, water not purified.',
  'Fridge making strange noise at night.',
  'Washing machine not draining water after cycle.',
];

// ══════════════════════════════════════════════════════════════════
//  AI-GENERATED TEXTS  (single batched Groq call, then fallback)
// ══════════════════════════════════════════════════════════════════

/** Try to find an available Groq text model by querying /models endpoint */
async function resolveGroqModel() {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return 'llama-3.1-8b-instant'; // let aiService handle the error
  // Preferred models in priority order
  const PREFERRED = [
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'llama3-8b-8192',
    'gemma2-9b-it',
    'mixtral-8x7b-32768',
  ];
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    });
    if (!res.ok) return PREFERRED[0];
    const data = await res.json();
    const ids = (data.data || []).map(m => m.id);
    for (const m of PREFERRED) {
      if (ids.includes(m)) {
        console.log(`  🤖  Using Groq model: ${m}`);
        return m;
      }
    }
    return ids.find(id => !id.includes('whisper') && !id.includes('guard')) || PREFERRED[0];
  } catch {
    return PREFERRED[0];
  }
}

async function fetchAITexts(reviewCount, descCount) {
  console.log('\n🤖  Fetching AI-generated texts from Groq (single batched call)…');
  const model = await resolveGroqModel();
  try {
    const result = await askGroqJSON({
      system: [
        'You are a generator of realistic Tamil/Tanglish text for a home-service app in Sivagangai, Tamil Nadu.',
        'Output ONLY valid JSON matching exactly the schema provided. No extra keys.',
      ].join('\n'),
      user: [
        `Generate a JSON object with exactly two arrays:`,
        `1. "reviews": array of ${reviewCount} short customer review strings (50-120 chars each).`,
        `   Mix of English, Tamil (romanized), and Tanglish. Varied sentiment (praise, mild complaint, mixed).`,
        `   Topics: plumbing, electrical, AC, refrigerator, washing machine, water purifier.`,
        `2. "descriptions": array of ${descCount} short problem description strings (40-100 chars each).`,
        `   These are what customers type when booking. Realistic, casual language.`,
        ``,
        `Return ONLY this JSON: { "reviews": [...], "descriptions": [...] }`,
      ].join('\n'),
      maxTokens: 4000,
      model,
    });

    if (
      result &&
      Array.isArray(result.reviews)      && result.reviews.length      >= reviewCount &&
      Array.isArray(result.descriptions) && result.descriptions.length >= descCount
    ) {
      console.log('  ✅  AI texts fetched successfully.');
      return {
        reviews:      result.reviews.slice(0, reviewCount),
        descriptions: result.descriptions.slice(0, descCount),
      };
    }
    throw new Error('AI response failed schema validation');
  } catch (err) {
    console.warn(`  ⚠️  AI call failed (${err.message}). Falling back to built-in texts.`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════
//  CONNECT TO DB
// ══════════════════════════════════════════════════════════════════
async function connectDB() {
  const uri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix').trim();
  if (uri.startsWith('mongodb+srv://')) {
    try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_) {}
  }
  const isPrimaryLocal = uri.includes('127.0.0.1') || uri.includes('localhost');
  await mongoose.connect(uri, {
    family: 4,
    serverSelectionTimeoutMS: 8000,
    ...(isPrimaryLocal ? { directConnection: true } : {}),
  });
  console.log(`✅  MongoDB connected: ${mongoose.connection.host}`);
}

// ══════════════════════════════════════════════════════════════════
//  CLEAR DEMO DATA  (only isDemo: true — real data NEVER touched)
// ══════════════════════════════════════════════════════════════════
async function clearDemoData() {
  console.log('\n🗑️  Clearing all demo documents (isDemo: true)…');
  const [users, bookings] = await Promise.all([
    User.deleteMany({ isDemo: true }),
    Booking.deleteMany({ isDemo: true }),
  ]);
  console.log(`  Deleted ${users.deletedCount} demo users (customers + workers)`);
  console.log(`  Deleted ${bookings.deletedCount} demo bookings (includes reviews)`);
  console.log('\n✅  Demo data cleared. Real data untouched.\n');
}

// ══════════════════════════════════════════════════════════════════
//  SEED CUSTOMERS
// ══════════════════════════════════════════════════════════════════
async function seedCustomers(count) {
  console.log(`\n👥  Seeding ${count} demo customers…`);
  const password = await bcrypt.hash('DemoPass@123', 10);
  const docs = [];

  for (let i = 0; i < count; i++) {
    const taluk = pick(SIVAGANGAI_TALUKS);
    const coord = randomTalukCoord(taluk);
    docs.push({
      name              : randomTamilName(),
      phone             : nextFakePhone(),
      email             : `demo.cust${i + 1}@smartfix.demo`,
      password,
      role              : 'customer',
      location          : randomAddress(taluk),
      lat               : coord.lat,
      lng               : coord.lng,
      locationPoint     : { type: 'Point', coordinates: [coord.lng, coord.lat] },
      preferredLanguage : pick(['en', 'ta']),
      phoneVerified     : true,
      isDemo            : true,
    });
  }

  // Use insertMany to bypass the pre-save hook (password is already hashed)
  const inserted = await User.insertMany(docs, { ordered: false });
  console.log(`  ✅  Inserted ${inserted.length} demo customers`);
  return inserted;
}

// ══════════════════════════════════════════════════════════════════
//  SEED WORKERS
// ══════════════════════════════════════════════════════════════════
async function seedWorkers(count) {
  console.log(`\n🔧  Seeding ${count} demo workers…`);
  const password = await bcrypt.hash('DemoPass@123', 10);
  const trades   = SERVICE_CATEGORIES.map(c => c.trade);
  const docs     = [];

  for (let i = 0; i < count; i++) {
    const taluk       = pick(SIVAGANGAI_TALUKS);
    const coord       = randomTalukCoord(taluk);
    const trade       = trades[i % trades.length]; // distribute evenly across all 6 categories
    const category    = SERVICE_CATEGORIES.find(c => c.trade === trade);
    const subServices = pickN(category.subServices, randomInt(2, 4));
    const rating      = parseFloat(randFloat(3.5, 5.0).toFixed(1));
    const ratingCount = randomInt(10, 120);
    const jobsDone    = randomInt(ratingCount, ratingCount * 2);

    docs.push({
      name              : randomTamilName(),
      phone             : nextFakePhone(),
      email             : `demo.worker${i + 1}@smartfix.demo`,
      password,
      role              : 'handyman',
      trade,
      subServices,
      location          : randomAddress(taluk),
      lat               : coord.lat,
      lng               : coord.lng,
      locationPoint     : { type: 'Point', coordinates: [coord.lng, coord.lat] },
      availabilityStatus: pick(['Available', 'Busy', 'Offline']),
      isAvailable       : Math.random() > 0.4,
      isOnline          : Math.random() > 0.5,
      verificationStatus: 'Verified',
      overallStatus     : 'approved',
      identity          : { status: 'verified', verifiedAt: daysAgo(randomInt(30, 180)) },
      skill             : { status: 'verified', verifiedAt: daysAgo(randomInt(30, 180)) },
      rating,
      ratingCount,
      jobsOffered       : jobsDone + randomInt(0, 20),
      jobsAccepted      : jobsDone,
      ratePerHour       : randomInt(200, 600),
      serviceTier       : pick(['BikePro', 'AutoHandyman', 'MasterTech']),
      trustedWorkerBadge: rating >= 4.5 && ratingCount >= 50,
      preferredLanguage : pick(['en', 'ta']),
      phoneVerified     : true,
      // ID proof: placeholder only — no real Aadhaar numbers
      idProofType       : pick(['driving_license', 'voter_id', 'pan_card']),
      idProofNumber     : `DEMO-PLACEHOLDER-${i + 1}`,
      aadhaarNumber     : 'DEMO-PLACEHOLDER',
      isDemo            : true,
    });
  }

  const inserted = await User.insertMany(docs, { ordered: false });
  console.log(`  ✅  Inserted ${inserted.length} demo workers`);
  return inserted;
}

// ══════════════════════════════════════════════════════════════════
//  SEED BOOKINGS  (with embedded reviews)
// ══════════════════════════════════════════════════════════════════
async function seedBookings(customers, workers, targetBookings, targetReviews, texts) {
  console.log(`\n📋  Seeding ${targetBookings} demo bookings…`);

  const getReviewText = () =>
    texts ? texts.reviews[randomInt(0, texts.reviews.length - 1)] : pick(FALLBACK_REVIEWS);

  const getDescription = () =>
    texts ? texts.descriptions[randomInt(0, texts.descriptions.length - 1)] : pick(FALLBACK_DESCRIPTIONS);

  const docs = [];
  let reviewsSeeded = 0;

  for (let i = 0; i < targetBookings; i++) {
    const customer  = pick(customers);
    const worker    = pick(workers);
    const category  = pick(SERVICE_CATEGORIES);
    const subServices = pickN(category.subServices, randomInt(1, 2));
    const status    = randomStatus();
    const daysBack  = randomInt(0, 90);
    const createdAt = daysAgo(daysBack);
    const taluk     = pick(SIVAGANGAI_TALUKS);
    const coord     = randomTalukCoord(taluk);
    const price     = randomPrice();
    const commission       = 10;
    const commissionAmount = parseFloat((price * commission / 100).toFixed(2));
    const providerPayout   = parseFloat((price * 0.9).toFixed(2));

    const isReviewed  = status === 'Reviewed' && reviewsSeeded < targetReviews;
    const isCompleted = ['Completed', 'Paid', 'Reviewed'].includes(status);
    const isCancelled = ['Cancelled', 'SLABreached'].includes(status);

    // Status transition timestamps (realistic chain)
    const acceptedAt  = new Date(createdAt.getTime() + randomInt(2, 15)  * 60_000);
    const enRouteAt   = new Date(acceptedAt.getTime() + randomInt(1, 5)  * 60_000);
    const arrivedAt   = new Date(enRouteAt.getTime()  + randomInt(10, 45) * 60_000);
    const startedAt   = new Date(arrivedAt.getTime()  + randomInt(2, 10) * 60_000);
    const completedAt = isCompleted ? new Date(startedAt.getTime()    + randomInt(30, 120) * 60_000) : undefined;
    const paidAt      = ['Paid','Reviewed'].includes(status)
      ? new Date(completedAt.getTime() + randomInt(1, 30) * 60_000) : undefined;
    const reviewedAt  = isReviewed
      ? new Date(paidAt.getTime() + randomInt(5, 60) * 60_000) : undefined;
    const cancelledAt = isCancelled
      ? new Date(acceptedAt.getTime() + randomInt(10, 40) * 60_000) : undefined;

    const slaDeadline = new Date(acceptedAt.getTime() + 60 * 60_000); // 60-min SLA
    const slaBreached = status === 'SLABreached';
    const rating      = isReviewed ? randomInt(3, 5) : undefined;

    docs.push({
      customer          : customer._id,
      worker            : worker._id,
      trade             : category.trade,
      subServices,
      date              : createdAt.toISOString().split('T')[0],
      time              : `${String(randomInt(8, 20)).padStart(2, '0')}:${pick(['00','15','30','45'])}`,
      address           : randomAddress(taluk),
      notes             : getDescription(),
      price,
      status,
      serviceTier       : worker.serviceTier || 'AutoHandyman',
      userLat           : coord.lat,
      userLng           : coord.lng,
      pickupLat         : coord.lat,
      pickupLng         : coord.lng,
      distanceKm        : parseFloat(randFloat(0.5, 5.0).toFixed(1)),
      estimatedMinutes  : randomInt(10, 55),
      paymentStatus     : ['Paid','Reviewed'].includes(status) ? 'Paid' : 'Unpaid',
      paymentMethod     : ['Paid','Reviewed'].includes(status) ? pick(['UPI','COD','Card']) : 'None',
      commissionPercent : commission,
      commissionAmount,
      providerPayout,
      acceptedAt,
      slaDeadline,
      slaBreached,
      enRouteAt,
      arrivedAt,
      startedAt,
      completedAt,
      paidAt,
      reviewedAt,
      cancelledAt,
      cancelledBy: isCancelled ? pick(['customer','worker','system']) : undefined,
      cancellationReason: isCancelled ? pick([
        'Customer not available at location',
        'Worker had an emergency',
        'Service not required anymore',
        'Incorrect address provided',
        'No response from customer',
      ]) : undefined,
      // Embedded review fields
      rating,
      review                 : isReviewed ? getReviewText()         : undefined,
      customerRatingForWorker: isReviewed ? rating                  : undefined,
      workerRatingForCustomer: isReviewed ? randomInt(3, 5)         : undefined,
      isDemo    : true,
      createdAt,
      updatedAt : isReviewed ? reviewedAt : (isCancelled ? cancelledAt : arrivedAt),
    });

    if (isReviewed) reviewsSeeded++;
  }

  const inserted = await Booking.insertMany(docs, { ordered: false });
  console.log(`  ✅  Inserted ${inserted.length} demo bookings`);
  console.log(`  📝  ${reviewsSeeded} include embedded reviews`);
  return { inserted, reviewsSeeded };
}

// ══════════════════════════════════════════════════════════════════
//  WORKER STATS REFRESH  (recalculate rating from demo bookings)
// ══════════════════════════════════════════════════════════════════
async function refreshWorkerStats(workerIds) {
  console.log('\n📊  Refreshing worker stats from demo bookings…');
  let updated = 0;

  for (const wid of workerIds) {
    const completed = await Booking.find({
      worker : wid,
      isDemo : true,
      status : { $in: ['Completed','Paid','Reviewed'] },
    }).lean();

    const reviewed    = completed.filter(b => b.rating != null);
    const ratingCount = reviewed.length;
    const rating      = ratingCount > 0
      ? parseFloat((reviewed.reduce((s, b) => s + b.rating, 0) / ratingCount).toFixed(1))
      : null;

    await User.updateOne({ _id: wid, isDemo: true }, {
      $set: { rating, ratingCount, jobsAccepted: completed.length },
    });
    updated++;
  }

  console.log(`  ✅  Updated stats for ${updated} demo workers`);
}

// ══════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════
async function main() {
  const args = parseArgs();

  await connectDB();

  if (args.clear) {
    await clearDemoData();
    await mongoose.disconnect();
    return;
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  SmartFix Demo Data Seeder');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Customers : ${args.customers}`);
  console.log(`  Workers   : ${args.workers}`);
  console.log(`  Bookings  : ${args.bookings}`);
  console.log(`  Reviews   : ${args.reviews}`);
  console.log('══════════════════════════════════════════════════════\n');

  // 1. AI text batch (with fallback)
  const texts = await fetchAITexts(args.reviews, args.bookings);

  // 2. Users
  const customers = await seedCustomers(args.customers);
  const workers   = await seedWorkers(args.workers);

  // 3. Bookings + embedded reviews
  const { reviewsSeeded } = await seedBookings(
    customers, workers, args.bookings, args.reviews, texts
  );

  // 4. Refresh computed worker stats
  await refreshWorkerStats(workers.map(w => w._id));

  // ── Summary ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ✅  DEMO DATA SEED COMPLETE');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  👥  Customers created  : ${customers.length}`);
  console.log(`  🔧  Workers created    : ${workers.length}`);
  console.log(`  📋  Bookings created   : ${args.bookings}`);
  console.log(`  ⭐  Reviews embedded   : ${reviewsSeeded}`);
  console.log(`  🏷️   All docs tagged   : isDemo = true`);
  console.log('\n  To remove demo data run:  npm run seed:demo:clear');
  console.log('══════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('\n❌  Seed failed:', err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
