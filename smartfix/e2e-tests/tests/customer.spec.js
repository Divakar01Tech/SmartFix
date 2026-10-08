const { test, expect } = require('@playwright/test');

test('Customer Login and Booking Flow', async ({ page }) => {
  // 1. Navigate to home and click login
  await page.goto('http://localhost:5173/');
  await page.click('text=Login / Register');

  // 2. We should be on /login
  await expect(page).toHaveURL(/.*\/login/);

  // 3. Make sure OTP method is selected and Customer role is selected
  await page.click('button:has-text("Mobile OTP Login")');
  await page.click('button:has-text("Customer Account")');

  // 4. Enter phone number
  await page.fill('input[name="phone"]', '9999999992');

  // 5. Submit phone number
  await page.click('button:has-text("Send 6-Digit")');

  // 6. Wait for OTP step
  await page.waitForSelector('text="Enter 6-Digit OTP Code"', { timeout: 10000 });
  
  // Fill OTP
  // The OTP component has 6 inputs with id otp-digit-1 to 6
  for(let i=1; i<=6; i++) {
     await page.fill(`#otp-digit-${i}`, '123456'[i-1]);
  }

  // 7. Take screenshot to see current state
  await page.screenshot({ path: 'test-results/debug-state.png', fullPage: true });

  // 8. Click Verify OTP
  await page.click('button:has-text("Verify")');

  // 9. Expect to be redirected to dashboard
  await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });

  console.log("Customer logged in successfully!");
});
