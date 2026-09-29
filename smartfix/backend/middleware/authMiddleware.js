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
 * Server-side KYC Guard: Ensures worker has overallStatus === 'approved' or verificationStatus === 'Verified'
 * before accessing active job list or taking actions on bookings.
 */
exports.requireApprovedWorker = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Not authorized, no user ID found in token' });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'handyman') {
      return res.status(403).json({ message: 'Access restricted to service providers.' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: '🚫 Account suspended by SmartFix Admin.' });
    }

    // Check dual KYC & Skill verification rule
    const isIdentityVerified = user.identity?.status === 'verified' || user.verificationStatus === 'Verified';
    const isSkillVerified = user.skill?.status === 'verified' || user.verificationStatus === 'Verified';
    const isFullyApproved = (user.overallStatus === 'approved' || user.verificationStatus === 'Verified') && isIdentityVerified && isSkillVerified;

    if (!isFullyApproved) {
      return res.status(403).json({
        message: '🚫 KYC Gate Block: Your worker account requires both Identity & Skill Verification approval by SmartFix Admin before you can access job requests or accept bookings.',
        verificationStatus: user.verificationStatus || 'Pending',
        overallStatus: user.overallStatus || 'pending',
      });
    }

    req.currentUser = user;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Worker verification check failed', error: err.message });
  }
};
