# SMARTFIX — PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Project Name**: SmartFix / SmartFix On-Demand Service Platform  
**Document Version**: 1.0.0  
**Target Market**: Tamil Nadu & Surrounding Regions, Tamil Nadu, India  
**Architecture**: MERN Stack (Node.js, Express, MongoDB, React, Vite)  

---

## 1. Executive Overview & Strategic Purpose

SmartFix (formerly SmartFix) is an on-demand, hyper-local multi-portal service platform designed to seamlessly connect household consumers with background-verified, skilled handymen (plumbers, electricians, AC repair technicians, carpenters, painters, and appliance specialists).

The platform bridges traditional district-level home maintenance services with modern GPS radial dispatching, real-time socket tracking, in-app WebRTC calling, instant UPI wallet withdrawals, and transparent dynamic fare estimation.

---

## 2. Product Vision & Core Objectives

### 2.1 Product Vision
To empower homeowners with instant, transparent, 1-hour arrival home repair services while offering local skilled handymen consistent work opportunities, instant UPI earnings payouts, and digitized workflow management.

### 2.2 Core Objectives
- **Instant Dispatch**: Connect customers to handymen within a 5 km radial GPS distance.
- **Fair Pricing**: Provide transparent upfront pricing and distance-based fare calculation (BikePro, AutoHandyman, MasterTech).
- **KYC & Security Verification**: Ensure 100% background verification via Aadhaar and ID proof validation in the Admin Console.
- **Strict OTP Security**: Eliminate test/demo bypasses (`123456`) in favor of MongoDB-persisted, hashed, rate-limited OTP verification via Fast2SMS.

---

## 3. User Roles & Authorization Matrix

| Feature / Action | Customer | Handyman (Provider) | System Admin |
| :--- | :---: | :---: | :---: |
| Browse Services & Nearby Handymen | ✅ | ✅ (Excludes Self & Same Trade) | ✅ |
| Book Handyman Service | ✅ | ❌ | ❌ |
| Accept / Decline Dispatch Request | ❌ | ✅ | ❌ |
| Live GPS Location Tracking | Read-Only | Broadcast Active Job GPS | Monitor All |
| In-App WebRTC Call & Phone Masking | ✅ | ✅ | ❌ |
| Online Payment (Razorpay / UPI) | Pay | Receive (Wallet) | Audit |
| Earnings Withdrawal to Bank/UPI | ❌ | ✅ | Audit |
| KYC Document Verification | ❌ | Submit | Approve / Reject |
| Customer / Worker Account Blocking | ❌ | ❌ | ✅ |
| Platform Commission & Cashback Config | ❌ | ❌ | ✅ |

---

## 4. Detailed Portal Feature Requirements

### 4.1 Customer Portal (`/customer-dashboard`, `/browse`, `/booking`)
1. **Service Discovery & Filtering**:
   - Filter handymen by trade category (Plumbing, Electrical, AC Service, Washing Machine, Water Purifier, Refrigerator).
   - Enforce 5.0 km radial distance constraint from user's location.
   - Filter by max hourly rate (INR ₹) and city/town.
2. **Booking & Dispatch Engine**:
   - Select service tier:
     - **BikePro Express ⚡**: 15–20 min arrival.
     - **AutoHandyman Standard 🚗**: 25 min arrival.
     - **MasterTech Specialist 🚚**: Includes heavy tools & machinery.
   - Interactive map location picker for street address & landmarks.
3. **Live Job Tracking**:
   - Live Leaflet / Google Maps tracking showing real-time handyman GPS movement.
   - Interactive timeline status indicators.
4. **Payments & Reviews**:
   - Razorpay integration for UPI, Cards, NetBanking, and Cash on Delivery (COD).
   - Post-job rating (1 to 5 stars) and tags (Punctual, Polite, Clean Work).

### 4.2 Handyman / Provider Portal (`/handyman-dashboard`)
1. **Online/Offline Availability Toggle**:
   - Instant socket event broadcast of worker online status to nearby customers.
   - Background GPS watch loop updating live coordinates to socket server.
2. **Dispatch Request Popup Modal**:
   - Real-time 30-second countdown alert when a customer books within 5 km.
   - Customer address, sub-services required, fare amount, and distance.
   - One-tap "Accept Job" or "Decline & Pass to Next Captain".
3. **Active Job Management**:
   - Step-by-step job progress updater: `Accepted` → `EnRoute` → `Arrived` → `WorkInProgress` → `Completed`.
   - Direct In-App WebRTC voice call to customer.
