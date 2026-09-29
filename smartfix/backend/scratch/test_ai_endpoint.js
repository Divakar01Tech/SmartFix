require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { askSmartFixAi } = require('../controllers/aiController');

async function testAiController() {
  console.log('Testing askSmartFixAi controller with GEMINI_API_KEY...');
  
  const queries = [
    'my ac is leaking',
    'how to fix leaking tap',
    'book a plumber for tomorrow',
    'hi'
  ];

  for (const q of queries) {
    console.log(`\n========================================`);
    console.log(`User Query: "${q}"`);
    const mockReq = { body: { message: q } };
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) {
        console.log('Intent:', data.intentData?.intent);
        console.log('Provider:', data.provider);
        console.log('AI Reply:\n', data.reply);
      }
    };
    await askSmartFixAi(mockReq, mockRes);
  }
}

testAiController();
