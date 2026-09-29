import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
      const res = await axios.post(`${BASE_URL}/otp/send`, {
        phone: targetPhone,
        purpose: targetPurpose,
      });

      setPhone(targetPhone);
      setPurpose(targetPurpose);
      setStep(2);
      setOtp('');
      setTimer(60);
      setTimerActive(true);
      setSuccessInfo(res.data?.message || `A 6-digit verification OTP has been sent via SMS to +91 ${targetPhone.replace(/\D/g, '').slice(-10)}.`);
      setLoading(false);
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to send OTP. Please try again.';
      setError(msg);
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
      const res = await axios.post(`${BASE_URL}/otp/verify`, {
        phone,
        purpose: targetPurpose,
        otp: codeToVerify.trim(),
      });

      setIsVerified(true);
      setStep(3);
      setSuccessInfo('OTP code verified successfully!');
      setLoading(false);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Invalid or expired OTP code.';
      setError(msg);
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
