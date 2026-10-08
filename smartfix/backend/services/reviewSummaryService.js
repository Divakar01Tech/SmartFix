const Booking = require('../models/Booking');
const User = require('../models/User');
const ReviewFlag = require('../models/ReviewFlag');
const { callGeminiJsonApi } = require('./geminiService');

const SYSTEM_PROMPT = `
You are an AI tasked with summarising customer reviews for a SmartFix service worker.
Rules:
1. Provide a factual summary based ONLY on what the reviewers actually said (e.g. punctuality, work quality, behaviour, pricing).
2. Do not exaggerate. Do not invent claims. 
3. If the reviews are mixed, state this honestly.
4. Provide exactly 1-2 short sentences.
5. Provide the output in both English (en) and Tamil (ta).
6. Truncate each language output to a maximum of 200 characters.
7. Return strictly valid JSON in the format:
{
  "en": "English summary...",
  "ta": "Tamil summary..."
}
`;

async function generateWorkerReviewSummary(workerId) {
  try {
    const worker = await User.findById(workerId);
    if (!worker || worker.role !== 'handyman') return;

    // Get all valid reviews for this worker
    const allBookingsWithReviews = await Booking.find({
      worker: workerId,
      status: 'Paid',
      rating: { $exists: true, $ne: null },
      review: { $exists: true, $ne: null, $ne: '' }
    });

    if (allBookingsWithReviews.length < 3) return;

    // Find all review flags for this worker that are Open or Removed
    const badFlags = await ReviewFlag.find({
      workerId: workerId,
      status: { $in: ['Open', 'Removed'] }
    });
    const badReviewIds = badFlags.map(f => f.reviewId.toString());

    // Filter to only include valid reviews
    const validBookings = allBookingsWithReviews.filter(
      b => !badReviewIds.includes(b._id.toString())
    );

    if (validBookings.length < 3) return;

    // Logic: regenerate if review count grew by 3 since last generation, or if weekly cron forces it (we'll assume cron forces it if it's older than 7 days)
    const currentCount = validBookings.length;
    const previousCount = worker.reviewSummary?.basedOnCount || 0;
    const lastGeneratedAt = worker.reviewSummary?.generatedAt;

    let shouldGenerate = false;
    if (currentCount >= previousCount + 3) {
      shouldGenerate = true;
    } else if (!lastGeneratedAt || (Date.now() - new Date(lastGeneratedAt).getTime() > 7 * 24 * 60 * 60 * 1000)) {
      shouldGenerate = true;
    }

    if (!shouldGenerate) return;

    // Build the prompt string
    let promptString = "Here are the recent reviews for the worker:\n";
    validBookings.forEach((b, i) => {
      promptString += `Review ${i + 1} (Rating: ${b.rating}/5): "${b.review}"\n`;
    });

    // Ask Gemini (since Claude is mentioned in the prompt, but we use geminiService inside this project)
    const summaryJson = await callGeminiJsonApi(promptString, SYSTEM_PROMPT);

    if (summaryJson && summaryJson.en && summaryJson.ta) {
      worker.reviewSummary = {
        en: summaryJson.en.substring(0, 200),
        ta: summaryJson.ta.substring(0, 200),
        basedOnCount: currentCount,
        generatedAt: new Date()
      };
      await worker.save();
      console.log(`[ReviewSummary] Successfully generated summary for worker ${worker.name}`);
    }
  } catch (error) {
    console.error(`[ReviewSummary] Error generating summary for worker ${workerId}:`, error.message);
  }
}

async function processAllEligibleWorkersForSummaries() {
  try {
    const workers = await User.find({ role: 'handyman', ratingCount: { $gte: 3 } });
    for (const worker of workers) {
      await generateWorkerReviewSummary(worker._id);
    }
  } catch (error) {
    console.error('[ReviewSummary] Global processing error:', error.message);
  }
}

const cron = require('node-cron');

function initReviewSummaryCron() {
  // Run once a week on Sunday at 2 AM
  cron.schedule('0 2 * * 0', () => {
    console.log('⏰ Running weekly review summary sweep...');
    processAllEligibleWorkersForSummaries();
  });
}

module.exports = {
  generateWorkerReviewSummary,
  processAllEligibleWorkersForSummaries,
  initReviewSummaryCron
};
