# SMARTFIX — FULL WEBSITE IMPLEMENTATION PLAN

**Project Name**: SmartFix / SmartFix Platform  
**Document Version**: 1.0.0  

---

## 1. Master Development Order

```
[SMARTFIX PROTO-STATE (~50% Complete)]
                │
                ▼
      [0. ARCHITECTURE & DOCS] (Completed)
                │
                ▼
      [1. OTP SECURITY FIXES]
      - Remove hardcoded 123456 bypass
      - Create Otp.js model in MongoDB
      - Implement Bcrypt OTP hashing
      - 5-min expiry + 60s cooldown + 5-attempt limit
                │
                ▼
      [2. AUTHENTICATION & FIREBASE CLEANUP]
      - Pure Fast2SMS + MongoDB OTP Pipeline
      - Cleanup unused Firebase frontend files
                │
                ▼
      [3. REMOVE MOCK DATA & IN-MEMORY STORES]
      - Replace mockData.js fallbacks with MongoDB persistence
                │
                ▼
      [4. BOOKING ENGINE & STATE MACHINE]
      - Enforce state transitions (Pending ─► Accepted ─► InProgress ─► Completed ─► Paid)
                │
                ▼
      [5. REAL-TIME SOCKET & LIVE GPS TRACKING]
      - Private Socket rooms (`user_<id>`, `booking_<id>`)
      - Live Leaflet GPS breadcrumb stream
                │
                ▼
      [6. RAZORPAY PAYMENTS & WALLET COMMISSION]
      - Razorpay HMAC verification & payout split
                │
                ▼
      [7. ADMIN CONSOLE & KYC VERIFICATION]
      - KYC verification queue & customer block/unblock
                │
                ▼
      [8. MONGODB ATLAS CLOUD MIGRATION]
      - Seed production database & index fields
                │
                ▼
      [9. GOOGLE CLOUD RUN DEPLOYMENT & TESTING]
      - Deploy Node.js Express API & React Vite Frontend
```

---

## 2. Phase Breakdown & Execution Milestones

### Phase 1: Security Foundation (Immediate Target)
- Task 1.1: Remove `123456` bypass from `authController.js`.
- Task 1.2: Build `models/Otp.js` schema with TTL index and attempts counter.
- Task 1.3: Update `sendOtp` and `verifyOtp` API endpoints to store and verify bcrypt-hashed OTPs.
- Task 1.4: Implement 60-second resend cooldown timer.

### Phase 2: Booking & Dispatch System
- Task 2.1: Enforce 5 km distance rule in radial handyman search.
- Task 2.2: Implement 30-second handyman dispatch request countdown modal.
- Task 2.3: Wire Socket.IO notifications for instant booking updates.

### Phase 3: Payments & Wallet Payouts
- Task 3.1: Complete Razorpay backend signature verification (`HMAC-SHA256`).
- Task 3.2: Implement automatic platform commission split into Handyman Wallet balance.
- Task 3.3: Enable UPI and direct Bank account withdrawal handling.

### Phase 4: Production Deployment & QA
- Task 4.1: Deploy MongoDB Atlas instance and update `MONGO_URI`.
- Task 4.2: Build static production bundle (`npm run build`).
- Task 4.3: Perform end-to-end security and role authorization audit.
