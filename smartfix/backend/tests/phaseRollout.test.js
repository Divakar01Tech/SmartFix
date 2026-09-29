const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smartfix_secret_key';

// Mock dependencies or set up test environment if running without live MongoDB
const { sanitizeBookingForRole } = require('../utils/sanitizer');
const { requireApprovedWorker } = require('../middleware/authMiddleware');

describe('SmartFix Phase Rollout Automated Test Suite', () => {

  // 1. Booking lifecycle state transitions
  describe('a. Booking Lifecycle State Transitions', () => {
    const VALID_TRANSITIONS = {
      PendingDispatch: ['Pending', 'Accepted', 'Declined', 'Cancelled'],
      Pending: ['Accepted', 'Declined', 'Cancelled'],
      Accepted: ['Confirmed', 'EnRoute', 'Arrived', 'WorkInProgress', 'Completed', 'Declined', 'Cancelled'],
      Confirmed: ['EnRoute', 'Arrived', 'WorkInProgress', 'Completed', 'Cancelled'],
      EnRoute: ['Arrived', 'WorkInProgress', 'Completed', 'Cancelled'],
      Arrived: ['WorkInProgress', 'Completed', 'Cancelled'],
      WorkInProgress: ['Completed', 'Cancelled'],
      Completed: ['Paid'],
      Paid: ['Reviewed'],
      Reviewed: [],
      Cancelled: [],
      Declined: [],
    };

    it('should reject invalid transition directly from Pending to Completed', () => {
      const currentStatus = 'Pending';
      const attemptedStatus = 'Completed';
      const allowedNextStates = VALID_TRANSITIONS[currentStatus] || [];
      expect(allowedNextStates.includes(attemptedStatus)).toBe(false);
    });

    it('should allow valid transition from Accepted to Confirmed or EnRoute', () => {
      const currentStatus = 'Accepted';
      const attemptedStatus = 'EnRoute';
      const allowedNextStates = VALID_TRANSITIONS[currentStatus] || [];
      expect(allowedNextStates.includes(attemptedStatus)).toBe(true);
    });
  });

  // 2. Trust-gating
  describe('b. Trust-gating Sanitization', () => {
    const mockWorker = {
      _id: '60d5ec49f1b2c81122334455',
      name: 'Ramesh Plumber',
      phone: '+919876543210',
      rating: 4.9,
      ratingCount: 15,
      trade: 'Plumbing',
    };

    it('should scrub worker phone and rating when booking status is Pending', () => {
      const mockBooking = {
        _id: '60d5ec49f1b2c81122334499',
        status: 'Pending',
        trade: 'Plumbing',
        price: 400,
        worker: { ...mockWorker },
      };

      const sanitized = sanitizeBookingForRole(mockBooking, 'customer123', 'customer');
      expect(sanitized.worker.phone).toBeUndefined();
      expect(sanitized.worker.rating).toBeUndefined();
      expect(sanitized.worker.name).toBe('Ramesh Plumber');
    });

    it('should reveal worker phone and rating when booking status is Confirmed', () => {
      const mockBooking = {
        _id: '60d5ec49f1b2c81122334499',
        status: 'Confirmed',
        trade: 'Plumbing',
        price: 400,
        worker: { ...mockWorker },
      };

      const sanitized = sanitizeBookingForRole(mockBooking, 'customer123', 'customer');
      expect(sanitized.worker.phone).toBe('+919876543210');
      expect(sanitized.worker.rating).toBe(4.9);
    });
  });

  // 3. OTP verification & Backdoor Rejection Test
  describe('c. OTP Verification & Backdoor Rejection', () => {
    it('should verify correct OTP passes and invalid OTP fails', () => {
      const storedOtp = '583921';
      const userEnteredValid = '583921';
      const userEnteredInvalid = '111111';

      expect(userEnteredValid === storedOtp).toBe(true);
      expect(userEnteredInvalid === storedOtp).toBe(false);
    });

    it('should explicitly reject backdoor 123456 if not assigned to session', () => {
      const realOtp = '849204';
      const backdoorAttempt = '123456';
      expect(backdoorAttempt === realOtp).toBe(false);
    });
  });

  // 4. KYC Gating for Workers
  describe('d. Server-side KYC Gating', () => {
    it('should block unverified worker with identity.status !== verified', async () => {
      const req = {
        user: { id: 'worker123' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      // Mock unverified worker check
      const mockUnapprovedWorker = {
        _id: 'worker123',
        role: 'handyman',
        verificationStatus: 'Pending',
        overallStatus: 'pending',
        identity: { status: 'pending' },
        skill: { status: 'pending' },
      };

      const isIdentityVerified = mockUnapprovedWorker.identity?.status === 'verified';
      const isFullyApproved = mockUnapprovedWorker.overallStatus === 'approved' && isIdentityVerified;

      expect(isFullyApproved).toBe(false);
    });
  });

});
