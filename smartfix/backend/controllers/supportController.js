const SupportConversation = require('../models/SupportConversation');
const SupportTicket = require('../models/SupportTicket');
const { handleSupportMessage } = require('../services/supportBotService');

// @route POST /api/support/chat
exports.chatWithSupport = async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    const userId = req.user?.id || req.user?._id;
    const userRole = (req.user?.role || 'customer').toLowerCase();

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const result = await handleSupportMessage({
      conversationId,
      userId,
      userRole,
      message: message.trim(),
    });

    if (result.aiDisabled) {
      return res.status(200).json({
        success: false,
        aiDisabled: true,
        reply: result.reply,
      });
    }

    return res.status(200).json({
      success: true,
      conversationId: result.conversationId,
      reply: result.reply,
      toolsUsed: result.toolsUsed,
      isEscalated: result.isEscalated,
    });
  } catch (err) {
    console.error('Support chat error:', err);
    return res.status(500).json({ success: false, message: 'Support chat failed: ' + err.message });
  }
};

// @route GET /api/support/conversation/:id
exports.getSupportConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;
    const role = (req.user?.role || '').toLowerCase();

    const query = role === 'admin' ? { _id: id } : { _id: id, userId };
    const conversation = await SupportConversation.findOne(query);

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Support conversation not found' });
    }

    return res.status(200).json({ success: true, conversation });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==============================================================
// Admin Ticket Management Endpoints
// ==============================================================

// @route GET /api/admin/support-tickets
exports.getAdminSupportTickets = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const tickets = await SupportTicket.find(filter)
      .populate('userId', 'name email phone role')
      .populate('conversationId', 'messages status createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await SupportTicket.countDocuments(filter);

    return res.status(200).json({
      success: true,
      tickets,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// @route PATCH /api/admin/support-tickets/:id
exports.updateAdminSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    if (status) ticket.status = status;
    if (adminNotes !== undefined) ticket.adminNotes = adminNotes;
    ticket.assignedTo = req.user?.id || req.user?._id;

    await ticket.save();

    return res.status(200).json({
      success: true,
      message: 'Support ticket updated successfully',
      ticket,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
