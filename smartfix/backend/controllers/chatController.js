const ChatMessage = require('../models/ChatMessage');
const PolicyViolation = require('../models/PolicyViolation');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || '';

// Deterministic regex for fast filtering
const REGEX_PII = /(\b\d{10}\b|\+91[-.\s]?\d{10}|\b[\w.-]+@[\w.-]+\.\w{2,4}\b|whatsapp|call me|my number)/i;

const checkWithLLM = async (text) => {
  try {
    const prompt = `Does this message attempt to share a phone number, email, or off-platform contact method, even if obfuscated (e.g. spelled out digits, spaced characters)? 
Message: "${text}"
Respond with strict JSON: { "isContactSharingAttempt": true/false, "confidence": 0-1 }`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'claude-3-5-sonnet-20240620',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    const answer = data.choices[0].message.content;
    const parsed = JSON.parse(answer);
    return parsed.isContactSharingAttempt === true;
  } catch (err) {
    console.error('LLM Check Error:', err);
    return false; // Fail open if API fails, to not block messages
  }
};

exports.sendMessage = async (req, res) => {
  const { bookingId, text } = req.body;
  const senderId = req.user.id;
  const senderRole = req.user.role;

  // 1. Fast Regex Check
  let isFlagged = REGEX_PII.test(text);
  let reason = isFlagged ? 'Regex Match' : null;

  // 2. Fallback to LLM if regex passed but text length suggests obfuscation
  if (!isFlagged && text.length > 9) {
    isFlagged = await checkWithLLM(text);
    if (isFlagged) reason = 'AI Detected Obfuscation';
  }

  if (isFlagged) {
    // Increment Policy Violation
    let violation = await PolicyViolation.findOne({ user: senderId, booking: bookingId });
    if (violation) {
      violation.count += 1;
      violation.lastAttemptAt = Date.now();
      await violation.save();
    } else {
      await PolicyViolation.create({
        user: senderId,
        role: senderRole,
        booking: bookingId,
        violationType: 'contact_sharing_attempt'
      });
    }

    // Save flagged message silently
    await ChatMessage.create({
      booking: bookingId,
      sender: senderId,
      senderRole,
      text,
      flagged: true,
      flagReason: reason
    });

    // Deliver system warning instead of real message
    const warning = await ChatMessage.create({
      booking: bookingId,
      sender: senderId, // Tie to sender for UI alignment
      senderRole: 'System',
      text: "Contact sharing isn't allowed — please continue coordinating through in-app chat and the Call button. / தொடர்பைப் பகிர்வது அனுமதிக்கப்படாது — தயவுசெய்து ஆப் மூலம் தொடர்பு கொள்ளவும்."
    });

    return res.status(200).json({ message: warning });
  }

  // Safe message
  const chatMessage = await ChatMessage.create({
    booking: bookingId,
    sender: senderId,
    senderRole,
    text
  });

  // Emit to socket (assume req.app.get('io') is available)
  req.app.get('io').to(`booking_${bookingId}`).emit('new_message', chatMessage);
  
  res.status(200).json({ message: chatMessage });
};
