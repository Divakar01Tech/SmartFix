const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key_2026';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'muthudivakar01022006@gmail.com').toLowerCase().trim();

/**
 * authenticate Middleware:
 * Statelessly verifies JWT per request.
 * Sets req.user = { id, role, email }.
 */
exports.authenticate = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const normalizedRole = decoded.role === 'handyman' ? 'worker' : decoded.role;
    req.user = {
      id: decoded.id || decoded.userId,
      role: normalizedRole,
      email: decoded.email,
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
  }
};

// Backwards-compatibility alias
exports.protect = exports.authenticate;

/**
 * authorizeRole Middleware:
 * Verifies that the caller's JWT user exists in DB, is not suspended/blocked,
 * and possesses one of the allowed roles.
 */
exports.authorizeRole = (...roles) => {
  const allowedRoles = roles.flat().map((r) => (r === 'handyman' ? 'worker' : r.toLowerCase()));

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Not authorized. Token payload missing.' });
      }

      // Early stateless role check from verified JWT
      const jwtRole = (req.user.role === 'handyman' ? 'worker' : req.user.role || '').toLowerCase();
      if (jwtRole && !allowedRoles.includes(jwtRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Role ${jwtRole} is not permitted for this resource.`,
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User account not found.' });
      }

      if (user.isBlocked || user.isSuspended || user.verificationStatus === 'suspended') {
        return res.status(403).json({
          success: false,
          suspended: true,
          message: 'Account suspended by administration.',
        });
      }

      const userRole = (user.role === 'handyman' ? 'worker' : user.role).toLowerCase();

      // Admin verification check
      if (allowedRoles.includes('admin')) {
        const cleanEmail = (user.email || '').toLowerCase().trim();
        if (userRole !== 'admin' || cleanEmail !== ADMIN_EMAIL) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Only the authorized administrator can access this panel.',
          });
        }
      }

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Role ${userRole} is not permitted for this resource.`,
        });
      }

      req.currentUser = user;
      req.userRecord = user;
      if (userRole === 'worker') {
        req.worker = user;
      }
      next();
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Role authorization check failed', error: err.message });
    }
  };
};

exports.authorizeRoles = exports.authorizeRole;
exports.requireAdmin = exports.authorizeRole('admin');
exports.requireWorker = exports.authorizeRole('worker');
exports.requireCustomer = exports.authorizeRole('customer');

/**
 * requireApprovedWorker Middleware:
 * Re-reads worker verification status FROM DB on EVERY call (never trusts status in JWT).
 * Strictly forbids pending, rejected, or suspended workers from accessing active job dispatch features.
 */
exports.requireApprovedWorker = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token payload.' });
    }

    const jwtRole = (req.user?.role === 'handyman' ? 'worker' : req.user?.role || '').toLowerCase();
    if (jwtRole && jwtRole !== 'worker') {
      return res.status(403).json({ success: false, message: 'Access restricted to service providers.' });
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

    const isApproved =
      user.verificationStatus === 'approved' ||
      user.verificationStatus === 'Verified' ||
      user.verificationStatus === 'verified' ||
      user.overallStatus === 'approved' ||
      user.isVerified === true;

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
    return res.status(500).json({ success: false, message: 'Worker approval verification check failed', error: err.message });
  }
};
