# SMARTFIX — BACKEND DATABASE SCHEMA

**Project Name**: SmartFix / HandyBook Platform  
**Database**: MongoDB Atlas  
**ODM**: Mongoose  

---

## 1. User Model Schema (`models/User.js`)

```javascript
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'handyman', 'admin'], default: 'customer' },
  trade: { type: String, default: null }, // e.g. Plumbing, Electrical
  subServices: [{ type: String }],
  location: { type: String, default: 'Sivagangai Town' },
  latitude: { type: Number, default: 9.8433 },
  longitude: { type: Number, default: 78.4809 },
  ratePerHour: { type: Number, default: 350 },
  isAvailable: { type: Boolean, default: true },
  isOnline: { type: Boolean, default: true },
  aadhaarNumber: { type: String, default: '' },
  aadhaarDocUrl: { type: String, default: '' },
  idProofDocUrl: { type: String, default: '' },
  verificationStatus: { type: String, enum: ['Unverified', 'Pending', 'Approved', 'Rejected'], default: 'Unverified' },
  rejectionReason: { type: String, default: '' },
  upiId: { type: String, default: '' },
  bankAccountName: { type: String, default: '' },
  bankName: { type: String, default: '' },
  bankAccountNumber: { type: String, default: '' },
  bankIfscCode: { type: String, default: '' },
  isBlocked: { type: Boolean, default: false },
  rating: { type: Number, default: 4.8 },
  ratingCount: { type: Number, default: 12 },
  preferredLanguage: { type: String, enum: ['en', 'ta'], default: 'en' },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
}, { timestamps: true });
```

---

## 2. Secure OTP Model Schema (`models/Otp.js`)

```javascript
const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  purpose: { type: String, enum: ['register', 'login', 'forgot-password'], required: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // Auto TTL delete
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, default: Date.now },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });
```

---

## 3. Booking Model Schema (`models/Booking.js`)

```javascript
const bookingSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trade: { type: String, required: true },
  subServices: [{ type: String }],
  date: { type: String, required: true },
  time: { type: String, required: true },
  address: { type: String, required: true },
  notes: { type: String, default: '' },
  price: { type: Number, required: true },
  status: {
    type: String,
    enum: ['PendingDispatch', 'Pending', 'Accepted', 'Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress', 'Completed', 'Paid', 'Reviewed', 'Cancelled', 'Declined'],
    default: 'PendingDispatch',
  },
  serviceTier: { type: String, enum: ['BikePro', 'AutoHandyman', 'MasterTech'], default: 'AutoHandyman' },
  userLat: { type: Number, default: 9.8433 },
  userLng: { type: Number, default: 78.4809 },
  distanceKm: { type: Number, default: 2.5 },
  estimatedMinutes: { type: Number, default: 15 },
  paymentStatus: { type: String, enum: ['Pending', 'Paid', 'Refunded'], default: 'Pending' },
  paymentMethod: { type: String, enum: ['Online', 'UPI', 'Card', 'COD'], default: 'Online' },
  razorpayOrderId: { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  commission: { type: Number, default: 0 },
  workerEarning: { type: Number, default: 0 },
  rating: { type: Number, default: null },
  review: { type: String, default: '' },
}, { timestamps: true });
```

---

## 4. Wallet & Withdrawal Schema (`models/Wallet.js`)

```javascript
const walletSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },
  transactions: [{
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    referenceId: { type: String },
    date: { type: Date, default: Date.now }
  }]
}, { timestamps: true });
```
