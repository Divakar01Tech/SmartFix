# SmartFix — SmartFix

> **OTP-Verified Home Service Booking Platform · Tamil Nadu, Tamil Nadu**
> Academic reference: IEEE DOI 10.1109/ICSPC51351.2021.9451783

A full-stack MERN application that connects customers with verified local handymen (plumbers, electricians, AC technicians, refrigerator/washing machine/water-purifier repairers) within Tamil Nadu. All bookings, workers, and addresses are geographically restricted to the district. Pricing in ₹ (INR), phone numbers in +91 format, bilingual UI (English / Tamil).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Folder Structure](#folder-structure)
3. [Setup — Backend](#setup--backend)
4. [Setup — Frontend](#setup--frontend)
5. [Environment Variables](#environment-variables)
6. [App Flow Summary](#app-flow-summary)
7. [API Reference](#api-reference)
8. [Service Categories & Sub-Services](#service-categories--sub-services)
9. [Business Rules](#business-rules)
10. [Socket.IO Events](#socketio-events)

---

## Architecture Overview

```
Customer / Handyman / Admin (Browser)
         │
         │  HTTPS + WebSocket (Socket.IO)
         ▼
   Vite + React Frontend  (port 5173 / hosted via ngrok)
         │
         │  REST API calls to /api/*
         ▼
   Express + Node.js Backend  (port 5000)
         │
         ├─► MongoDB Atlas (Mongoose ODM)
         ├─► Fast2SMS   (OTP delivery)
         ├─► Razorpay   (payment gateway)
         └─► Socket.IO  (live GPS + booking events)
```

---

## Folder Structure

```
smartfix/
├── backend/
│   ├── config/
│   │   ├── db.js                  # MongoDB Atlas connection
│   │   ├── serviceCategories.js   # 6 fixed service categories + sub-service validation
│   │   └── seed.js / seedHandymen.js
│   ├── controllers/
│   │   ├── authController.js      # Register, Login (OTP + password), Forgot password
│   │   ├── otpController.js       # OTP generation, hashing, verification
│   │   ├── bookingController.js   # Create, update status, SLA enforcement, payment
│   │   ├── adminController.js     # KYC queue, analytics, bookings overview, wallet
│   │   ├── commissionController.js# Platform commission % config
│   │   ├── workerController.js    # Worker profile, availability, earnings
│   │   └── walletController.js    # Customer wallet balance + transactions
│   ├── middleware/
│   │   └── authMiddleware.js      # protect (JWT), requireAdmin
│   ├── models/
│   │   ├── User.js                # customer / handyman / admin; KYC fields, sub-services
│   │   ├── Booking.js             # Full lifecycle + SLA + commission + sub-services
│   │   ├── OTP.js                 # Hashed OTP + expiry + attempt tracking
│   │   ├── CommissionConfig.js    # Platform commission % and cashback %
│   │   ├── Wallet.js              # Customer wallet balance + transaction log
│   │   └── WorkerLocation.js      # Historical GPS breadcrumb store
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── adminRoutes.js
│   │   ├── workerRoutes.js
│   │   ├── walletRoutes.js
│   │   └── commissionRoutes.js
│   ├── services/
│   │   ├── smsService.js          # Fast2SMS OTP dispatch
│   │   ├── otpService.js          # Hash store / verify logic
│   │   └── geocodingService.js    # Tamil Nadu boundary validation
│   ├── socket/
│   │   └── locationSocket.js      # All Socket.IO event handlers
│   ├── utils/
│   │   └── sanitizer.js           # Role-based field masking (hides worker phone before Confirmed)
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── Footer.jsx
    │   │   ├── WorkerCard.jsx
    │   │   ├── AddWorkerModal.jsx
    │   │   └── RazorpayButton.jsx
    │   ├── context/
    │   │   ├── AuthContext.jsx     # JWT + user state
    │   │   └── LanguageContext.jsx # English / Tamil toggle
    │   ├── data/
    │   │   └── servicesData.js     # 6 service categories (mirrors backend serviceCategories.js)
    │   ├── pages/
    │   │   ├── Home.jsx
    │   │   ├── Login.jsx           # OTP + password auth; KYC + sub-service registration
    │   │   ├── Browse.jsx          # Worker search (GPS proximity, category, sub-service filter)
    │   │   ├── Booking.jsx         # Sub-service selection, GPS address, live tracking
    │   │   ├── CustomerDashboard.jsx
    │   │   ├── HandymanDashboard.jsx
    │   │   └── AdminPanel.jsx      # KYC queue, bookings, commission config, wallet overview
    │   ├── services/
    │   │   ├── api.js              # All REST call wrappers
    │   │   └── socket.js           # Socket.IO client singleton
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Setup — Backend

```bash
cd backend
npm install
copy .env.example .env      # Windows
# or
cp .env.example .env        # macOS / Linux
```

Edit `.env` (see [Environment Variables](#environment-variables)), then:

```bash
npm run dev        # nodemon — hot reload, port 5000
```

---

## Setup — Frontend

```bash
cd frontend
npm install
npm run dev        # Vite dev server — port 5173
# or for LAN / ngrok hosting:
npm run host       # vite --host
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) |
| `FAST2SMS_API_KEY` | Fast2SMS API key for OTP SMS delivery |
| `RAZORPAY_KEY_ID` | Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret |
| `PORT` | Backend port (default: `5000`) |

---

## App Flow Summary

### 1. Authentication

```
Register
  └─► Phone → OTP (Fast2SMS) → Verify → Fill profile
        [handyman only] Aadhaar + ID proof (KYC)
        [handyman only] Select trade + sub-services + taluk
  └─► Account created
        customer  → active immediately
        handyman  → verificationStatus = "Pending", blocked until admin approves

Login
  ├─► OTP login  (phone → OTP → verify → JWT)
  └─► Password login (phone + password → JWT)

Admin login: ONLY phone 7604975206 is accepted.
```

### 2. Customer Booking

```
Dashboard → Browse → Select category → Filter by sub-service
→ Enter address (GPS / pin) → backend validates within Tamil Nadu
→ Booking created (status: "Pending")
→ Nearby verified worker notified via Socket.IO
→ Worker accepts → status: "Confirmed" → 1-hour SLA countdown begins
→ Customer sees live GPS map of worker, ETA, SLA timer
→ Worker: En Route → Arrived → Work In Progress → Completed
→ Customer pays via Razorpay (or uses wallet balance first)
→ Commission deducted; cashback credited to customer wallet; payout to worker
→ Customer rates worker → status: "Reviewed"
```

### 3. Worker Job Flow

```
Login (only available after admin approves KYC)
→ Job request received (Socket.IO) — approximate area only, address hidden
→ Accept within time window → full address + Google Maps deep link shown
→ Update status: En Route → Arrived → Work In Progress → Completed
→ Earnings dashboard updated after customer payment
```

### 4. Admin Panel

| Tab | Capability |
|---|---|
| **Workers** | View all verified workers; remove workers |
| **Pending KYC** | Review Aadhaar + ID docs; Approve / Reject with reason |
| **Customers** | View customer accounts; Block / Unblock |
| **Bookings** | View all platform bookings; filter by status; SLA breach highlighted in orange |
| **Commission** | Edit platform commission % and customer cashback %; revenue simulation |
| **Wallet** | Total platform wallet liability; per-user balances |

Real-time **SLA breach alerts** appear as dismissable banners via Socket.IO whenever a worker arrives after the 1-hour deadline.

---

## API Reference

### Auth — `/api/auth`

| Method | Path | Description |
|---|---|---|
| `POST` | `/send-otp` | Generate & send OTP via Fast2SMS |
| `POST` | `/verify-otp` | Verify OTP (hashed; 5-attempt limit; 5-min expiry) |
| `POST` | `/register` | Register customer or handyman (with KYC + sub-services for handyman) |
| `POST` | `/login` | Password login → JWT |
| `POST` | `/forgot-password` | OTP-gated password reset |
| `GET` | `/me` | Current authenticated user profile |

### Bookings — `/api/bookings`

| Method | Path | Description |
|---|---|---|
| `POST` | `/` | Create booking (customer; Tamil Nadu validation) |
| `GET` | `/my` | My bookings (customer or worker) |
| `GET` | `/:id` | Single booking detail |
| `PATCH` | `/:id/status` | Update booking status (worker/admin); SLA enforced |
| `POST` | `/:id/pay` | Initiate Razorpay payment |
| `POST` | `/:id/rate` | Rate the worker (post-completion) |

### Workers — `/api/workers`

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | List verified, available workers (with GPS distance filter) |
| `GET` | `/:id` | Worker profile |
| `PATCH` | `/availability` | Toggle worker online/available status |
| `GET` | `/earnings` | Worker earnings summary |

### Admin — `/api/admin` *(requires admin JWT)*

| Method | Path | Description |
|---|---|---|
| `GET` | `/pending-captains` | Worker KYC verification queue |
| `PATCH` | `/verify-captain/:id` | Approve or reject a worker |
| `GET` | `/analytics` | Platform-wide stats |
| `GET` | `/customers` | All customer accounts |
| `PATCH` | `/customers/:id/toggle-block` | Block / unblock a customer |
| `GET` | `/bookings` | All platform bookings (filterable by status, slaBreached) |
| `GET` | `/wallet-overview` | Total wallet liability + top wallet holders |

### Commission — `/api/commission`

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Current commission config |
| `PUT` | `/` | Update commission % and cashback % *(admin only)* |

### Wallet — `/api/wallet`

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | My wallet balance + transaction history |
| `POST` | `/withdraw` | Request wallet withdrawal |

---

## Service Categories & Sub-Services

| Category | Trade Value | Sub-Services (8 each) |
|---|---|---|
| 🔧 Plumbing | `Plumbing` | Pipe Leak Repair, Tap/Faucet Installation & Repair, Toilet Repair, Sink & Basin Installation, Drain Blockage Removal, Water Tank Connection, Bathroom Fittings, Emergency Plumbing |
| 💡 Electrical Repairs | `Electrical Repairs` | Switch & Socket Repair, Fan Installation & Repair, Light Installation, Wiring & Rewiring, MCB/Fuse Repair, Inverter Installation, Door Bell Installation, Emergency Electrical Service |
| ❄️ AC Service | `AC Service and Repair` | AC General Service, AC Gas Refilling, AC Installation, AC Uninstallation, AC Water Leakage Repair, Cooling Issue Repair, Compressor Repair, Annual Maintenance |
| 🧊 Refrigerator Repair | `Refrigerator Repair` | Cooling Issue Repair, Gas Charging, Compressor Repair, Thermostat Replacement, Door Seal Replacement, Water Leakage Repair, Noise Issue Repair, General Service |
| 🧺 Washing Machine | `Washing Machine Repair` | General Service, Drum Repair, Water Inlet/Outlet Repair, Motor Repair, PCB Repair, Spin Issue Repair, Installation, Uninstallation |
| 💧 Water Purifier | `Water Purifier Service` | Filter Replacement, RO Membrane Replacement, UV Lamp Replacement, Water Leakage Repair, Water Quality Check, General Cleaning, Installation, AMC (Annual Maintenance) |

---

## Business Rules

| Rule | Detail |
|---|---|
| **Geographic restriction** | All customer addresses and handyman locations must be within Tamil Nadu (8 taluks). Bookings outside the district boundary are rejected. |
| **Proximity limit** | Maximum 5 km between customer and worker for a valid booking. |
| **KYC mandatory** | Handymen must provide a valid 12-digit Aadhaar number and one secondary ID proof (Driving License / Voter ID / PAN Card) at registration. |
| **OTP security** | Max 5 verification attempts per OTP. OTPs expire in 5 minutes. No master/bypass OTP is permitted. |
| **Admin phone gate** | Only phone `+917604975206` can register or log in as admin. All other admin attempts are rejected server-side. |
| **SLA (Service Level Agreement)** | Worker must arrive at the customer's location within **1 hour** of booking confirmation. If the worker's `Arrived` status is set after the deadline, `slaBreached = true` and the admin receives a real-time Socket.IO alert. |
| **Phone number privacy** | Worker's phone number is hidden until the booking reaches `Confirmed` status. |
| **Same-trade restriction** | Handyman users cannot see or book other workers in their own trade category. |
| **Commission** | Default platform commission: **10%** of booking price. Configurable by admin. Worker payout = price − commission. |

---

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join-user` | `userId` | Subscribe to personal notifications |
| `join-booking` | `bookingId` | Join a booking's live tracking room |
| `leave-booking` | `bookingId` | Leave tracking room |
| `join-admin-room` | *(none)* | Subscribe to platform-wide admin alerts |
| `worker-location` | `{ workerId, bookingId, latitude, longitude, heading, speed }` | Stream worker GPS position |
| `worker-status-changed` | `{ workerId, isOnline }` | Toggle worker online status |
| `call-initiate` | `{ callerId, receiverId, bookingId, ... }` | Start in-app WebRTC voice call |

### Server → Client

| Event | Description |
|---|---|
| `booking-created` | New booking placed |
| `booking-updated` | Any booking field updated |
| `booking-status-changed` | Status transition (e.g., Confirmed → EnRoute) |
| `worker-location-updated` | Worker GPS position update (scoped to booking room) |
| `sla-breached` | SLA deadline passed for a specific booking |
| `sla-breach-alert` | Admin-room broadcast with full breach context |
| `incoming-call` | Incoming WebRTC call notification |
| `new-booking-request` | Dispatched to a specific worker |

---

## Running Both Services Locally

```bash
# Terminal 1 — Backend
cd smartfix/backend
npm run dev

# Terminal 2 — Frontend
cd smartfix/frontend
npm run dev
```

Frontend proxies `/api/*` to `http://localhost:5000` via Vite config.
Socket.IO connects to the same backend origin automatically.
