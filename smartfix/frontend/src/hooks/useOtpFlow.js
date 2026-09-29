import { useState, useEffect, useRef } from 'react';

const getApiBase = () => {
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:5000/api`;
  }
  return 'http://localhost:5000/api';
};


const BASE_URL = getApiBase();

export function useOtpFlow(initialPhone = '', initialPurpose = 'login') {
  const [phone, setPhone] = useState(initialPhone);
  const [purpose, setPurpose] = useState(initialPurpose);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [timer, setTimer] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    if (timerActive && timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    } else if (timer === 0) {
      setTimerActive(false);
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive, timer]);

  const validatePhone = (phoneNumber) => {
    const cleaned = (phoneNumber || '').replace(/\D/g, '');
    return cleaned.length === 10 || (cleaned.length === 12 && cleaned.startsWith('91'));
  };

  const sendOtp = async (targetPhone = phone, targetPurpose = purpose) => {
    setError('');
    setSuccessInfo('');

    if (!validatePhone(targetPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return false;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone, purpose: targetPurpose }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to send OTP. Please try again.');
      }

      setPhone(targetPhone);
      setPurpose(targetPurpose);
      setStep(2);
      setOtp('');
      setTimer(60);
      setTimerActive(true);
      setSuccessInfo(data.message || `A 6-digit verification OTP has been sent via SMS to +91 ${targetPhone.replace(/\D/g, '').slice(-10)}.`);
      setLoading(false);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
      setLoading(false);
      return false;
    }
  };

  const verifyOtp = async (codeToVerify = otp, targetPurpose = purpose) => {
    setError('');
    setSuccessInfo('');

    if (!codeToVerify || codeToVerify.trim().length < 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return null;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          purpose: targetPurpose,
          otp: codeToVerify.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Invalid or expired OTP code.');
      }

      setIsVerified(true);
      setStep(3);
      setSuccessInfo('OTP code verified successfully!');
      setLoading(false);
      return data;
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP code.');
      setLoading(false);
      return null;
    }
  };

  const resendOtp = async () => {
    if (timer > 0 && timerActive) return false;
    return await sendOtp(phone, purpose);
  };

  const resetFlow = () => {
    setOtp('');
    setStep(1);
    setError('');
    setSuccessInfo('');
    setIsVerified(false);
    setTimer(60);
    setTimerActive(false);
  };

  return {
    phone,
    setPhone,
    purpose,
    setPurpose,
    otp,
    setOtp,
    step,
    setStep,
    timer,
    canResend: timer === 0 || !timerActive,
    loading,
    error,
    setError,
    successInfo,
    setSuccessInfo,
    isVerified,
    sendOtp,
    verifyOtp,
    resendOtp,
    resetFlow,
  };
}
