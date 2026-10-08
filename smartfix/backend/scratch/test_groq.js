require('dotenv').config({ path: '../.env' });
const { askGroqJSON } = require('../services/aiService');

askGroqJSON({
  system: 'Reply ONLY with valid JSON.',
  user: 'Return {"ok": true}',
  maxTokens: 50
}).then(r => {
  console.log('Model OK:', JSON.stringify(r));
  process.exit(0);
}).catch(e => {
  console.error('Model FAILED:', e.message);
  process.exit(1);
});
