const Booking = require('../models/Booking');
const ReviewFlag = require('../models/ReviewFlag');
const { callGeminiJsonApi } = require('./geminiService');

const getNormalizedTokens = (text) => {
  if (!text) return [];
  return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
};

const getJaccardSimilarity = (tokens1, tokens2) => {
  if (tokens1.length === 0 && tokens2.length === 0) return 1.0;
  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
};

exports.analyzeReview = async (bookingId, customerId, workerId, rating, reviewText, paidAt) => {
  try {
    const signals = [];
    const now = new Date();

    // 1. review submitted within 60s of Paid
    if (paidAt) {
      const timeSincePaid = now.getTime() - new Date(paidAt).getTime();
      if (timeSincePaid < 60000) {
        signals.push('review submitted within 60s of Paid');
      }
    }

    // 2. customer has only 1 lifetime booking and it is 5-star
    const customerBookings = await Booking.find({ customer: customerId });
    if (customerBookings.length === 1 && rating === 5) {
      signals.push('customer has only 1 lifetime booking and it is 5-star');
    }

    // 3. worker received 3+ five-star reviews in 24h
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const workerRecent5Star = await Booking.countDocuments({
      worker: workerId,
      rating: 5,
      reviewedAt: { $gte: twentyFourHoursAgo }
    });
    if (workerRecent5Star >= 3) {
      signals.push('worker received 3+ five-star reviews in 24h');
    }

    // 4. same customer reviewing the same worker repeatedly
    const repeatReviews = customerBookings.filter(b => b.worker?.toString() === workerId.toString() && b.rating);
    // Since this booking is already saved with the review, repeatReviews includes it. We check if >= 2.
    if (repeatReviews.length >= 2) {
      signals.push('same customer reviewing the same worker repeatedly');
    }

    // 5. empty or one-word text with extreme rating
    const tokens = getNormalizedTokens(reviewText);
    if (tokens.length <= 1 && (rating === 5 || rating === 1)) {
      signals.push('empty or one-word text with extreme rating');
    }

    // 6. text is near-duplicate of other reviews
    if (tokens.length > 3) {
      const allWorkerReviews = await Booking.find({ worker: workerId, rating: { $exists: true }, _id: { $ne: bookingId } }).limit(20);
      let isDuplicate = false;
      for (const b of allWorkerReviews) {
        const otherText = b.review || b.workerReview || b.customerRatingForWorker || '';
        const otherTokens = getNormalizedTokens(String(otherText));
        if (otherTokens.length > 3 && getJaccardSimilarity(tokens, otherTokens) > 0.8) {
          isDuplicate = true;
          break;
        }
      }
      if (isDuplicate) {
        signals.push('text is near-duplicate of other reviews');
      }
    }

    // Only if 2+ signals fire, send to AI
    let isSuspicious = false;
    let confidence = 0;
    let reasoning = 'Deterministic signals only.';
    let aiAssessment = '';
    
    if (signals.length >= 2) {
      try {
        const prompt = `Analyze the following review for fake/fraudulent behavior.
Review Text: "${reviewText}"
Rating: ${rating}
Flagged Signals: ${JSON.stringify(signals)}

Respond with strict JSON containing { "suspicious": boolean, "confidence": number, "reasoning": "string" }. Confidence should be between 0 and 1.`;

        const result = await callGeminiJsonApi(prompt, "You are a fraud detection AI. Do NOT output any extra markdown. Only JSON.");
        if (result) {
          isSuspicious = result.suspicious || false;
          confidence = result.confidence || 0;
          reasoning = result.reasoning || '';
          aiAssessment = reasoning;
        }
      } catch (err) {
        console.error('AI Review Detection Failed:', err.message);
        // Failure of the AI call must not block review submission
      }
    }

    // Create a ReviewFlag only if deterministic score or AI says suspicious.
    if (signals.length >= 2 || isSuspicious) {
      await ReviewFlag.create({
        reviewId: bookingId,
        workerId,
        customerId,
        signals,
        riskScore: confidence > 0 ? confidence : (signals.length / 6),
        aiAssessment
      });
    }

  } catch (err) {
    console.error('Review detection service error:', err);
  }
};
