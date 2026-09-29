// SmartFix Backend - Unified Twilio Communications Service
// Handles SMS OTPs, WhatsApp Notifications, Voice TwiML Alerts, and Call Dispatching

const formatPhoneE164 = (phone) => {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  if (phone.startsWith('+')) return phone;
  return `+${cleaned}`;
};

let twilioClient = null;
const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  if (!twilioClient) {
    try {
      const twilio = require('twilio');
      twilioClient = twilio(accountSid, authToken);
    } catch (e) {
      console.warn('⚠️ Twilio SDK load notice:', e.message);
    }
  }
  return twilioClient;
};

/**
 * Check if Twilio API keys are configured in environment variables
 */
const isTwilioConfigured = () => {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
};


/**
 * 1. Send SMS Notification or OTP Code via Twilio
 */
const sendSms = async (toPhone, message) => {
  const formattedTo = formatPhoneE164(toPhone);
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!isTwilioConfigured()) {
    console.log(`📱 [Twilio Mock SMS Log] To: ${formattedTo} | Message: ${message}`);
    return { success: false, provider: 'Twilio (Mock Log)', note: 'Twilio credentials not configured in backend .env' };
  }

  try {
    const client = getTwilioClient();
    if (client) {
      const res = await client.messages.create({
        body: message,
        from: fromPhone,
        to: formattedTo,
      });
      console.log(`✅ Real SMS delivered via Twilio SDK to ${formattedTo} (SID: ${res.sid})`);
      return { success: true, provider: 'Twilio SDK', sid: res.sid };
    } else {
      // Fallback to Twilio REST HTTP API
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const bodyParams = new URLSearchParams({
        To: formattedTo,
        From: fromPhone,
        Body: message,
      });

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams,
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`✅ Real SMS delivered via Twilio REST to ${formattedTo} (SID: ${data.sid})`);
        return { success: true, provider: 'Twilio REST', sid: data.sid };
      } else {
        console.warn('⚠️ Twilio REST SMS notice:', data.message);
        return { success: false, provider: 'Twilio REST', error: data.message };
      }
    }
  } catch (err) {
    console.warn('⚠️ Twilio SMS error:', err.message);
    return { success: false, provider: 'Twilio', error: err.message };
  }
};

/**
 * 2. Send WhatsApp Notification or OTP Code via Twilio WhatsApp API
 */
const sendWhatsApp = async (toPhone, message) => {
  const rawPhone = formatPhoneE164(toPhone);
  const formattedTo = rawPhone.startsWith('whatsapp:') ? rawPhone : `whatsapp:${rawPhone}`;
  
  let fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  if (!fromNumber.startsWith('whatsapp:')) {
    fromNumber = `whatsapp:${fromNumber}`;
  }

  if (!isTwilioConfigured()) {
    console.log(`💬 [Twilio Mock WhatsApp Log] To: ${formattedTo} | Message: ${message}`);
    return { success: false, provider: 'Twilio WhatsApp (Mock Log)', note: 'Twilio credentials not configured' };
  }

  try {
    const client = getTwilioClient();
    if (client) {
      const res = await client.messages.create({
        body: message,
        from: fromNumber,
        to: formattedTo,
      });
      console.log(`✅ WhatsApp message sent via Twilio SDK to ${formattedTo} (SID: ${res.sid})`);
      return { success: true, provider: 'Twilio WhatsApp SDK', sid: res.sid };
    } else {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const bodyParams = new URLSearchParams({
        To: formattedTo,
        From: fromNumber,
        Body: message,
      });

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams,
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`✅ WhatsApp message sent via Twilio REST to ${formattedTo} (SID: ${data.sid})`);
        return { success: true, provider: 'Twilio WhatsApp REST', sid: data.sid };
      } else {
        console.warn('⚠️ Twilio WhatsApp notice:', data.message);
        return { success: false, provider: 'Twilio WhatsApp', error: data.message };
      }
    }
  } catch (err) {
    console.warn('⚠️ Twilio WhatsApp error:', err.message);
    return { success: false, provider: 'Twilio WhatsApp', error: err.message };
  }
};

