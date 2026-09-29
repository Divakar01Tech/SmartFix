# SMARTFIX — APPLICATION FLOW DOCUMENT

**Project Name**: SmartFix / HandyBook Platform  
**Document Version**: 1.0.0  

---

## 1. Overall Application Flow

```
                      VISITOR / USER
                            │
                  Authentication & Role
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
CUSTOMER PORTAL      HANDYMAN PORTAL        ADMIN CONSOLE
       │                    │                    │
 Service Discovery     Availability Toggle     KYC Verification
 Address & Date Picker  30s Dispatch Popup    Customer Management
 Payment & Tracking    Active Job Progress    Platform Analytics
```

---

## 2. Customer Journey Flow

```
[Open Site] ──► [Select Service & Tier] ──► [Choose Address & Landmark]
                                                    │
                                                    ▼
[Payment / COD] ◄── [Accept Dispatch]   ◄── [Radial Search (5 km)]
       │
       ▼
[Track Live GPS] ──► [Job Completed]   ──► [Submit Star Rating & Review]
```

---

## 3. Handyman / Provider Journey Flow

```
[Login & Online Toggle] ──► [Receive 30s Dispatch Alert] ──► [Click Accept Job]
                                                                  │
                                                                  ▼
[Earnings In Wallet]    ◄── [Mark Job Completed]       ◄── [Update Progress]
        │                                             (EnRoute ─► Arrived ─► InProgress)
        ▼
[Request UPI Withdrawal]
```

---

## 4. Admin Journey Flow

```
[Admin Authenticate] ──► [Dashboard Analytics] ──► [Review Pending Worker KYC Queue]
                                                             │
                                                             ▼
                                                    [Inspect Aadhaar & Proof]
                                                             │
                                                     ┌───────┴───────┐
                                                     ▼               ▼
                                               [Approve ✅]    [Reject ❌]
```

---

## 5. Secure MongoDB OTP Flow

```
[Customer Request OTP] ──► [Verify 60s Resend Cooldown] ──► [Generate Random 6-digit OTP]
                                                                    │
                                                                    ▼
[Token / Login]        ◄── [Mark OTP Consumed]       ◄── [Bcrypt Hash & Save MongoDB]
                                                                    │
                                                                    ▼
                                                         [Dispatch via Fast2SMS]
```

---

## 6. Payment & Verification Flow

```
[Customer Pay Now] ──► [Backend Create Razorpay Order] ──► [Razorpay Payment Gateway]
                                                                   │
                                                                   ▼
[Wallet Split]      ◄── [HMAC Signature Verified]      ◄── [Submit Payment Response]
```
