const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const TranslationCache = require('../models/TranslationCache');
const ChatMessage = require('../models/ChatMessage');
const Booking = require('../models/Booking');
const User = require('../models/User');
const AiSettings = require('../models/AiSettings');
const { translateMessage, computeHash, hasTamilScript } = require('../services/translationService');
const { invalidateAiSettingsCache } = require('../services/aiService');

async function runPrompt4Test() {
  console.log('--- Testing Prompt 4: Live Chat Translation (Tamil ↔ English) ---');

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartfix';
  await mongoose.connect(mongoUri);
  console.log('✓ Connected to MongoDB');

  // Clear test cache
  await TranslationCache.deleteMany({ fromLang: 'test' });

  // Test 1: Tamil Script Detection helper
  console.log('\n[1] Testing Tamil script detection:');
  const tamilDetected = hasTamilScript('நான் 10 நிமிடத்தில் வந்துவிடுவேன்');
  const englishDetected = hasTamilScript('I will arrive in 10 minutes');
  console.log('- Tamil string contains Tamil script:', tamilDetected);
  console.log('- English string contains Tamil script:', englishDetected);
  if (!tamilDetected || englishDetected) {
    throw new Error('hasTamilScript failed');
  }
  console.log('✓ Tamil script detection verified!');

  // Test 2: AI Feature Disable Toggle
  console.log('\n[2] Testing AI toggle disabled for chatTranslation:');
  let settings = await AiSettings.findOne({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  if (!settings) {
    settings = await AiSettings.create({ singletonKey: 'DEFAULT_AI_SETTINGS' });
  }
  settings.chatTranslation = false;
  await settings.save();
  invalidateAiSettingsCache();

  const disabledRes = await translateMessage('நான் வந்துவிட்டேன்', 'en');
  console.log('Result when chatTranslation is off:', disabledRes);
  if (disabledRes.translatedBy !== 'none' || disabledRes.translatedText !== 'நான் வந்துவிட்டேன்') {
    throw new Error('Expected untouched message with translatedBy: none when feature is disabled');
  }
  console.log('✓ Disabled toggle delivered message untouched with translatedBy: none!');

  // Re-enable toggle
  settings.chatTranslation = true;
  await settings.save();
  invalidateAiSettingsCache();

  // Test 3: Caching mechanism (Seed a cache entry and verify immediate hit without AI call)
  console.log('\n[3] Testing TranslationCache immediate hit:');
  const testPhrase = 'நான் 10 நிமிடத்தில் வந்துவிடுவேன்';
  const testHash = computeHash(testPhrase, 'en');
  await TranslationCache.create({
    hash: testHash,
    fromLang: 'ta',
    toLang: 'en',
    translatedText: 'I will arrive in 10 minutes',
    hitCount: 1
  });

  const cacheHitRes = await translateMessage(testPhrase, 'en');
  console.log('Cache Hit Result:', cacheHitRes);
  if (cacheHitRes.translatedBy !== 'cache' || cacheHitRes.translatedText !== 'I will arrive in 10 minutes') {
    throw new Error('Cache hit failed');
  }
  console.log('✓ Translation returned instantly from TranslationCache with status "cache"!');

  // Test 4: ChatMessage model persistence with original text and translations
  console.log('\n[4] Testing ChatMessage model schema:');
  const customer = await User.findOne({ role: 'customer' }) || await User.create({
    name: 'Chat Cust',
    email: `chat_cust_${Date.now()}@example.com`,
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: 'Password123!',
    role: 'customer'
  });

  const testBooking = await Booking.findOne() || await Booking.create({
    customer: customer._id,
    trade: 'Plumbing',
    address: 'Sivagangai, Tamil Nadu',
    district: 'Sivagangai',
    price: 350
  });

  const msg = await ChatMessage.create({
    booking: testBooking._id,
    sender: customer._id,
    senderRole: 'Customer',
    text: testPhrase,
    originalLang: 'ta',
    translations: {
      en: cacheHitRes.translatedText,
      ta: testPhrase
    },
    translatedBy: 'cache'
  });

  const savedMsg = await ChatMessage.findById(msg._id);
  console.log('Saved ChatMessage:', {
    text: savedMsg.text,
    originalLang: savedMsg.originalLang,
    translations: savedMsg.translations,
    translatedBy: savedMsg.translatedBy
  });

  if (savedMsg.text !== testPhrase || savedMsg.translations.en !== 'I will arrive in 10 minutes') {
    throw new Error('ChatMessage failed to store translations');
  }
  console.log('✓ ChatMessage saved and verified with original text preserved!');

  // Cleanup
  await TranslationCache.deleteOne({ hash: testHash });
  await ChatMessage.deleteOne({ _id: msg._id });
  await mongoose.disconnect();
  console.log('\nPrompt 4 Test Completed Successfully! 🎉');
}

runPrompt4Test().catch(err => {
  console.error('Prompt 4 Test Failed:', err);
  process.exit(1);
});
