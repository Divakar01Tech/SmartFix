const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['district', 'taluk', 'village'],
    required: true
  },
  name: {
    en: { type: String, required: true },
    ta: { type: String, required: true }
  },
  slug: {
    type: String,
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location' // null for districts
  },
  // Village only
  kind: {
    type: String,
    enum: ['village', 'town', 'city']
  },
  lat: Number,
  lng: Number,
  pincode: String,

  // District only
  isServiceActive: { type: Boolean, default: false },
  waitlistCount: { type: Number, default: 0 },
  zone: { type: String, enum: ['metro', 'town', 'rural'] },
  aliases: [{ type: String }],

  // Taluk only
  radiusKm: { type: Number },
  zoneOverride: { type: String, enum: ['metro', 'town', 'rural'] }
}, { timestamps: true });

LocationSchema.index({ level: 1, parentId: 1 });
LocationSchema.index({ 'name.en': 1 });
LocationSchema.index({ 'name.ta': 1 });
LocationSchema.index({ slug: 1 });

module.exports = mongoose.model('Location', LocationSchema);
