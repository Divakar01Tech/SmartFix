const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key';
const ADMIN_PHONE = '+917604975206';

const formatPhone = (phone) => {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  return phone;
};

exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id: userId }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
};

exports.requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const cleanUserPhone = formatPhone(user.phone);

    if (user.role?.toLowerCase() !== 'admin' || cleanUserPhone !== ADMIN_PHONE) {
      return res.status(403).json({ message: 'Access denied. Only the authorized administrator can access this panel.' });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Admin authentication check failed', error: err.message });
  }
};

exports.authorizeRoles = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: 'Not authorized' });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User account not found' });
      }

      if (user.isBlocked) {
        return res.status(403).json({ message: 'Account suspended by Admin' });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({ message: `Access denied. Role ${user.role} is not permitted.` });
      }

      req.currentUser = user;
      next();
    } catch (err) {
      res.status(500).json({ message: 'Role authorization failed', error: err.message });
    }
  };
};

/**
 * requireWorker Middleware:
 * Verifies valid JWT token and worker role ('worker' or 'handyman').
 * Checks account suspension.
 */
exports.requireWorker = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token payload.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Worker account not found.' });
    }

    if (user.role !== 'worker' && user.role !== 'handyman') {
      return res.status(403).json({ success: false, message: 'Access restricted to service providers.' });
    }

    if (user.isBlocked || user.isSuspended || user.verificationStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        suspended: true,
        message: 'Account suspended, contact support',
      });
    }

    req.currentUser = user;
    req.worker = user;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Worker authorization failed', error: err.message });
  }
};

/**
 * requireApprovedWorker Middleware:
 * Re-reads worker verification status FROM DB on EVERY call (never trusts status in JWT).
 * Strictly forbids pending, rejected, or suspended workers from accessing job features.
 */
exports.requireApprovedWorker = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token payload.' });
    }

    // Re-read fresh record from MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Worker account not found.' });
    }

    if (user.role !== 'worker' && user.role !== 'handyman') {
      return res.status(403).json({ success: false, message: 'Access restricted to service providers.' });
    }

    if (user.isBlocked || user.isSuspended || user.verificationStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        suspended: true,
        message: 'Account suspended, contact support',
      });
    }

    // Server-side check: Must be 'approved' or 'Verified'
    const isApproved = user.verificationStatus === 'approved' ||
                       user.verificationStatus === 'Verified' ||
                       user.overallStatus === 'approved';

    if (!isApproved) {
      return res.status(403).json({
        success: false,
        message: 'KYC Gate Block: Your worker account requires admin approval before accessing job features.',
        verificationStatus: user.verificationStatus || 'pending_verification',
        rejectionReason: user.rejectionReason || '',
      });
    }

    req.currentUser = user;
    req.worker = user;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Worker approval verification check failed', error: err.message });
  }
};
