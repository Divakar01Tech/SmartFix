const Booking = require('../models/Booking');
const Wallet = require('../models/Wallet');
const Dispute = require('../models/Dispute');
const User = require('../models/User');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || '';

// --- Context Gatherers (Role-Scoped) ---

async function getCustomerContext(userId) {
  const bookings = await Booking.find({ customer: userId })
    .select('bookingId status service paymentStatus totalAmount scheduledDate worker')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
    
  const wallet = await Wallet.findOne({ user: userId }).lean();
  
  const disputes = await Dispute.find({ raisedBy: userId })
    .select('disputeId status type resolution')
    .lean();

  return {
    role: 'Customer',
    bookings: bookings.length ? bookings : "No bookings yet",
    walletBalance: wallet ? wallet.balance : 0,
    disputes: disputes.length ? disputes : "No active disputes",
  };
}

async function getProviderContext(userId) {
  const jobs = await Booking.find({ worker: userId })
    .select('bookingId status service paymentStatus scheduledDate')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
    
  const worker = await User.findById(userId).select('rating totalJobs completedJobs earnings').lean();

  return {
    role: 'Provider/Worker',
    assignedJobs: jobs.length ? jobs : "No jobs assigned yet",
    performance: {
      rating: worker?.rating || 0,
      totalJobs: worker?.totalJobs || 0,
      completedJobs: worker?.completedJobs || 0
    }
  };
}

async function getAdminContext() {
  const totalBookings = await Booking.countDocuments();
  const activeBookings = await Booking.countDocuments({ status: { $in: ['accepted', 'in_progress', 'started'] } });
  const completedBookings = await Booking.countDocuments({ status: 'completed' });
  const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
  
  const openDisputes = await Dispute.countDocuments({ status: 'open' });
  
  const totalCustomers = await User.countDocuments({ role: 'Customer' });
  const totalWorkers = await User.countDocuments({ role: 'Worker' });
  
  const pendingWorkers = await User.countDocuments({ role: 'Worker', verificationStatus: 'Pending' });

  return {
    role: 'Admin',
    platformStats: {
      totalBookings,
      activeBookings,
      completedBookings,
      cancelledBookings,
      openDisputes,
      totalCustomers,
      totalWorkers,
      pendingWorkersWaitingForKyc: pendingWorkers,
    },
    note: "Raw PII (customer/worker lists) is NOT available in this context. Direct the user to the admin dashboard for specific searches."
  };
}

// --- Controller Logic ---

exports.queryAssistant = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    const userId = req.user.id;
    const userRole = req.user.role; // Enforced via JWT

    let contextData = {};
    if (userRole === 'Customer') {
      contextData = await getCustomerContext(userId);
    } else if (userRole === 'Worker') {
      contextData = await getProviderContext(userId);
    } else if (userRole === 'Admin') {
      contextData = await getAdminContext();
    } else {
      return res.status(403).json({ message: 'Role not supported for AI assistant' });
    }

    const systemPrompt = `You are a read-only, helpful AI assistant for SmartFix/HandyBook users.
You are currently helping a ${userRole}.
Answer ONLY using the provided Context JSON Data.
If the answer isn't in the context, say so honestly — do not guess or fabricate numbers.
Never suggest or imply any action was taken (you cannot mutate data, cancel bookings, or issue refunds).
If they ask for action, explain you are a read-only assistant and guide them to use the app buttons.
Respond in the same language as the user's question (English or Tamil).
Be concise and conversational.

--- Context JSON Data ---
${JSON.stringify(contextData, null, 2)}
`;

    // Reusing the same fetch call logic from KYC Chatbot (skillInterviewService.js)
    const messagesPayload = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ];

    // OpenRouter requires system prompt as user if not supported, but we'll use system and format if needed
    const openRouterMessages = messagesPayload.map((m) => {
      if (m.role === 'system') {
        return { role: 'user', content: `[SYSTEM INSTRUCTION]\n${m.content}` };
      }
      return m;
    });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'SmartFix Command Center AI',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'claude-3-5-sonnet-20240620',
        messages: openRouterMessages,
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API Error:', errorText);
      return res.status(500).json({ message: 'Failed to communicate with AI provider' });
    }

    const data = await response.json();
    const answer = data.choices && data.choices[0] && data.choices[0].message.content;

    res.json({ answer: answer || "I'm sorry, I couldn't process your request." });
  } catch (err) {
    console.error('Assistant Query Error:', err);
    res.status(500).json({ message: 'Internal server error while processing query' });
  }
};
