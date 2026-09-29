// Real SMS & Messaging Delivery Service for SmartFix Backend
// Supports Fast2SMS (India +91 numbers) & Twilio SMS / WhatsApp

const twilioService = require('./twilioService');

const sendSmsOtp = async (phoneNumber, otpCode, channel = 'sms') => {
  let lastFast2SmsError = null;
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const mobile10Digit = cleanPhone.length === 12 && cleanPhone.startsWith('91') 
    ? cleanPhone.substring(2) 
    : cleanPhone;
  const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${mobile10Digit}`;

  const messageText = `Your SmartFix verification OTP code is: ${otpCode}. Valid for 5 minutes. Do not share this code with anyone.`;


  // 1. Twilio WhatsApp Option if requested
  if (channel === 'whatsapp' && twilioService.isTwilioConfigured()) {
    const waResult = await twilioService.sendWhatsApp(formattedPhone, messageText);
    if (waResult.success) {
      return waResult;
    }
  }

  // 2. Fast2SMS Integration (Primary for Indian +91 numbers)
  if (process.env.FAST2SMS_API_KEY) {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'otp',
          variables_values: otpCode,
          numbers: mobile10Digit,
        }),
      });

      const data = await response.json();
      if (data.return) {
        console.log(`✅ Real SMS delivered via Fast2SMS (OTP Route) to +91${mobile10Digit}`);
        return { success: true, provider: 'Fast2SMS', route: 'otp' };
      } else {
        const errorMsg = Array.isArray(data.message) ? data.message.join(', ') : (data.message || JSON.stringify(data));
        console.error(`❌ [Fast2SMS Failure] Status Code: ${data.status_code || response.status} | Reason: ${errorMsg}`);
        
        if (data.status_code === 414 || (typeof errorMsg === 'string' && errorMsg.toLowerCase().includes('blacklist'))) {
          console.error(`🚨 [Fast2SMS IP Restriction]: Fast2SMS rejected request from this IP with 414. Please add your server's public IP to Fast2SMS Dashboard -> Dev API -> IP Whitelist (https://www.fast2sms.com/dashboard/dev-api).`);
        }

        // Try Quick Route ('q') fallback on Fast2SMS
        try {
          const resQ = await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: {
              'authorization': process.env.FAST2SMS_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              route: 'q',
              message: `Your SmartFix OTP code is ${otpCode}. Valid for 5 minutes.`,
              flash: 0,
              numbers: mobile10Digit,
            }),
          });
          const dataQ = await resQ.json();
          if (dataQ.return) {
            console.log(`✅ Real SMS delivered via Fast2SMS (Quick Route) to +91${mobile10Digit}`);
            return { success: true, provider: 'Fast2SMS (Quick Route)', route: 'q' };
          } else {
            const errQ = Array.isArray(dataQ.message) ? dataQ.message.join(', ') : (dataQ.message || JSON.stringify(dataQ));
            console.error(`❌ [Fast2SMS Quick Route Failure] Status Code: ${dataQ.status_code} | Reason: ${errQ}`);
          }
        } catch (e) {
          console.error(`❌ [Fast2SMS Quick Route Exception]:`, e.message);
        }

        lastFast2SmsError = {
          provider: 'Fast2SMS',
          statusCode: data.status_code || response.status,
          error: errorMsg,
        };
      }
    } catch (err) {
      console.error('❌ [Fast2SMS Network/Exception Error]:', err.message);
      lastFast2SmsError = {
        provider: 'Fast2SMS',
        error: err.message,
      };
    }
  }

  // 3. Twilio SMS Integration (Fallback if configured)
  if (twilioService.isTwilioConfigured()) {
    const twilioResult = await twilioService.sendSms(formattedPhone, messageText);
    if (twilioResult.success) {
      return twilioResult;
    }
  }

  console.log(`📱 SMS Gateway Notice: OTP generated for +91${mobile10Digit}. Delivery status: Failed live SMS gateway dispatch.`);
  return {
    success: false,
    provider: 'Fast2SMS',
    error: lastFast2SmsError ? lastFast2SmsError.error : 'SMS delivery failed',
    statusCode: lastFast2SmsError ? lastFast2SmsError.statusCode : undefined,
  };
};


const sendCustomSms = async (phoneNumber, messageText) => {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const mobile10Digit = cleanPhone.length === 12 && cleanPhone.startsWith('91') 
    ? cleanPhone.substring(2) 
    : cleanPhone;
  const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${mobile10Digit}`;

  // 1. Fast2SMS Quick Route
  if (process.env.FAST2SMS_API_KEY) {
    try {
      const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: {
          'authorization': process.env.FAST2SMS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: 'q',
          message: messageText,
          flash: 0,
          numbers: mobile10Digit,
        }),
      });

      const data = await response.json();
      if (data.return) {
        console.log(`✅ Status SMS delivered via Fast2SMS to +91${mobile10Digit}`);
        return { success: true, provider: 'Fast2SMS' };
      }
    } catch (err) {
      console.warn('⚠️ Fast2SMS send custom error:', err.message);
    }
  }

  // 2. Twilio SMS
  if (twilioService.isTwilioConfigured()) {
    const twilioResult = await twilioService.sendSms(formattedPhone, messageText);
    if (twilioResult.success) {
      return twilioResult;
    }
  }

  console.log(`📱 SMS Gateway Log: Message for +91${mobile10Digit}: ${messageText}`);
  return { success: false, provider: 'Log' };
};

module.exports = { sendSmsOtp, sendCustomSms };


