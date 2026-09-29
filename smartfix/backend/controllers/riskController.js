const Booking = require('../models/Booking');
const { callGeminiApi } = require('../services/geminiService');

// Helper to extract JSON from markdown or raw response
const extractJson = (text) => {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
};

/**
 * @desc Assess the risk of a customer no-show/cancellation and update booking
 */
exports.assessBookingRisk = async (bookingId, io = null) => {
  try {
    const booking = await Booking.findById(bookingId).populate('customer', 'name');
    if (!booking) return;

    // Get historical bookings for this customer
    const history = await Booking.find({
      customer: booking.customer._id,
      _id: { $ne: bookingId }
    });

    const totalBookings = history.length;
    
    // New customer logic - skip AI call
    if (totalBookings < 3) {
      booking.riskFlag = 'low';
      booking.riskScore = 0.1;
      booking.riskFactors = ['New customer — insufficient history'];
      await booking.save();
      return;
    }

    const cancelledCount = history.filter(b => ['Cancelled', 'Declined'].includes(b.status)).length;
    const cancelRate = cancelledCount / totalBookings;

    // Time-of-day pattern check
    const currentBookingHour = new Date(booking.createdAt || Date.now()).getHours();
    
    // Distance/ETA signal (already in booking model or defaults)
    const distanceKm = booking.distanceKm || 2.5;
    const estimatedMinutes = booking.estimatedMinutes || 15;

    // Build computed signals payload for AI
    const systemPrompt = `You are a Risk Assessment AI for a home services platform.
Analyze the provided behavioral signals to predict the likelihood of the customer cancelling or no-showing.
Respond ONLY with a raw JSON object (no markdown, no backticks).
Required JSON format:
{
  "riskScore": Number (0 to 1),
  "riskFlag": String ("low" | "medium" | "high"),
  "riskFactors": [String] (short 1-line reasons explaining the risk in plain language)
}
Guidelines:
- Cancel rates > 50% are high risk.
- Distances > 15km or ETA > 45mins increase impatience risk.
- Do NOT output anything other than JSON.`;

    const userPrompt = `
Customer Behavioral Signals:
- Total Prior Bookings: ${totalBookings}
- Cancelled/Declined Bookings: ${cancelledCount} (Rate: ${(cancelRate * 100).toFixed(1)}%)
- Current Booking Hour: ${currentBookingHour}:00
- Provider Distance: ${distanceKm.toFixed(1)} km
- Estimated Arrival Time: ${estimatedMinutes} minutes
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const aiResponseText = await callGeminiApi(messages, 0.2, 300);
    if (!aiResponseText || !aiResponseText.text) {
      console.warn('Risk Assessment AI returned empty response for booking:', bookingId);
      return;
    }

    const parsedJson = extractJson(aiResponseText.text);
    if (parsedJson && parsedJson.riskFlag) {
      booking.riskScore = parsedJson.riskScore;
      booking.riskFlag = parsedJson.riskFlag;
      booking.riskFactors = parsedJson.riskFactors || [];
      await booking.save();
      
      if (io) {
        // Emit to worker that risk has been updated
        io.to(`booking-${bookingId}`).emit('booking-risk-updated', {
          bookingId,
          riskFlag: booking.riskFlag,
          riskFactors: booking.riskFactors,
        });
        
        // Emit to admin room
        if (booking.riskFlag === 'high') {
          io.to('admin-room').emit('new-high-risk-booking', booking);
        }
      }
    }
  } catch (error) {
    console.error('Error assessing booking risk:', error.message);
  }
};

/**
 * @desc Get all currently Pending/Accepted bookings with riskFlag = 'high'
 * @route GET /api/admin/bookings/high-risk
 * @access Private (Admin)
 */
exports.getHighRiskBookings = async (req, res) => {
  try {
    const highRiskBookings = await Booking.find({
      status: { $in: ['Pending', 'Accepted', 'PendingDispatch'] },
      riskFlag: 'high'
    })
      .populate('customer', 'name phone')
      .populate('worker', 'name phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ bookings: highRiskBookings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching high risk bookings', error: error.message });
  }
};
