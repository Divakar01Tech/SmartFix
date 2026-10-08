const Booking = require('../models/Booking');
const { askGroqJSON } = require('./aiService');

exports.analyzeReviewAspects = async (bookingId, text, rating) => {
  if (!text || text.trim().length === 0) return;

  try {
    const systemPrompt = `You are an AI that analyzes customer reviews for home services (plumbing, electrical, etc.).
The review might be in English, Tamil, or Tanglish (Tamil written in English letters).
Score the review on the following four aspects from 1 to 5. If an aspect is not mentioned or cannot be inferred, return null.
Aspects:
- punctuality
- behaviour
- cleanliness
- price_fairness

Also provide a one-line summary of the review.
Also determine if the review seems 'suspicious' (e.g. generic, copy-pasted, excessively generic 5-star without details).

Output strict JSON:
{
  "aspects": {
    "punctuality": number | null,
    "behaviour": number | null,
    "cleanliness": number | null,
    "price_fairness": number | null
  },
  "summary": "string",
  "suspicious": boolean
}`;

    const userPrompt = `Rating: ${rating} stars\nReview: "${text}"`;

    const result = await askGroqJSON({ system: systemPrompt, user: userPrompt });
    
    if (result && result.aspects) {
      const aiAnalysis = {
        aspects: {
          punctuality: result.aspects.punctuality || null,
          behaviour: result.aspects.behaviour || null,
          cleanliness: result.aspects.cleanliness || null,
          price_fairness: result.aspects.price_fairness || null
        },
        summary: result.summary || '',
        suspicious: !!result.suspicious
      };

      await Booking.findByIdAndUpdate(bookingId, { $set: { aiAnalysis } });
    }
  } catch (err) {
    console.error('Failed to analyze review aspects:', err.message);
  }
};
