const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    phone: {
      type: String,
      // Google-auth users get a placeholder; real phone users get Indian number format
      // Unique sparse index is declared via userSchema.index() below
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },
    googleUid: {
      type: String,
      // sparse index defined below
    },
    avatar: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      minlength: 6,
      select: false, // never return password by default
    },
    role: {
      type: String,
      enum: ['customer', 'handyman', 'admin'],
      required: true,
      default: 'customer',
    },
    customerId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    // Handyman-specific fields (ignored for customers)
    workerId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    trade: {
      type: String,
      enum: [
        'Plumbing',
        'Electrical Repairs',
        'AC Service and Repair',
        'AC Service & Repair',
        'Refrigerator Repair',
        'Washing Machine Repair',
        'Water Purifier Service',
      ],
    },
    subServices: [
      {
        type: String,
      },
    ],
    location: {
      type: String,
    },
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    },
    locationUpdatedAt: {
      type: Date,
    },
    locationPoint: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [78.4809, 9.8433],
      }
    },
    currentLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] }
    },
    availabilityStatus: {
      type: String,
      enum: ['Available', 'Busy', 'Offline'],
      default: 'Offline'
    },
    ratePerHour: {
      type: Number, // stored in INR
    },
    isAvailable: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    // AI-generated Bio
    bioEn: {
      type: String,
      maxlength: 400,
      default: '',
    },
    bioTa: {
      type: String,
      maxlength: 400,
      default: '',
    },
    reviewSummary: {
      en: String,
      ta: String,
      basedOnCount: { type: Number, default: 0 },
      generatedAt: Date
    },
    bioGeneratedAt: {
      type: Date,
    },
    bioManuallyEdited: {
      type: Boolean,
      default: false,
    },
    // Handyman Verification & Document fields (KYC)
    aadhaarNumber: {
      type: String,
      trim: true,
    },
    aadhaarDocUrl: {
      type: String,
      default: '',
    },
    idProofType: {
      type: String,
      enum: ['driving_license', 'voter_id', 'pan_card', ''],
      default: 'driving_license',
    },
    idProofNumber: {
      type: String,
      trim: true,
    },
    idProofDocUrl: {
      type: String,
      default: '',
    },
    verificationStatus: {
      type: String,
      enum: ['Pending', 'Verified', 'Rejected'],
      default: 'Pending',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    identity: {
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
      verifiedAt: { type: Date },
      rejectionReason: { type: String, default: '' },
    },
    skill: {
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
      verifiedAt: { type: Date },
      rejectionReason: { type: String, default: '' },
    },
    experience: {
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
      videos: [
        {
          url: { type: String, required: true },
          caption: { type: String, default: '' },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
    },
    overallStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    aiInterview: {
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
      },
      score: { type: Number, default: 0 },
      qa: [
        {
          question: String,
          answer: String,
          evaluation: String
        }
      ],
      completedAt: { type: Date }
    },
    documents: {
      aadhaar: { type: String, default: '' },
      license: { type: String, default: '' },
      vehicleReg: { type: String, default: '' },
      insurance: { type: String, default: '' },
    },
    serviceTier: {
      type: String,
      enum: ['BikePro', 'AutoHandyman', 'MasterTech'],
      default: 'AutoHandyman',
    },
    // Handyman Bank & UPI Payout Details
    upiId: {
      type: String,
      trim: true,
      default: '',
    },
    upiPhone: {
      type: String,
      trim: true,
      default: '',
    },
    bankAccountName: {
      type: String,
      trim: true,
      default: '',
    },
    bankAccountNumber: {
      type: String,
      trim: true,
      default: '',
    },
    bankIfscCode: {
      type: String,
      trim: true,
      default: '',
    },
    bankName: {
      type: String,
      trim: true,
      default: '',
    },
    // Performance & Rating Stats (null by default for new providers)
    rating: {
      type: Number,
      default: null,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    jobsOffered: {
      type: Number,
      default: 0,
    },
    jobsAccepted: {
      type: Number,
      default: 0,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    // No-show strike tracking & Auto-suspension
    noShowCount: {
      type: Number,
      default: 0,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    trustedWorkerBadge: {
      type: Boolean,
      default: false,
    },
    // User Preferences
    preferredLanguage: {
      type: String,
      enum: ['en', 'ta'],
      default: 'en',
    },
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light',
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    // Demo data flag — set by seedDemoData.js; never touches real users
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving and generate customer ID
userSchema.pre('save', async function (next) {
  // Generate customerId for new customers
  if (this.isNew && this.role === 'customer' && !this.customerId) {
    let isUnique = false;
    while (!isUnique) {
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const newId = `CUST_${randomNum}`;
      const exists = await mongoose.models.User.findOne({ customerId: newId });
      if (!exists) {
        this.customerId = newId;
        isUnique = true;
      }
    }
  }

  if (!this.isModified('password') || !this.password) return next();
  // Don't re-hash already-hashed Google placeholder passwords stored as plain marker strings
  if (this.password.startsWith('google_oauth_') && !this.isNew) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 2dsphere index for location-based search
userSchema.index({ locationPoint: '2dsphere' });
userSchema.index({ currentLocation: '2dsphere' });
// Sparse unique indexes for optional fields
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ googleUid: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { sparse: true });

module.exports = mongoose.model('User', userSchema);
