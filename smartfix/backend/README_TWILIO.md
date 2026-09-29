# SmartFix — Twilio Verify Setup & Testing Guide

This guide explains how to configure and verify **Twilio Verify API v2** in SmartFix for mobile phone OTP verification across Customer and Worker (Handyman) portals.

---

## 1. Single Twilio Account Architecture

```text
       ┌─────────────────────────────┐
       │   TWILIO CONSOLE (1 ACCT)   │
       │   - Account SID (AC...)     │
       │   - Auth Token             │
       │   - Verify Service (VA...)  │
       └──────────────┬──────────────┘
                      │
                      ▼
       ┌─────────────────────────────┐
       │     SMARTFIX BACKEND        │
       │     (/api/otp & /api/auth)  │
       └──────────────┬──────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌──────────────┐            ┌──────────────┐
│  CUSTOMERS   │            │   WORKERS    │
└──────────────┘            └──────────────┘
```

---

## 2. Step-by-Step Setup in Twilio Console

1. Sign in to your account at [console.twilio.com](https://console.twilio.com).
2. Go to **Verify → Services** (or search "Verify" in the search bar).
3. Click **Create Service** and enter:
   - **Service Name:** `SmartFix-OTP`
   - **Code length:** `6 digits`
4. Copy the generated **Service SID** (starts with `VA...`).
5. Copy your **Account SID** (starts with `AC...`) and **Auth Token** from your main dashboard.

---

## 3. Configuring `.env`

In your `backend/.env` file:

```env
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_VERIFY_SERVICE_SID=VAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Set to true ONLY for local automated testing (bypasses real SMS)
OTP_MOCK_MODE=false
```

> [!NOTE]
> For **Twilio Trial Accounts**, you must add test phone numbers under **Phone Numbers → Verified Caller IDs** in Twilio Console before sending real SMS messages to them.

---

## 4. API Endpoints Reference

### 1. Send OTP
- **URL:** `POST /api/otp/send`
- **Body:** `{ "phone": "9876543210", "role": "customer", "purpose": "register" }`
- **Response:** `{ "success": true, "status": "pending", "message": "OTP sent to +919876543210 via Twilio SMS." }`

### 2. Verify OTP
- **URL:** `POST /api/otp/verify`
- **Body:** `{ "phone": "9876543210", "otp": "123456", "purpose": "register" }`
- **Response (Signup):** `{ "success": true, "approved": true, "phoneVerifyToken": "<signed-jwt>" }`

### 3. Register Account
- **URL:** `POST /api/auth/register`
- **Body:** `{ "name": "John Doe", "phone": "+919876543210", "password": "secretpassword", "role": "customer", "phoneVerifyToken": "<signed-jwt>" }`

---

## 5. Security & Isolation Rules

1. **Client Isolation:** Twilio Account SID, Auth Token, and Service SID are strictly server-side environment variables. No client-side network calls interact directly with Twilio.
2. **Registration Verification Gate:** The registration endpoint validates a short-lived, signed `phoneVerifyToken` issued upon successful OTP verification.
3. **Worker Account Workflow:** Worker registration via phone OTP marks the worker account as `status: 'Pending'` until document verification by Admin.
4. **Rate Limiting:** Rate limiters protect `/api/otp/send` against abuse (max 10 requests per 15-minute window per IP/phone).
