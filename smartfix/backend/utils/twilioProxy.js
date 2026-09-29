const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const proxyServiceSid = process.env.TWILIO_PROXY_SERVICE_SID;

// Creates a Twilio Proxy Session between Customer and Worker
exports.createProxySession = async (bookingId, customerPhone, workerPhone) => {
  try {
    if (!proxyServiceSid) {
      console.warn('⚠️ Twilio Proxy Service SID is missing. Booking will proceed without masked calling.');
      return null;
    }

    // 1. Create a Proxy Session for this specific booking
    const session = await client.proxy.v1
      .services(proxyServiceSid)
      .sessions
      .create({ uniqueName: `booking_${bookingId}` });

    // 2. Add Customer as Participant
    const customerParticipant = await client.proxy.v1
      .services(proxyServiceSid)
      .sessions(session.sid)
      .participants
      .create({ identifier: customerPhone, friendlyName: 'Customer' });

    // 3. Add Worker as Participant
    const workerParticipant = await client.proxy.v1
      .services(proxyServiceSid)
      .sessions(session.sid)
      .participants
      .create({ identifier: workerPhone, friendlyName: 'Worker' });

    // The proxy number is assigned and returned in the participant's proxyIdentifier
    const proxyNumber = customerParticipant.proxyIdentifier;

    return { sessionSid: session.sid, proxyNumber };
  } catch (error) {
    console.error(`❌ Failed to create proxy session for booking ${bookingId}:`, error.message);
    return null; // Return null on failure so booking can still proceed safely without leaking numbers
  }
};

// Closes a Twilio Proxy Session immediately
exports.closeProxySession = async (sessionSid) => {
  try {
    if (!proxyServiceSid || !sessionSid) return;
    await client.proxy.v1
      .services(proxyServiceSid)
      .sessions(sessionSid)
      .update({ status: 'closed' });
    console.log(`✅ Closed Twilio Proxy Session ${sessionSid}`);
  } catch (error) {
    console.error(`❌ Failed to close proxy session ${sessionSid}:`, error.message);
  }
};
