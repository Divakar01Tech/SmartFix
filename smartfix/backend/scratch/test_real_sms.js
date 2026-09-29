require('dotenv').config();
const { sendSmsOtp } = require('../services/smsService');

async function testSms() {
  console.log('Sending test SMS via Fast2SMS using key:', process.env.FAST2SMS_API_KEY?.substring(0, 10) + '...');
  const result = await sendSmsOtp('+918098837384', '584920');
  console.log('Result:', result);
}

testSms();