/**
 * 3. Initiate Automated Voice Call Alert (TwiML Voice Synthesis)
 */
const makeVoiceAlertCall = async (toPhone, speechText) => {
  const formattedTo = formatPhoneE164(toPhone);
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!isTwilioConfigured()) {
    console.log(`📞 [Twilio Mock Voice Call Log] To: ${formattedTo} | Speech: "${speechText}"`);
    return { success: false, provider: 'Twilio Voice (Mock Log)', note: 'Twilio credentials not configured' };
  }

  const twimlXml = `<Response><Say voice="alice" language="en-IN">${speechText}</Say></Response>`;
  const encodedTwiml = encodeURIComponent(twimlXml);
  const twimlUrl = `http://twimlets.com/echo?Twiml=${encodedTwiml}`;

  try {
    const client = getTwilioClient();
    if (client) {
      const call = await client.calls.create({
        twiml: twimlXml,
        to: formattedTo,
        from: fromPhone,
      });
      console.log(`✅ Voice alert call initiated via Twilio to ${formattedTo} (Call SID: ${call.sid})`);
      return { success: true, provider: 'Twilio Voice SDK', sid: call.sid };
    } else {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const bodyParams = new URLSearchParams({
        To: formattedTo,
        From: fromPhone,
        Url: twimlUrl,
      });

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams,
      });

      const data = await response.json();
      if (response.ok) {
        console.log(`✅ Voice alert call initiated via Twilio REST to ${formattedTo} (Call SID: ${data.sid})`);
        return { success: true, provider: 'Twilio Voice REST', sid: data.sid };
      } else {
        console.warn('⚠️ Twilio Voice call notice:', data.message);
        return { success: false, provider: 'Twilio Voice', error: data.message };
      }
    }
  } catch (err) {
    console.warn('⚠️ Twilio Voice call error:', err.message);
    return { success: false, provider: 'Twilio Voice', error: err.message };
  }
};

/**
 * 4. Generate TwiML XML string for incoming call webhooks
 */
const generateTwiMLResponse = (speechText) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-IN">${speechText}</Say>
</Response>`;
};

/**
 * 5. Send 6-digit OTP using Twilio Verify API v2
 */
const sendVerifyOtp = async (toPhone) => {
  const formattedTo = formatPhoneE164(toPhone);
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!isTwilioConfigured() || !verifySid || verifySid.includes('xxxx')) {
    console.log(`📱 [Twilio Verify Mock Send] To: ${formattedTo}`);
    return {
      success: true,
      status: 'pending',
      mocked: true,
      message: 'Twilio Verify is in mock mode (credentials/SID missing or placeholder)',
    };
  }

  const client = getTwilioClient();
  if (!client) {
    throw new Error('Twilio client failed to initialize');
  }

  const verification = await client.verify.v2
    .services(verifySid)
    .verifications.create({
      to: formattedTo,
      channel: 'sms',
    });

  return {
    success: true,
    status: verification.status,
    sid: verification.sid,
    to: formattedTo,
  };
};

/**
 * 6. Check/Verify 6-digit OTP using Twilio Verify API v2
 */
const checkVerifyOtp = async (toPhone, code) => {
  const formattedTo = formatPhoneE164(toPhone);
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!isTwilioConfigured() || !verifySid || verifySid.includes('xxxx')) {
    console.log(`📱 [Twilio Verify Mock Check] To: ${formattedTo} | Code: ${code}`);
    return {
      success: true,
      status: 'approved',
      mocked: true,
    };
  }

  const client = getTwilioClient();
  if (!client) {
    throw new Error('Twilio client failed to initialize');
  }

  const verificationCheck = await client.verify.v2
    .services(verifySid)
    .verificationChecks.create({
      to: formattedTo,
      code: code,
    });

  return {
    success: verificationCheck.status === 'approved',
    status: verificationCheck.status,
    sid: verificationCheck.sid,
  };
};

module.exports = {
  formatPhoneE164,
  isTwilioConfigured,
  sendSms,
  sendWhatsApp,
  makeVoiceAlertCall,
  generateTwiMLResponse,
  sendVerifyOtp,
  checkVerifyOtp,
};

