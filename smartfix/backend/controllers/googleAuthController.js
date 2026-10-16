const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key_2026';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '979711564592-72s6n7srov6140ljd0706c95vlgn7916.apps.googleusercontent.com';
const googleOAuthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      userId: user._id,
      role: user.role,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const generateSignupToken = (email, role) => {
  return jwt.sign(
    {
      email: email.toLowerCase().trim(),
      role,
      purpose: role === 'worker' ? 'worker-signup' : 'google-complete-profile',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

/**
 * POST /api/auth/google
 * Body: { credential (Google ID token), role: "customer" | "worker" }
 */
exports.googleAuth = async (req, res) => {
  try {
    const { credential, idToken, role: reqRole } = req.body;
    const token = credential || idToken;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Google credential token is required.' });
    }

    const role = (reqRole || 'customer').toLowerCase();

    // Security Gate: Admin MUST NOT use Google Sign-in
    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrator accounts cannot authenticate using Google. Use the designated admin login portal.',
      });
    }

    const targetRole = role === 'worker' || role === 'handyman' ? 'worker' : 'customer';

    // 1. Verify Google ID token using google-auth-library
    let ticket;
    try {
      ticket = await googleOAuthClient.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (verifyErr) {
      console.error('Google token verification error:', verifyErr.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Google credential. Please try signing in with Google again.',
      });
    }

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ success: false, message: 'Failed to retrieve Google identity token payload.' });
    }

    // Issuer check
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      return res.status(401).json({ success: false, message: 'Invalid token issuer.' });
    }

    // Expiry check
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return res.status(401).json({ success: false, message: 'Google authentication token has expired.' });
    }

    // REQUIRE payload.email_verified === true
    if (payload.email_verified !== true) {
      return res.status(400).json({
        success: false,
        message: 'Your Google email is not verified. Please verify your email with Google first.',
      });
    }

    // Never trust client body for identity; take strictly from verified token payload
    const googleId = payload.sub;
    const verifiedEmail = payload.email.toLowerCase().trim();
    const googleName = payload.name || payload.given_name || verifiedEmail.split('@')[0];
    const picture = payload.picture || '';

    // Check if user exists by email or googleId
    let user = await User.findOne({
      $or: [{ email: verifiedEmail }, { googleId }, { googleUid: googleId }],
    }).select('+password');

    if (user) {
      // Role enforcement check: A user with role X cannot log in through the other portal's role selector
      const userRole = (user.role === 'handyman' || user.role === 'worker') ? 'worker' : user.role;
      if (userRole !== targetRole) {
        const portalName = targetRole === 'worker' ? 'Service Provider' : 'Customer';
        const actualName = userRole === 'worker' ? 'Service Provider' : (userRole === 'admin' ? 'Administrator' : 'Customer');
        return res.status(403).json({
          success: false,
          roleMismatch: true,
          message: `This Google account is registered as a ${actualName}, but you are trying to sign in to the ${portalName} portal. Please switch tabs.`,
        });
      }

      if (user.isBlocked || user.isSuspended || user.verificationStatus === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended by Administration. Please contact customer support.',
        });
      }

      // Link Google ID and update authProviders if not already linked
      let modified = false;
      if (!user.googleId) {
        user.googleId = googleId;
        user.googleUid = googleId;
        modified = true;
      }
      if (!user.authProviders) {
        user.authProviders = ['google'];
        modified = true;
      } else if (!user.authProviders.includes('google')) {
        user.authProviders.push('google');
        modified = true;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
        modified = true;
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        modified = true;
      }
      if (modified) {
        await user.save();
      }

      const authToken = generateToken(user);
      const isProfileDone = user.profileCompleted || (!!user.phone && !user.phone.startsWith('google_') && !!user.address);

      return res.status(200).json({
        success: true,
        token: authToken,
        user: targetRole === 'worker' ? user.toSafeWorker() : user.toSafeUser(),
        worker: targetRole === 'worker' ? user.toSafeWorker() : undefined,
        needsProfileCompletion: targetRole === 'customer' && !isProfileDone,
        message: 'Signed in with Google successfully.',
      });
    }

    // 2. New User Creation via Google
    if (targetRole === 'customer') {
      const newUser = await User.create({
        name: googleName,
        fullName: googleName,
        email: verifiedEmail,
        isEmailVerified: true,
        profileCompleted: false,
        authProviders: ['google'],
        googleId,
        googleUid: googleId,
        avatar: picture,
        role: 'customer',
        verificationStatus: 'Verified',
        isOnline: true,
        isAvailable: true,
        phone: '', // Will be completed in profile form
      });

      const authToken = generateToken(newUser);
      const signupToken = generateSignupToken(verifiedEmail, 'customer');

      return res.status(201).json({
        success: true,
        isNewUser: true,
        needsProfileCompletion: true,
        token: authToken,
        signupToken,
        user: newUser.toSafeUser(),
        message: 'Google account verified. Please complete your customer profile.',
      });
    }

    // New Worker via Google: Stays pending_verification and continues KYC / AI interview
    const newWorker = await User.create({
      name: googleName,
      fullName: googleName,
      email: verifiedEmail,
      isEmailVerified: true,
      profileCompleted: false,
      authProviders: ['google'],
      googleId,
      googleUid: googleId,
      avatar: picture,
      role: 'worker',
      verificationStatus: 'pending_verification',
      overallStatus: 'pending',
      availability: 'offline',
      isAvailable: false,
      isOnline: false,
      phone: '',
    });

    const authToken = generateToken(newWorker);
    const signupToken = generateSignupToken(verifiedEmail, 'worker');

    return res.status(201).json({
      success: true,
      isNewUser: true,
      needsProfileCompletion: true,
      token: authToken,
      signupToken,
      worker: newWorker.toSafeWorker(),
      user: newWorker.toSafeWorker(),
      message: 'Google account linked. Please proceed with professional verification and KYC.',
    });
  } catch (err) {
    console.error('googleAuth Error:', err);
    return res.status(500).json({ success: false, message: 'Google sign-in server error: ' + err.message });
  }
};

/**
 * POST /api/auth/complete-profile
 * Completes the profile for newly registered Google customers
 * Body: { phone, address, district, state, password (optional) }
 */
exports.completeGoogleProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { phone, address, district, state, password } = req.body;

    if (!phone || !address || !district || !state) {
      return res.status(400).json({
        success: false,
        message: 'Phone number, address, district, and state are required to complete your profile.',
      });
    }

    // Validate phone: +91 format /^[6-9]\d{9}$/
    const rawPhone = phone.toString().replace(/\D/g, '');
    const cleanPhone = (rawPhone.length === 12 && rawPhone.startsWith('91')) ? rawPhone.slice(2) : rawPhone;
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number starting with 6-9.',
      });
    }
    const formattedPhone = `+91${cleanPhone}`;

    if (address.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a complete address with street/locality details.',
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    user.phone = formattedPhone;
    user.address = address.trim();
    user.district = district.trim();
    user.state = state.trim();
    user.profileCompleted = true;

    // Optional password set
    if (password && password.trim().length >= 8) {
      if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must contain at least 1 letter and 1 number.',
        });
      }
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash(password, salt);
      if (!user.authProviders.includes('password')) {
        user.authProviders.push('password');
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile completed successfully.',
      user: user.toSafeUser(),
    });
  } catch (err) {
    console.error('completeGoogleProfile Error:', err);
    return res.status(500).json({ success: false, message: 'Server error while saving profile.' });
  }
};
