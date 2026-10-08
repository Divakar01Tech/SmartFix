const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    trade: {
      type: String,
      required: true,
    },
    subServices: [{ type: String }],
    date: {
      type: String,
    },
    time: {
      type: String,
    },
    address: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
    },
    aiSuggested: {
      category: String,
      subService: String,
      urgency: { type: String, enum: ['Low', 'Medium', 'Emergency'] },
      priceMin: Number,
      priceMax: Number,
      confidence: Number,
      acceptedByUser: Boolean
    },
    price: {
      type: Number, // stored in INR
      required: true,
    },
    status: {
      type: String,
      enum: [
        'PendingDispatch',
        'Pending',
        'Accepted',
        'Confirmed',
        'EnRoute',
        'Arrived',
        'WorkInProgress',
        'Completed',
        'Paid',
        'Reviewed',
        'Cancelled',
        'Declined',
        'SLABreached',
        // legacy aliases
        'CaptainArrived',
        'InProgress',
      ],
      default: 'Pending',
    },
    serviceTier: {
      type: String,
      enum: ['BikePro', 'AutoHandyman', 'MasterTech'],
      default: 'AutoHandyman',
    },
    userLat: {
      type: Number,
    },
    userLng: {
      type: Number,
    },
    pickupLat: {
      type: Number,
      default: 9.9252,
    },
    pickupLng: {
      type: Number,
      default: 78.1198,
    },
    distanceKm: {
      type: Number,
      default: 2.5,
    },
    estimatedMinutes: {
      type: Number,
      default: 15,
    },
    paymentStatus: {
      type: String,
      enum: ['Unpaid', 'Paid'],
      default: 'Unpaid',
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Card', 'NetBanking', 'COD', 'None'],
      default: 'None',
    },
    transactionId: {
      type: String,
    },
    // SLA Fields — provider must arrive within 60 min of acceptance
    acceptedAt: {
      type: Date,
    },
    slaDeadline: {
      type: Date, // acceptedAt + 60 minutes
    },
    slaBreached: {
      type: Boolean,
      default: false,
    },
    breachDistanceMeters: {
      type: Number,
      default: null,
    },
    slaWarningSent: {
      type: Boolean,
      default: false,
    },
    slaRisk: {
      level: { type: String, enum: ['low', 'medium', 'high'] },
      predictedArrival: { type: Date },
      minutesLate: { type: Number },
      computedAt: { type: Date }
    },
    slaRiskNotified: {
      type: Boolean,
      default: false
    },
    slaPredictionOutcome: {
      type: String,
      enum: ['PredictedLate_ActuallyLate', 'PredictedLate_ActuallyOnTime', 'PredictedOnTime_ActuallyLate', 'PredictedOnTime_ActuallyOnTime', null],
      default: null
    },
    dispatchFailed: {
      type: Boolean,
      default: false,
    },
    workProof: {
      beforePhotos: [{ type: String }],
      afterPhotos: [{ type: String }],
      aiVerification: {
        matchesBookedService: { type: Boolean },
        workAppearsComplete: { type: Boolean },
        confidence: { type: Number },
        summary: { type: String },
        concerns: [{ type: String }],
        verifiedAt: { type: Date }
      },
      aiVerificationFailed: { type: Boolean, default: false }
    },
    cancelReason: {
      type: String,
    },
    riskScore: {
      type: Number,
      default: null,
    },
    riskFlag: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    riskFactors: {
      type: [String],
      default: [],
    },
    completionNotes: {
      type: String,
    },
    lastReminderSentAt: {
      type: Date,
    },
    // Payment & Commission splits
    commissionPercent: {
      type: Number,
      default: 10,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    providerPayout: {
      type: Number,
      default: 0,
    },
    customerCashback: {
      type: Number,
      default: 0,
    },
    razorpayOrderId: {
      type: String,
    },
    // 5% Online Payment Worker Reward & Bonus Fields
    isOnlinePayment: {
      type: Boolean,
      default: false,
    },
    workerBonusAmount: {
      type: Number,
      default: 0, // 5% bonus reward if paid online
    },
    workerTotalPayout: {
      type: Number,
      default: 0, // 90% base + 5% bonus = 95% total
    },
    phoneUnlocked: {
      type: Boolean,
      default: false,
    },
    workerCurrentLat: {
      type: Number,
    },
    workerCurrentLng: {
      type: Number,
    },
    workerLocationUpdatedAt: {
      type: Date,
    },
    // Status-transition timestamps (referenced in controller but were missing from schema)
    enRouteAt: { type: Date },
    arrivedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    paidAt: { type: Date },
    reviewedAt: { type: Date },
    // ---------------------------------------------------------------
    // Live GPS Tracking sub-document
    // Active only between status: EnRoute → Arrived (or Cancelled/SLABreached)
    // ---------------------------------------------------------------
    tracking: {
      isActive: { type: Boolean, default: false },
      startedAt: { type: Date },   // when EnRoute began
      endedAt: { type: Date },     // when Arrived / Cancelled
      lastLat: { type: Number },
      lastLng: { type: Number },
      lastUpdatedAt: { type: Date },
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
    },
    customerRatingForWorker: {
      type: Number,
      min: 1,
      max: 5,
    },
    workerRatingForCustomer: {
      type: Number,
      min: 1,
      max: 5,
    },
    workerReview: {
      type: String,
    },
    aiAnalysis: {
      aspects: {
        punctuality: { type: Number, default: null },
        behaviour: { type: Number, default: null },
        cleanliness: { type: Number, default: null },
        price_fairness: { type: Number, default: null }
      },
      summary: { type: String, default: '' },
      suspicious: { type: Boolean, default: false }
    },
    // Photo Proof of Work
    beforePhotoUrls: [{ type: String }],
    afterPhotoUrls: [{ type: String }],
    // Detailed Cancellation Tracking
    cancelledBy: {
      type: String,
      enum: ['customer', 'worker', 'admin', 'system'],
    },
    cancellationReason: {
      type: String,
    },
    cancelledAt: {
      type: Date,
    },
    // Generated PDF Invoice Path / URL
    invoicePath: {
      type: String,
    },
    // Google Drive Attachments (photos, invoices, documentation)
    attachments: [
      {
        fileName: {
          type: String,
          required: true,
          trim: true,
        },
        googleDriveId: {
          type: String,
          required: true,
          trim: true,
        },
        viewLink: {
          type: String,
          required: true,
          trim: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Demo data flag — set by seedDemoData.js; never touches real bookings
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
