const mongoose = require('mongoose');
const crypto = require('crypto');

const applianceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Air Conditioner',
        'Washing Machine',
        'Refrigerator',
        'Water Purifier',
        'Microwave',
        'Geyser',
        'Television',
        'Plumbing Fixture',
        'Inverter / UPS',
        'Other',
      ],
      default: 'Other',
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    modelNumber: {
      type: String,
      trim: true,
      default: '',
    },
    serialNumber: {
      type: String,
      trim: true,
      default: '',
    },
    capacityOrSpecs: {
      type: String,
      trim: true,
      default: '',
    },
    installDate: {
      type: Date,
      default: null,
    },
    warrantyExpiry: {
      type: Date,
      default: null,
      index: true,
    },
    serviceHistory: [
      {
        bookingId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Booking',
        },
        date: {
          type: Date,
          default: Date.now,
        },
        description: {
          type: String,
          default: '',
        },
        workerName: {
          type: String,
          default: '',
        },
        cost: {
          type: Number,
          default: 0,
        },
      },
    ],
    qrCodeId: {
      type: String,
      unique: true,
      index: true,
    },
    photoUrl: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    aiExtracted: {
      confidence: { type: Number, default: 0 },
      category: String,
      brand: String,
      modelNumber: String,
      serialNumber: String,
      manufacturingYear: Number,
      capacityOrSpecs: String,
      extractedAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate QR code unique identifier before validation/saving
applianceSchema.pre('validate', function (next) {
  if (!this.qrCodeId) {
    this.qrCodeId = `SF-APP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Appliance', applianceSchema);
