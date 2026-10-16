const Razorpay = require('razorpay');
const crypto = require('crypto');

/**
 * Initializes and returns a Razorpay SDK instance using environment variables.
 * Never hardcodes or logs keys.
 */
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) not configured');
  }

  return new Razorpay({
    key_id,
    key_secret,
  });
};

/**
 * Verifies HMAC-SHA256 signature of `${order_id}|${payment_id}` using crypto.timingSafeEqual.
 *
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} signature
 * @returns {boolean}
 */
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keySecret) {
    return false;
  }

  const payload = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const sigBuf = Buffer.from(signature, 'utf8');

  if (expectedBuf.length !== sigBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, sigBuf);
};

/**
 * Verifies Razorpay Webhook signature using x-razorpay-signature and RAZORPAY_WEBHOOK_SECRET.
 * Uses crypto.timingSafeEqual for timing attack protection.
 *
 * @param {string|Buffer} rawBody
 * @param {string} signature
 * @returns {boolean}
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!rawBody || !signature) {
    return false;
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
  if (!webhookSecret) {
    return false;
  }

  const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(bodyString)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const sigBuf = Buffer.from(signature, 'utf8');

  if (expectedBuf.length !== sigBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, sigBuf);
};

module.exports = {
  getRazorpayInstance,
  verifyRazorpaySignature,
  verifyWebhookSignature,
};