4. **Wallet & Payouts**:
   - Live wallet balance updated automatically after job completion (minus platform commission).
   - Instant UPI / Direct Bank transfer withdrawal requests.

### 4.3 Admin Portal (`/admin`)
1. **Pending KYC Worker Verification Queue**:
   - Review submitted Aadhaar 12-digit number, Aadhaar doc scan, and trade proof.
   - One-click "Approve Worker ✅" or "Reject Document ❌" with mandatory rejection reason.
2. **Customer Account Management**:
   - Toggle block/unblock status for problematic customer accounts.
3. **Platform Analytics & Financial Overview**:
   - Total active bookings, completed jobs, total revenue, platform commission earnings.

---

## 5. Booking Lifecycle & State Machine

Every SmartFix booking follows a strict, controlled state transition flow:

```
[PendingDispatch] ──► [Accepted] ──► [Confirmed] ──► [EnRoute] ──► [Arrived]
                           │                                          │
                           ▼                                          ▼
                      [Declined]                             [WorkInProgress]
                                                                      │
                                                                      ▼
                      [Cancelled] ◄─────────────────────────── [Completed]
                                                                      │
                                                                      ▼
                                                                  [Paid]
                                                                      │
                                                                      ▼
                                                             [Reviewed]
```

### State Rules:
- **PendingDispatch**: Initial state after customer initiates booking. Broadcasted to nearby handymen.
- **Accepted**: Handyman accepts dispatch within 30 seconds.
- **EnRoute / Arrived / WorkInProgress**: Handyman updates progress on job site.
- **Completed**: Handyman marks repair complete. Triggers customer payment request.
- **Paid**: Razorpay signature verified server-side; commission split applied to handyman wallet.
- **Reviewed**: Customer submits star rating & feedback.

---

## 6. Payment, Wallet & Commission Architecture

1. **Payment Gateways**:
   - Razorpay Web SDK integration with backend signature verification (`HMAC-SHA256`).
   - Cash on Delivery (COD) fallback.
2. **Commission & Wallet Calculation**:
   - Platform Commission = `Booking Amount * (Commission % / 100)` (Default: 10–15%).
   - Worker Earning = `Booking Amount - Platform Commission`.
   - Customer Cashback = Calculated based on promotional campaigns configured in Admin Console.
3. **Withdrawals**:
   - Handymen can initiate UPI (`phonepe@upi`, `gpay@upi`) or NEFT/IMPS bank payouts.

---

## 7. OTP Security Requirements (Non-Negotiable)

To upgrade SmartFix to production standards, the current in-memory / hardcoded OTP logic must be replaced with strict database-backed controls:

1. **NO Universal OTP Bypass**:
   - Hardcoded `123456` bypass must be completely deleted from all routes and controllers.
2. **MongoDB OTP Persistence**:
   - OTP records stored in dedicated `Otp` collection with fields: `phone`, `purpose`, `otpHash`, `expiresAt`, `attempts`, `lastSentAt`, `consumedAt`.
3. **Bcrypt Hashing**:
   - OTP digits (6-digit random number) are hashed using `bcrypt` before database write.
4. **Expiration & Cooldown Rules**:
   - **Lifetime**: 5 minutes (`expiresAt`).
   - **Resend Cooldown**: 60 seconds between resend requests.
   - **Max Attempts**: Maximum 5 failed attempts allowed before marking OTP invalid.
   - **Consumption**: Set `consumedAt = Date.now()` immediately upon successful verification.

---

## 8. Non-Functional Requirements (NFRs)

- **Security**:
  - JWT authorization tokens signed with strong secret key.
  - Passwords hashed with `bcryptjs` (min 10 salt rounds).
  - Strict input sanitization against SQL/NoSQL injection and XSS.
- **Performance**:
  - React frontend initial bundle size kept under 600 kB via route code-splitting.
  - MongoDB database indexes on `User.phone`, `Booking.customer`, `Booking.worker`, `Otp.phone`.
- **Reliability & Offline Fallback**:
  - Smooth UI fallback to cached mock data if backend connection drops during offline testing.

---

## 9. Success Criteria & Definition of Done (DoD)

SmartFix PRD requirements are fulfilled when:
1. Customers can register, login with OTP, search handymen within 5 km, book services, and pay via Razorpay.
2. Handymen receive real-time socket dispatch popups, accept jobs, update progress, broadcast live GPS, and withdraw earnings.
3. Admins can verify worker KYC documents, block malicious users, and configure commission rates.
4. All OTP security rules (hashing, expiry, 5-attempt limit, 60s cooldown, no `123456` bypass) are 100% enforced in MongoDB.
