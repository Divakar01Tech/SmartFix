# SMARTFIX — TECHNICAL REQUIREMENTS DOCUMENT (TRD)

**Project Name**: SmartFix / SmartFix Platform  
**Document Version**: 1.0.0  
**Stack**: MERN (MongoDB, Express, React, Node.js)  

---

## 1. Technology Stack

| Layer | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Frontend Framework** | React.js | ^18.2.0 |
| **Build Tool & Bundler** | Vite | ^5.4.14 (With manualChunks optimization) |
| **Styling** | Vanilla CSS3 | Modular CSS, Custom CSS Variables, Dark/Light Mode |
| **Backend Runtime** | Node.js | v18+ ESM Engine |
| **API Framework** | Express.js | ^4.18.2 |
| **Database** | MongoDB | MongoDB Atlas (Cloud) & Local Mongoose ODM ^8.0.0 |
| **Authentication** | JWT & BcryptJS | Bearer Token Auth + OTP Hashing |
| **SMS & OTP Gateway** | Fast2SMS API | Transational SMS Route |
| **Real-Time Engine** | Socket.IO | ^4.8.3 (WebSocket + Long Polling) |
| **Payment Gateway** | Razorpay SDK | Razorpay Web Checkout + HMAC Verification |
| **Maps & Location** | Leaflet & OpenStreetMap | Fallback Google Maps API support |
| **AI Assistant Service** | OpenRouter / Gemini API | SmartFix AI Chatbot |

---

## 2. System Architecture

```
                 SMARTFIX ARCHITECTURE
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
CUSTOMER PORTAL     PROVIDER PORTAL       ADMIN PORTAL
   (React.js)          (React.js)          (React.js)
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                     React Frontend
                           │
                       REST API
                           │
                   Node.js + Express
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
 MongoDB Atlas         Fast2SMS            Razorpay
(Primary Database)   (OTP Gateway)      (Payment Gateway)
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    Cloud Deployment
```

---

## 3. Directory Structure

### Backend Structure (`/backend`)
```
backend/
├── config/
│   └── db.js                 # MongoDB Mongoose Connection
├── controllers/
│   ├── authController.js     # Register, Login, OTP, Reset Password
│   ├── bookingController.js  # Create, Accept, Status, History
│   ├── dispatchController.js # Fare Calculation, 5km Radial Search
│   ├── adminController.js    # KYC Verification, Customer Block, Analytics
│   └── walletController.js   # Earnings, Withdrawal Requests
├── middleware/
│   ├── authMiddleware.js     # JWT Verification & Role Authorization
│   └── rateLimiter.js        # API & OTP Rate Limiting
├── models/
│   ├── User.js               # Customer, Handyman, Admin Schema
│   ├── Booking.js            # Booking Lifecycle Schema
│   ├── Otp.js                # Hashed OTP Storage Schema
│   ├── Payment.js            # Razorpay Transaction Schema
│   ├── Wallet.js             # Provider Balance & Payout History
│   ├── WorkerLocation.js     # Live GPS Breadcrumbs
│   └── CommissionConfig.js   # Dynamic Admin Platform Commission
├── routes/
│   ├── authRoutes.js
│   ├── bookingRoutes.js
│   ├── dispatchRoutes.js
│   ├── adminRoutes.js
│   └── walletRoutes.js
├── socket/
│   └── socketHandler.js      # Dispatch Alert Rooms & GPS Updates
├── server.js                 # Express App Initialization
└── .env                      # Environment Variables
```

---

## 4. Security & Authentication Requirements

### 4.1 Strict OTP Security Pipeline
```
[User Request OTP] ──► [Check 60s Cooldown] ──► [Generate 6-digit OTP]
                                                        │
                                                        ▼
[User Enter OTP]   ──► [Verify Hash]        ──► [Bcrypt Hash OTP]
       │                        │                       │
       ▼                        ▼                       ▼
[Compare Hash]     ──► [Consume OTP]        ──► [Save to MongoDB]
                                                        │
                                                        ▼
                                             [Send via Fast2SMS API]
```

#### Non-Negotiable OTP Rules:
1. **NO Universal Bypass**: `otp === '123456'` test logic is strictly forbidden in production.
2. **Bcrypt Hashing**: All 6-digit OTP numbers must be hashed before saving to `Otp` collection.
3. **5-Minute Expiry**: Records automatically expire after 300 seconds.
4. **Max 5 Failed Attempts**: If `attempts >= 5`, mark OTP invalid and require new request.
5. **60-Second Cooldown**: Block consecutive OTP requests within 60 seconds.

---

## 5. API Endpoints Overview

| Group | Method | Endpoint | Description | Protected |
| :--- | :---: | :--- | :--- | :---: |
| Auth | POST | `/api/auth/send-otp` | Request OTP via Fast2SMS | No |
| Auth | POST | `/api/auth/verify-otp` | Verify Hashed OTP & Generate JWT | No |
| Auth | POST | `/api/auth/login` | Phone + Password Auth | No |
| Workers | GET | `/api/workers` | Get Handymen (5 km Radial Filter) | Yes |
| Dispatch | POST | `/api/dispatch/estimate-fare` | Calculate Tier Price & Distance | Yes |
| Dispatch | POST | `/api/dispatch/request` | Broadcast On-Demand Job Request | Yes |
| Bookings | GET | `/api/bookings/my` | Get User/Worker Bookings | Yes |
| Bookings | PATCH | `/api/bookings/:id/status` | Update Booking Lifecycle State | Yes |
| Payments | POST | `/api/payments/create-order` | Generate Razorpay Order ID | Yes |
| Payments | POST | `/api/payments/verify` | Verify Razorpay Signature & Split | Yes |
| Wallet | POST | `/api/wallet/withdraw` | Request UPI/Bank Transfer Payout | Yes |
| Admin | GET | `/api/admin/pending-captains` | Get KYC Verification Queue | Admin |
| Admin | PATCH | `/api/admin/verify-captain/:id` | Approve/Reject Worker KYC | Admin |

---

## 6. Real-Time Communication Specification (Socket.IO)

SmartFix uses Socket.IO rooms to isolate real-time notifications securely:

- **Private User Room**: `user_<userId>` (Used for incoming dispatch alerts & payment notifications).
- **Private Booking Room**: `booking_<bookingId>` (Used for active GPS worker tracking & status transitions).
- **Event List**:
  - `join-user`: User connects and joins their private channel.
  - `new-dispatch-request`: Server broadcasts 30s job popup to nearby handyman.
  - `booking-updated`: Server broadcasts status changes to customer and handyman.
  - `update-location`: Handyman device broadcasts GPS coordinates (`lat`, `lng`).
