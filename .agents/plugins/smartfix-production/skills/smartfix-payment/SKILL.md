---
name: smartfix-payment
description: SmartFix Razorpay payment gateway integration skill for order creation, webhooks, and backend HMAC signature verification.
---

# SmartFix Payment Gateway Skill

## Razorpay Integration Architecture

### Step 1: Server Order Creation
- Customer initiates checkout for booking.
- Backend calls Razorpay API `razorpay.orders.create({ amount: booking.price * 100, currency: 'INR', receipt: booking._id })`.
- Backend returns `order_id` to customer app.

### Step 2: Client Payment Modal
- Customer app initializes Razorpay Checkout JS modal with `order_id` and public `key_id`.

### Step 3: Server Signature Verification
- Upon payment completion, client sends `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to POST `/api/payments/verify`.
- Backend calculates HMAC SHA256 signature using `RAZORPAY_KEY_SECRET`:
  ```js
  const generatedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${order_id}|${payment_id}`)
    .digest('hex');
  ```
- If signatures match:
  - Mark payment record `status: 'Success'`.
  - Update booking `status: 'Paid'`.
  - Return HTTP 200 `{ success: true }`.
