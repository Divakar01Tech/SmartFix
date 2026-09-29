---
name: smartfix-auth-security
description: SmartFix authentication & authorization skill covering JWT, Twilio OTP verification, and Admin KYC approval workflows.
---

# SmartFix Auth & Security Skill

## Key Flows

### 1. User Registration & Login
- POST `/api/auth/register`: Hashes password, saves user with default role (`customer` or `worker`).
- POST `/api/auth/login`: Verifies password using `bcryptjs.compare()`, generates JWT containing `{ id, role }`.

### 2. Twilio OTP Phone Verification
- POST `/api/auth/send-otp`: Sends 6-digit SMS OTP via Twilio client.
- POST `/api/auth/verify-otp`: Validates code against stored session/user OTP timestamp.

### 3. Worker KYC Approval Workflow
- Worker registers -> status `isApproved: false`.
- Worker uploads ID proof / certificate.
- Admin reviews via `/api/admin/workers` -> calls `/api/admin/workers/:id/approve`.
- Backend updates `isApproved: true` -> worker becomes visible in matching queries.
