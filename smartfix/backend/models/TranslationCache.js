const mongoose = require('mongoose');

const translationCacheSchema = new mongoose.Schema({
  hash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  fromLang: {
    type: String,
    enum: ['en', 'ta', 'tanglish', 'unknown'],
    default: 'unknown',
  },
  toLang: {
    type: String,
    enum: ['en', 'ta'],
    required: true,
  },
  translatedText: {
    type: String,
    required: true,
  },
  hitCount: {
    type: Number,
    default: 1,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000, // TTL 30 days
  },
});

module.exports = mongoose.model('TranslationCache', translationCacheSchema);
