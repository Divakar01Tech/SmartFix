const twilio = require("twilio");

const formatPhoneE164 = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith("91")) return `+${cleaned}`;
  if (phone.trim().startsWith("+") && cleaned.length >= 10) return `+${cleaned}`;
  return null;
};

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

let client = null;

if (accountSid && authToken && accountSid.startsWith("AC")) {
  try {
    client = twilio(accountSid, authToken);
  } catch (err) {
    console.warn("⚠️ Twilio Client Initialization Warning:", err.message);
  }
}

const isTwilioVerifyConfigured = () => {
  return !!(
    client &&
    accountSid &&
    !accountSid.includes("xxxx") &&
    !accountSid.includes("YOUR_") &&
    verifyServiceSid &&
    verifyServiceSid.startsWith("VA") &&
    !verifyServiceSid.includes("xxxx") &&
    !verifyServiceSid.includes("YOUR_")
  );
};

module.exports = {
  client,
  verifyServiceSid,
  formatPhoneE164,
  isTwilioVerifyConfigured,
};
