require('dotenv').config();

async function testFast2SmsRoutes() {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const number = '8098837384';
  const otpCode = '584920';

  console.log('Testing Fast2SMS Route 1: bulkV2 route=q (Quick SMS)...');
  try {
    const res1 = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message: `Your SmartFix OTP code is ${otpCode}. Valid for 5 minutes.`,
        flash: 0,
        numbers: number,
      }),
    });
    const d1 = await res1.json();
    console.log('Route q response:', d1);
  } catch (e) {
    console.log('Route q error:', e.message);
  }

  console.log('\nTesting Fast2SMS Route 2: GET request dlt/quick route...');
  try {
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&route=q&message=${encodeURIComponent(`Your SmartFix OTP code is ${otpCode}`)}&language=english&flash=0&numbers=${number}`;
    const res2 = await fetch(url);
    const d2 = await res2.json();
    console.log('GET Route q response:', d2);
  } catch (e) {
    console.log('GET Route error:', e.message);
  }
}

testFast2SmsRoutes();
