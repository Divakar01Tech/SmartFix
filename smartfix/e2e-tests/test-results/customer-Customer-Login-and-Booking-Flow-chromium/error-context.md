# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: customer.spec.js >> Customer Login and Booking Flow
- Location: tests\customer.spec.js:3:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /.*\/dashboard/
Received string:  "http://localhost:5173/login"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    23 × locator resolved to <html lang="en" data-theme="light">…</html>
       - unexpected value "http://localhost:5173/login"

```

```yaml
- banner:
  - link "SmartFix":
    - /url: /
    - text: Smart
    - strong: Fix
  - textbox "Search plumbers, electricians, AC repair..."
  - button "Search"
  - group "Language Toggle":
    - button "EN"
    - button "தமிழ்"
  - button "Toggle Theme"
  - link "Browse Experts":
    - /url: /browse
  - link "Login / Register":
    - /url: /login
- main:
  - heading "Welcome to SmartFix" [level=1]
  - paragraph: Instant Real-Time Mobile OTP Login & Registration
  - button "Mobile OTP Login"
  - button "Password Login"
  - button "👤 Customer Account"
  - button "🛠️ Handyman Pro"
  - button "Google Continue with Google":
    - img "Google"
    - text: Continue with Google
  - text: Enter 6-Digit OTP Code
  - textbox "OTP Digit 1 of 6": "1"
  - textbox "OTP Digit 2 of 6": "2"
  - textbox "OTP Digit 3 of 6": "3"
  - textbox "OTP Digit 4 of 6": "4"
  - textbox "OTP Digit 5 of 6": "5"
  - textbox "OTP Digit 6 of 6": "6"
  - text: Resend OTP in
  - strong: 50s
  - button "Edit Phone Number"
  - text: OTP verification failed. Please try again.
  - button "Verify OTP & Log In 🚀"
  - paragraph:
    - text: Don't have an account?
    - button "Sign up now"
- button "SmartFix AI AI LIVE"
- contentinfo:
  - heading "Subscribe for Exclusive Repairs & Offers" [level=3]
  - paragraph: Get instant updates and service offers in Tamil Nadu.
  - textbox "Enter your email address..."
  - button "Subscribe"
  - link "SmartFix":
    - /url: /
    - text: Smart
    - strong: Fix
  - paragraph: "Tamil Nadu's #1 Trusted On-Demand Home Service Network."
  - text: Tamil Nadu, Karaikudi & All Tamil Nadu Towns, Tamil Nadu +91 (800) 555-FIXIT / 1800-425-7627 support@smartfix.com
  - heading "Quick Links" [level=4]
  - list:
    - listitem:
      - link "Home":
        - /url: /
    - listitem:
      - link "About":
        - /url: /about
    - listitem:
      - link "Careers":
        - /url: /careers
    - listitem:
      - link "Contact Us":
        - /url: /contact
  - heading "Our Professional Home Services" [level=4]
  - list:
    - listitem:
      - link "Plumbing":
        - /url: /browse?category=Plumbing
    - listitem:
      - link "Electrical Repairs":
        - /url: /browse?category=Electrical
    - listitem:
      - link "AC Service & Repair":
        - /url: /browse?category=AC Service
    - listitem:
      - link "Washing Machine Repair":
        - /url: /browse?category=Washing Machine
    - listitem:
      - link "Water Purifier Service":
        - /url: /browse?category=Water Purifier
  - heading "For Skilled Technicians & Handymen" [level=4]
  - list:
    - listitem:
      - link "Register as Worker Partner 🛠️":
        - /url: /login?tab=register
    - listitem:
      - link "Login / Register":
        - /url: /login
  - heading "Contact Us & privacy" [level=4]
  - list:
    - listitem:
      - link "help":
        - /url: /help
    - listitem:
      - link "terms":
        - /url: /terms
    - listitem:
      - link "privacy":
        - /url: /privacy
  - paragraph: © 2026 SmartFix Technologies Inc. All rights reserved.
  - paragraph: Crafted with for Tamil Nadu.
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | test('Customer Login and Booking Flow', async ({ page }) => {
  4  |   // 1. Navigate to home and click login
  5  |   await page.goto('http://localhost:5173/');
  6  |   await page.click('text=Login / Register');
  7  | 
  8  |   // 2. We should be on /login
  9  |   await expect(page).toHaveURL(/.*\/login/);
  10 | 
  11 |   // 3. Make sure OTP method is selected and Customer role is selected
  12 |   await page.click('button:has-text("Mobile OTP Login")');
  13 |   await page.click('button:has-text("Customer Account")');
  14 | 
  15 |   // 4. Enter phone number
  16 |   await page.fill('input[name="phone"]', '9999999992');
  17 | 
  18 |   // 5. Submit phone number
  19 |   await page.click('button:has-text("Send 6-Digit")');
  20 | 
  21 |   // 6. Wait for OTP step
  22 |   await page.waitForSelector('text="Enter 6-Digit OTP Code"', { timeout: 10000 });
  23 |   
  24 |   // Fill OTP
  25 |   // The OTP component has 6 inputs with id otp-digit-1 to 6
  26 |   for(let i=1; i<=6; i++) {
  27 |      await page.fill(`#otp-digit-${i}`, '123456'[i-1]);
  28 |   }
  29 | 
  30 |   // 7. Take screenshot to see current state
  31 |   await page.screenshot({ path: 'test-results/debug-state.png', fullPage: true });
  32 | 
  33 |   // 8. Click Verify OTP
  34 |   await page.click('button:has-text("Verify")');
  35 | 
  36 |   // 9. Expect to be redirected to dashboard
> 37 |   await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  38 | 
  39 |   console.log("Customer logged in successfully!");
  40 | });
  41 | 
```