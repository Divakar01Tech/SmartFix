const jwt = require('jsonwebtoken');
const { verifyIdToken } = require('../config/firebaseAdmin');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '979711564592-72s6n7srov6140ljd0706c95vlgn7916.apps.googleusercontent.com';

const generateToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });

/**
 * POST /api/auth/google
 * Body: { idToken: <Firebase ID token from Google Sign-In> }
 *
 * Flow:
 *  1. Verify Firebase idToken with Admin SDK (lazy — dotenv already loaded)
 *  2. Find or create a User document (role = 'customer')
 *  3. Return SmartFix JWT + user object
 */
exports.googleAuth = async (req, res) => {
  try {
    const { idToken, role: reqRole } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'Firebase ID token is required.' });
    }
    const role = reqRole || 'customer';

    // 1. Verify token with Firebase Admin
    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch (err) {
      console.error('❌ Firebase token verification failed:', err.message);
      return res.status(401).json({ message: 'Invalid or expired Google ID token. Please sign in again.' });
    }

    const { uid, email, name: googleName, picture } = decoded;

    if (!email) {
      return res.status(400).json({ message: 'Google account must have a verified email address.' });
    }

    // 2. Find or create user by googleUid (preferred) or email fallback
    let user = await User.findOne({ googleUid: uid });

    if (!user) {
      // Check if an account already exists with same email but registered via phone
      const emailUser = await User.findOne({ email: email.toLowerCase() });
      if (emailUser) {
        // Link Google UID to existing account
        emailUser.googleUid = uid;
        if (!emailUser.avatar && picture) emailUser.avatar = picture;
        await emailUser.save();
        user = emailUser;
      } else {
        // Create brand-new account
        user = await User.create({
          name: googleName || email.split('@')[0],
          email: email.toLowerCase(),
          googleUid: uid,
          avatar: picture || '',
          role: role,
          phone: `google_${uid}`,                         // unique placeholder
          password: `google_oauth_${uid}_${Date.now()}`,  // never used to login
          verificationStatus: role === 'handyman' ? 'Pending' : 'Verified',
          phoneVerified: true,
          isOnline: role === 'customer',
          isAvailable: role === 'customer',
        });
      }
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: '🚫 Your account has been suspended by Admin. Please contact support.' });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone?.startsWith('google_') ? '' : user.phone,
        role: user.role,
        verificationStatus: user.verificationStatus,
        preferredLanguage: user.preferredLanguage || 'en',
        theme: user.theme || 'light',
        isGoogleUser: true,
      },
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).json({ message: err.message || 'Google sign-in failed.' });
  }
};
