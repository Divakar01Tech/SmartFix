const request = require('supertest');
const app = require('../server'); 

describe('PII Leak Prevention Test (Part 2)', () => {
  it('must strictly enforce allowlist and never expose worker phone or email in customer API responses', async () => {
    const customerToken = process.env.TEST_CUSTOMER_TOKEN;
    const bookingId = process.env.TEST_BOOKING_ID;
    
    // If not configured in test env, skip gracefully so it doesn't break CI without setup
    if (!customerToken || !bookingId) {
      console.warn('Skipping PII leak test: TEST_CUSTOMER_TOKEN or TEST_BOOKING_ID missing');
      return;
    }

    const res = await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(res.status).toBe(200);

    const worker = res.body.booking.worker;
    expect(worker).toBeDefined();
    
    // Explicitly assert restricted fields are completely undefined
    expect(worker.phone).toBeUndefined();
    expect(worker.email).toBeUndefined();
    expect(worker.password).toBeUndefined();

    // Assert Allowlist Compliance
    const allowedKeys = ['_id', 'name', 'trade', 'rating', 'ratingCount', 'bio', 'profilePic'];
    const actualKeys = Object.keys(worker);
    
    actualKeys.forEach(key => {
      expect(allowedKeys).toContain(key);
    });

    // Assert full payload string representation has no regex matches for real emails
    const responseBodyString = JSON.stringify(res.body);
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    expect(emailRegex.test(responseBodyString)).toBe(false);
  });
});
