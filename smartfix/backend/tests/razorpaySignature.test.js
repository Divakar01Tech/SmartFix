const crypto = require('crypto');
const {
  verifyRazorpaySignature,
  verifyWebhookSignature,
} = require('../utils/razorpay');

describe('💳 Razorpay Payment Gateway & Cryptographic Signature Verification', () => {
  const TEST_SECRET = 'rzp_test_secret_for_smartfix_unit_test';
  const TEST_WEBHOOK_SECRET = 'whsec_test_webhook_secret_12345';

  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = TEST_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  });

  afterAll(() => {
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  describe('verifyRazorpaySignature', () => {
    test('should return true for valid HMAC-SHA256 signature', () => {
      const orderId = 'order_9A33XWu170gUtm';
      const paymentId = 'pay_29A3WD7srQ1';
      const payload = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(payload)
        .digest('hex');

      const result = verifyRazorpaySignature(orderId, paymentId, validSignature);
      expect(result).toBe(true);
    });

    test('should return false for tampered payment ID', () => {
      const orderId = 'order_9A33XWu170gUtm';
      const paymentId = 'pay_29A3WD7srQ1';
      const validSignature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const tamperedPaymentId = 'pay_TAMPERED999';
      const result = verifyRazorpaySignature(orderId, tamperedPaymentId, validSignature);
      expect(result).toBe(false);
    });

    test('should return false for tampered order ID', () => {
      const orderId = 'order_9A33XWu170gUtm';
      const paymentId = 'pay_29A3WD7srQ1';
      const validSignature = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const result = verifyRazorpaySignature('order_FAKE123', paymentId, validSignature);
      expect(result).toBe(false);
    });

    test('should return false for tampered signature hex', () => {
      const orderId = 'order_9A33XWu170gUtm';
      const paymentId = 'pay_29A3WD7srQ1';
      const invalidSignature = 'a'.repeat(64); // 64 hex characters but wrong

      const result = verifyRazorpaySignature(orderId, paymentId, invalidSignature);
      expect(result).toBe(false);
    });

    test('should safely return false when arguments are missing or malformed', () => {
      expect(verifyRazorpaySignature('', 'pay_123', 'sig_123')).toBe(false);
      expect(verifyRazorpaySignature('order_123', '', 'sig_123')).toBe(false);
      expect(verifyRazorpaySignature('order_123', 'pay_123', '')).toBe(false);
      expect(verifyRazorpaySignature(null, undefined, false)).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    test('should return true for valid raw buffer webhook signature', () => {
      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_captured_123',
              order_id: 'order_123',
              amount: 50000,
            },
          },
        },
      });

      const validSignature = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');

      const rawBuffer = Buffer.from(rawPayload, 'utf8');
      const result = verifyWebhookSignature(rawBuffer, validSignature);
      expect(result).toBe(true);
    });

    test('should return false if webhook payload was tampered in transit', () => {
      const originalPayload = JSON.stringify({ event: 'payment.captured', amount: 50000 });
      const validSignature = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(originalPayload)
        .digest('hex');

      const tamperedPayload = JSON.stringify({ event: 'payment.captured', amount: 100 });
      const result = verifyWebhookSignature(tamperedPayload, validSignature);
      expect(result).toBe(false);
    });

    test('should safely return false for missing signature or payload', () => {
      expect(verifyWebhookSignature('', 'sig_123')).toBe(false);
      expect(verifyWebhookSignature('payload', '')).toBe(false);
      expect(verifyWebhookSignature(null, null)).toBe(false);
    });
  });
});

