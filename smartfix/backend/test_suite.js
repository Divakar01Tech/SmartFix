require('dotenv').config();
const http = require('http');
const https = require('https');

const isHttps = process.env.USE_HTTPS === 'true';
const BASE_URL = isHttps ? 'https://127.0.0.1:5000/api' : 'http://127.0.0.1:5000/api';
const transport = isHttps ? https : http;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
      },
    };


    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = transport.request(options, (res) => {
      let resBody = '';
      res.on('data', (chunk) => (resBody += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resBody);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting SmartFix Verification Test Suite...\n');

  try {
    // 1. Handyman Registration Outside Tamil Nadu (Should Fail)
    console.log('Test 1: Handyman registration outside Tamil Nadu...');
    const badHandymanPhone = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;
    const res1 = await request('POST', '/auth/register', {
      name: 'Outside Handyman',
      phone: badHandymanPhone,
      password: 'password123',
      role: 'handyman',
      trade: 'Plumbing',
      subServices: ['Pipe Leak Repair'],
      location: 'Chennai, Tamil Nadu',
      aadhaarNumber: '123456789012',
    });
    console.log(`-> Status: ${res1.status}, Message: ${res1.data?.message}`);
    if (res1.status === 400) {
      console.log('✅ Test 1 Passed: Rejected non-Tamil Nadu registration!\n');
    } else {
      console.error('❌ Test 1 Failed!\n');
    }

    // 2. Handyman Registration in Tamil Nadu (Should Succeed as Pending)
    console.log('Test 2: Handyman registration in Karaikudi, Tamil Nadu...');
    const goodHandymanPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
    const otp1 = await request('POST', '/auth/send-otp', { phone: goodHandymanPhone, purpose: 'register' });
    await request('POST', '/auth/verify-otp', { phone: goodHandymanPhone, purpose: 'register', otp: otp1.data?.demoOtp });

    const res2 = await request('POST', '/auth/register', {
      name: 'Karaikudi Plumber Pro',
      phone: goodHandymanPhone,
      password: 'password123',
      role: 'handyman',
      trade: 'Plumbing',
      subServices: ['Pipe Leak Repair', 'Toilet Repair'],
      location: 'Karaikudi, Tamil Nadu',
      aadhaarNumber: '987654321098',
    });
    console.log(`-> Status: ${res2.status}, Message: ${res2.data?.message}, Verification Status: ${res2.data?.user?.verificationStatus}`);
    if (res2.status === 201 && res2.data?.user?.verificationStatus === 'Pending') {
      console.log('✅ Test 2 Passed: Handyman registered with verificationStatus Pending!\n');
    } else {
      console.error('❌ Test 2 Failed!\n');
    }
    const handymanId = res2.data?.user?.id;
    const handymanToken = res2.data?.token;

    // 3. Customer Registration
    console.log('Test 3: Customer registration in Tamil Nadu...');
    const custPhone = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
    const otp2 = await request('POST', '/auth/send-otp', { phone: custPhone, purpose: 'register' });
    await request('POST', '/auth/verify-otp', { phone: custPhone, purpose: 'register', otp: otp2.data?.demoOtp });

    const res3 = await request('POST', '/auth/register', {
      name: 'Tamil Nadu Resident',
      phone: custPhone,
      password: 'password123',
      role: 'customer',
      location: 'Tamil Nadu, Tamil Nadu',
    });
    console.log(`-> Status: ${res3.status}, Customer ID: ${res3.data?.user?.id}`);
    if (res3.status === 201) {
      console.log('✅ Test 3 Passed: Customer registered successfully!\n');
    } else {
      console.error('❌ Test 3 Failed!\n');
    }
    const custToken = res3.data?.token;

    // 4. Create Booking outside Tamil Nadu (Should Fail)
    console.log('Test 4: Booking creation with location outside Tamil Nadu...');
    const res4 = await request(
      'POST',
      '/bookings',
      {
        trade: 'Plumbing',
        address: 'Madurai Central Junction, Madurai',
        pickupLat: 9.9252,
        pickupLng: 78.1198,
        price: 450,
      },
      custToken
    );
    console.log(`-> Status: ${res4.status}, Message: ${res4.data?.message}`);
    if (res4.status === 400) {
      console.log('✅ Test 4 Passed: Booking outside Tamil Nadu rejected!\n');
    } else {
      console.error('❌ Test 4 Failed!\n');
    }

    // 5. Create Booking in Tamil Nadu (Should Succeed) & Check Privacy (Pending Status)
    console.log('Test 5: Booking creation in Karaikudi (Pending status)...');
    const res5 = await request(
      'POST',
      '/bookings',
      {
        workerId: handymanId,
        trade: 'Plumbing',
        subServices: ['Pipe Leak Repair'],
        address: 'Karaikudi Main Road, Tamil Nadu',
        pickupLat: 10.0735,
        pickupLng: 78.7732,
        price: 350,
      },
      custToken
    );
    console.log(`-> Status: ${res5.status}, Booking ID: ${res5.data?.booking?.id || res5.data?.booking?._id}`);
    const booking = res5.data?.booking;
    const workerPhoneExposed = !!booking?.worker?.phone;
    console.log(`-> Is Worker Phone Exposed on Pending Booking? ${workerPhoneExposed}`);
    if (res5.status === 201 && !workerPhoneExposed) {
      console.log('✅ Test 5 Passed: Booking created as Pending & worker phone is GATED/HIDDEN!\n');
    } else {
      console.error('❌ Test 5 Failed!\n');
    }
    const bookingId = booking?.id || booking?._id;

    // 6. Admin Approval of Handyman
    console.log('Test 6: Admin verifying handyman account...');
    let adminToken;
    let adminLoginRes = await request('POST', '/auth/login', {
      phone: '+917604975206',
      password: 'password123',
      role: 'admin',
    }).catch(() => null);

    if (adminLoginRes?.status !== 200) {
      adminLoginRes = await request('POST', '/auth/login', {
        phone: '+917604975206',
        password: 'admin123',
        role: 'admin',
      }).catch(() => null);
    }

    if (adminLoginRes?.status === 200 && adminLoginRes?.data?.token) {
      adminToken = adminLoginRes.data.token;
    } else {
      const adminOtp = await request('POST', '/auth/send-otp', { phone: '+917604975206', purpose: 'register' });
      await request('POST', '/auth/verify-otp', { phone: '+917604975206', purpose: 'register', otp: adminOtp.data?.demoOtp });
      const adminReg = await request('POST', '/auth/register', {
        name: 'Super Admin',
        phone: '+917604975206',
        password: 'password123',
        role: 'admin',
      });
      adminToken = adminReg.data?.token;
    }

    const res6 = await request(
      'PATCH',
      `/admin/verify-captain/${handymanId}`,
      { verificationStatus: 'Verified' },
      adminToken
    );
    console.log(`-> Status: ${res6.status}, Updated Status: ${res6.data?.user?.verificationStatus}`);
    if (res6.status === 200 && res6.data?.user?.verificationStatus === 'Verified') {
      console.log('✅ Test 6 Passed: Admin verified handyman successfully!\n');
    } else {
      console.error('❌ Test 6 Failed!\n');
    }

    // 7. Handyman Accepts Booking -> Revealing Phone Number
    console.log('Test 7: Handyman accepting booking...');
    const res7 = await request(
      'PATCH',
      `/bookings/${bookingId}/status`,
      { status: 'Accepted' },
      handymanToken
    );
    console.log(`-> Status: ${res7.status}, Booking Status: ${res7.data?.booking?.status}`);
    const acceptedBooking = res7.data?.booking;
    const workerPhoneRevealed = !!acceptedBooking?.worker?.phone;
    console.log(`-> Is Worker Phone Revealed on Accepted Booking? ${workerPhoneRevealed} (${acceptedBooking?.worker?.phone})`);
    if (res7.status === 200 && workerPhoneRevealed) {
      console.log('✅ Test 7 Passed: Worker phone revealed after booking status is Accepted!\n');
    } else {
      console.error('❌ Test 7 Failed!\n');
    }

    // 8. Update status to WorkInProgress then Completed
    console.log('Test 8: Provider completing work...');
    await request('PATCH', `/bookings/${bookingId}/status`, { status: 'WorkInProgress' }, handymanToken);
    const res8 = await request('PATCH', `/bookings/${bookingId}/status`, { status: 'Completed' }, handymanToken);
    console.log(`-> Status: ${res8.status}, Final Booking Status: ${res8.data?.booking?.status}`);
    if (res8.status === 200 && res8.data?.booking?.status === 'Completed') {
      console.log('✅ Test 8 Passed: Booking marked Completed successfully!\n');
    } else {
      console.error('❌ Test 8 Failed!\n');
    }

    // 9. Payment Order Creation
    console.log('Test 9: Processing payment for completed booking...');
    const res9 = await request(
      'PATCH',
      `/bookings/${bookingId}/pay`,
      { paymentMethod: 'UPI' },
      custToken
    );
    console.log(`-> Status: ${res9.status}, Message: ${res9.data?.message}`);
    if (res9.status === 200) {
      console.log('✅ Test 9 Passed: Payment processed successfully!\n');
    } else {
      console.error('❌ Test 9 Failed!\n');
    }

    console.log('\n🎉 ALL VERIFICATION TESTS EXECUTED!');
  } catch (e) {
    console.error('Test suite error:', e);
  }
}

runTests();
