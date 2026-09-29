import { useState, useEffect, useRef } from 'react';
import { sendPhoneOtp, verifyPhoneOtp } from '../firebase';

export const usePhoneAuth = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const timerRef = useRef(null);

  const API_BASE = 'http://localhost:5000/api';

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [countdown]);

  const mapFirebaseError = (err) => {
    const code = err?.code || err?.message || '';
    if (code.includes('auth/too-many-requests')) {
      return '⚠️ Daily OTP quota limit reached (10 SMS/day limit). Please try again tomorrow or use Password Login.';
    }
    if (code.includes('auth/invalid-phone-number')) {
      return 'Invalid mobile number format. Please enter a valid 10-digit phone number.';
    }
    if (code.includes('auth/code-expired')) {
      return 'The OTP code has expired. Please request a new OTP code.';
    }
    if (code.includes('auth/invalid-verification-code')) {
      return 'Incorrect 6-digit OTP code. Please check and try again.';
    }
    if (code.includes('captcha') || code.includes('recaptcha')) {
      return 'reCAPTCHA verification failed. Please refresh the page and try again.';
    }
    return err.message || 'Phone authentication failed. Please try again.';
  };

  const handleSendOtp = async (inputPhone, containerId = 'recaptcha-container') => {
    if (!inputPhone || inputPhone.trim().length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return false;
    }

    const clean = inputPhone.replace(/\D/g, '');
    const mobile10 = clean.length === 12 && clean.startsWith('91') ? clean.substring(2) : clean;
    const formatted = `+91${mobile10}`;

    setLoading(true);
    setError('');

    try {
      const result = await sendPhoneOtp(formatted, containerId);
      setConfirmationResult(result);
      setPhone(formatted);
      setStep('otp');
      setCountdown(60);
      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      const friendlyMsg = mapFirebaseError(err);
      setError(friendlyMsg);
      return false;
    }
  };

  const handleVerifyOtp = async (otpCode, purpose = 'login') => {
    const codeToVerify = otpCode || otp;
    if (!codeToVerify || codeToVerify.trim().length !== 6) {
      setError('Please enter the full 6-digit OTP code');
      return null;
    }

    setLoading(true);
    setError('');

    try {
      const firebaseResult = await verifyPhoneOtp(codeToVerify, confirmationResult);

      const response = await fetch(`${API_BASE}/auth/verify-firebase-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: firebaseResult.idToken,
          phone: phone || firebaseResult.phone,
          purpose: purpose,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      setStep('verified');
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      const friendlyMsg = mapFirebaseError(err);
      setError(friendlyMsg);
      return null;
    }
  };

  const resetAuth = () => {
    setPhone('');
    setOtp('');
    setStep('phone');
    setError('');
    setCountdown(0);
    setConfirmationResult(null);
  };

  return {
    phone,
    otp,
    setOtp,
    step,
    setStep,
    loading,
    error,
    setError,
    countdown,
    sendOtp: handleSendOtp,
    confirmOtp: handleVerifyOtp,
    resetAuth,
  };
};
