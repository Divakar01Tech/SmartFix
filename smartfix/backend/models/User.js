const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      // Phone is strictly a profile detail (+91 format /^[6-9]\d{9}$/)
      // Stored privately and never used as an identifier for authentication
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      required: [true, 'Email is required'],
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    authProviders: {
      type: [String],
      default: ['password'],
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    googleUid: {
      type: String,
      sparse: true,
    },
    address: {
      type: String,
    },
    district: {
      type: String,
    },
    state: {
      type: String,
    },
    categories: [
      {
        type: String,
      },
    ],
    avatar: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      minlength: 6,
      select: false, // never return password by default (optional for Google-only users)
    },
    role: {
      type: String,
      enum: ['customer', 'handyman', 'worker', 'admin'],
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
      enum: ['pending_verification', 'approved', 'rejected', 'suspended', 'Pending', 'Verified', 'Rejected'],
      default: 'pending_verification',
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    // Worker KYC fields (Masked IDs and private documents)
    kyc: {
      aadhaarLast4: { type: String, default: '' },
      secondIdType: { type: String, default: '' },
      secondIdLast4: { type: String, default: '' },
      aadhaarFrontPath: { type: String, default: '' },
      aadhaarBackPath: { type: String, default: '' },
      secondIdPath: { type: String, default: '' },
    },
    interview: {
      transcriptSummary: { type: String, default: '' },
      scores: {
        practicalSpecificity: { type: Number, default: 0 },
        safetyAwareness: { type: Number, default: 0 },
        diagnosisLogic: { type: Number, default: 0 },
        communicationClarity: { type: Number, default: 0 },
      },
      aiVerdict: { type: String, enum: ['pass', 'borderline', 'fail', ''], default: '' },
      completedAt: { type: Date },
    },
    interviewSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      default: null,
    },
    // Worker availability enum: 'available', 'busy', 'offline'
    availability: {
      type: String,
      enum: ['available', 'busy', 'offline'],
      default: 'offline',
    },
    // Login lockout security fields
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    // Admin review metadata
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    // Admin feedback, instructions, warnings, and disciplinary directives
    adminFeedbacks: [
      {
        feedbackId: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
        message: { type: String, required: true },
        feedbackType: {
          type: String,
          enum: ['instruction', 'warning', 'praise', 'disciplinary', 'correction'],
          default: 'instruction',
        },
        adminEmail: { type: String, default: '' },
        actionTaken: {
          type: String,
          enum: ['none', 'warning_issued', 'suspended', 'reinstated', 'blocked'],
          default: 'none',
        },
        createdAt: { type: Date, default: Date.now },
      },
    ],
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
    // Worker Earnings Tracking (in INR)
    earnings: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
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
  // Sync name and fullName
  if (this.fullName && !this.name) {
    this.name = this.fullName;
  }
  if (this.name && !this.fullName) {
    this.fullName = this.name;
  }

  // Sync availability enum with legacy status fields
  if (this.availability) {
    const capitalized = this.availability.charAt(0).toUpperCase() + this.availability.slice(1);
    this.availabilityStatus = capitalized;
    this.isAvailable = this.availability === 'available';
    this.isOnline = this.availability !== 'offline';
  }

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
  // Skip if password is already hashed with bcrypt ($2a$ or $2b$)
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password || !enteredPassword) {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

// Return safe user object
userSchema.methods.toSafeUser = function () {
  return {
    _id: this._id,
    id: this._id,
    name: this.name,
    fullName: this.fullName || this.name,
    email: this.email,
    phone: this.phone || '',
    role: this.role,
    isEmailVerified: !!this.isEmailVerified,
    profileCompleted: !!this.profileCompleted,
    authProviders: this.authProviders || ['password'],
    address: this.address || '',
    district: this.district || '',
    state: this.state || '',
    avatar: this.avatar || '',
    preferredLanguage: this.preferredLanguage || 'en',
    theme: this.theme || 'light',
    verificationStatus: this.verificationStatus,
  };
};

// Return safe worker object (allowlist-based, never leaks passwords, unmasked IDs, or raw KYC files)
userSchema.methods.toSafeWorker = function () {
  const catList = Array.isArray(this.categories) && this.categories.length > 0
    ? this.categories
    : (this.trade ? [this.trade] : []);

  return {
    _id: this._id,
    id: this._id,
    fullName: this.fullName || this.name,
    name: this.name || this.fullName,
    email: this.email,
    phone: this.phone,
    role: this.role,
    address: this.address || '',
    district: this.district || '',
    state: this.state || '',
    categories: catList,
    trade: this.trade || catList[0] || '',
    verificationStatus: this.verificationStatus || 'pending_verification',
    rejectionReason: this.rejectionReason || '',
    isEmailVerified: !!this.isEmailVerified,
    profileCompleted: !!this.profileCompleted,
    authProviders: this.authProviders || ['password'],
    kyc: {
      aadhaarLast4: this.kyc?.aadhaarLast4 ? `XXXX-XXXX-${this.kyc.aadhaarLast4}` : '',
      secondIdType: this.kyc?.secondIdType || '',
      secondIdLast4: this.kyc?.secondIdLast4 ? `XXXX-${this.kyc.secondIdLast4}` : '',
      hasAadhaarFront: !!this.kyc?.aadhaarFrontPath,
      hasAadhaarBack: !!this.kyc?.aadhaarBackPath,
      hasSecondId: !!this.kyc?.secondIdPath,
    },
    interview: {
      transcriptSummary: this.interview?.transcriptSummary || '',
      scores: this.interview?.scores || null,
      aiVerdict: this.interview?.aiVerdict || '',
      completedAt: this.interview?.completedAt || null,
    },
    availability: this.availability || (this.availabilityStatus?.toLowerCase() || 'offline'),
    rating: this.rating,
    ratingCount: this.ratingCount || 0,
    workerId: this.workerId || '',
    isBlocked: !!this.isBlocked,
    isSuspended: !!this.isSuspended,
    adminFeedbacks: this.adminFeedbacks || [],
    createdAt: this.createdAt,
  };
};

// 2dsphere index for location-based search
userSchema.index({ locationPoint: '2dsphere' });
userSchema.index({ currentLocation: '2dsphere' });
// Phone is profile-only (non-unique index)
userSchema.index({ phone: 1 });

module.exports = mongoose.model('User', userSchema);
