const Dispute = require('../models/Dispute');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { callGeminiJsonApi } = require('../services/geminiService');

const generateDisputeSummary = async (disputeId) => {
  try {
    const dispute = await Dispute.findById(disputeId).populate('bookingId').populate('raisedBy', 'name role rating');
    if (!dispute || !dispute.bookingId) return;

    const booking = dispute.bookingId;
    
    // We would fetch chat messages here if there's a Chat model, 
    // but assuming we don't have a specific chat model linked yet, we use booking fields.
    const bookingDetails = `
      Status: ${booking.status}
      Price: ${booking.price}
      Created At: ${booking.createdAt}
      Accepted At: ${booking.acceptedAt || 'N/A'}
      Resolved/Completed At: ${booking.updatedAt}
    `;

    const systemPrompt = `You are a neutral, objective dispute resolution AI for a home services platform.
Your job is to read the dispute report and booking details, and output a strict JSON recommendation for the Admin.
Do not favor the customer or worker by default.
Return JSON ONLY with this schema:
{
  "summary": "3-4 sentence factual summary of the dispute",
  "recommendation": "full_refund" | "partial_refund" | "reassign_worker" | "no_action" | "needs_more_info",
  "confidence": 0.95,
  "reasoning": "brief explanation of why this recommendation was made"
}
If the description is too vague, return "needs_more_info" instead of guessing.`;

    const userPrompt = `
      Dispute Raised By: ${dispute.raisedBy.name} (${dispute.raisedByRole})
      Dispute Reason: ${dispute.reason}
      Dispute Description: ${dispute.description}
      Booking Timeline & Info: ${bookingDetails}
    `;

    const aiResponse = await callGeminiJsonApi(userPrompt, systemPrompt);

    if (aiResponse && aiResponse.summary) {
      dispute.aiSummary = aiResponse.summary;
      dispute.aiRecommendation = aiResponse.recommendation;
      dispute.aiConfidence = aiResponse.confidence;
      dispute.aiReasoning = aiResponse.reasoning;
    } else {
      dispute.aiSummaryFailed = true;
    }

    await dispute.save();

  } catch (err) {
    console.error('Error generating dispute summary:', err);
    await Dispute.findByIdAndUpdate(disputeId, { aiSummaryFailed: true });
  }
};

exports.raiseDispute = async (req, res) => {
  try {
    const { bookingId, reason, description } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Validate that the user raising it is part of the booking
    if (booking.customer.toString() !== req.user.id && (!booking.worker || booking.worker.toString() !== req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to raise dispute for this booking' });
    }

    const dispute = new Dispute({
      bookingId,
      raisedBy: req.user.id,
      raisedByRole: req.user.role === 'customer' ? 'customer' : 'handyman',
      reason,
      description
    });

    await dispute.save();

    // Trigger AI summary async
    generateDisputeSummary(dispute._id).catch(err => console.error(err));

    res.status(201).json({ success: true, dispute, message: 'Dispute submitted successfully' });

  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to raise dispute', error: err.message });
  }
};

exports.getAdminDisputes = async (req, res) => {
  try {
    const disputes = await Dispute.find()
      .populate('bookingId')
      .populate('raisedBy', 'name phone email role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, disputes });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch disputes' });
  }
};

exports.resolveDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminDecision, adminNotes, status } = req.body;

    const dispute = await Dispute.findById(id);
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

    dispute.adminDecision = adminDecision;
    dispute.adminNotes = adminNotes;
    dispute.status = status || 'Resolved';
    dispute.resolvedAt = new Date();

    // TODO: if adminDecision is full_refund etc, implement actual razorpay refund here if needed
    // For now, it only populates fields

    await dispute.save();

    res.status(200).json({ success: true, dispute, message: 'Dispute resolved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to resolve dispute' });
  }
};
