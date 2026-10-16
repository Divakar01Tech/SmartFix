import { useState, useRef, useEffect } from 'react';

export default function OtpInput({
  value = '',
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = true,
  theme = 'light',
}) {
  const inputRefs = useRef([]);
  const [slots, setSlots] = useState(() => Array.from({ length: 6 }, (_, i) => value[i] || ''));

  useEffect(() => {
    const currentVal = slots.join('');
    if (value !== currentVal) {
      setSlots(Array.from({ length: 6 }, (_, i) => value[i] || ''));
    }
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (e, index) => {
    const raw = e.target.value;
    const digit = raw.replace(/\D/g, '').slice(-1);

    const nextSlots = [...slots];
    nextSlots[index] = digit;
    setSlots(nextSlots);

    const fullCode = nextSlots.join('');
    if (onChange) onChange(fullCode);

    if (digit) {
      if (index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1].focus();
      }
      const isComplete = nextSlots.every((s) => s.length === 1);
      if (isComplete && onComplete) {
        onComplete(fullCode);
      }
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (slots[index]) {
        e.preventDefault();
        const nextSlots = [...slots];
        nextSlots[index] = '';
        setSlots(nextSlots);
        if (onChange) onChange(nextSlots.join(''));
      } else if (index > 0 && inputRefs.current[index - 1]) {
        e.preventDefault();
        inputRefs.current[index - 1].focus();
        const nextSlots = [...slots];
        nextSlots[index - 1] = '';
        setSlots(nextSlots);
        if (onChange) onChange(nextSlots.join(''));
      }
    } else if (e.key === 'Enter') {
      // Prevent accidental early form submission
      e.preventDefault();
      const fullCode = slots.join('');
      if (fullCode.length === 6 && onComplete) {
        onComplete(fullCode);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const nextSlots = Array.from({ length: 6 }, (_, i) => pasteData[i] || '');
    setSlots(nextSlots);
    if (onChange) onChange(pasteData);

    if (pasteData.length === 6 && onComplete) {
      onComplete(pasteData);
    }

    const nextFocusIndex = Math.min(pasteData.length, 5);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  return (
    <div
      className="otp-boxes-container"
      style={{
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        margin: '16px 0',
      }}
    >
      {slots.map((digit, i) => (
        <input
          key={i}
          id={`otp-digit-${i + 1}`}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={digit}
          disabled={disabled}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`OTP Digit ${i + 1} of 6`}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onFocus={(e) => e.target.select()}
          onPaste={handlePaste}
          style={{
            width: '46px',
            height: '52px',
            fontSize: '1.4rem',
            fontWeight: '700',
            textAlign: 'center',
            borderRadius: '12px',
            border: error
              ? '2px solid #ef4444'
              : digit
              ? '2px solid #3b82f6'
              : theme === 'dark'
              ? '1.5px solid #334155'
              : '1.5px solid #cbd5e1',
            background: disabled
              ? theme === 'dark'
                ? '#0f172a'
                : '#f1f5f9'
              : theme === 'dark'
              ? '#1e293b'
              : '#ffffff',
            color: theme === 'dark' ? '#f8fafc' : '#0f172a',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: digit
              ? theme === 'dark'
                ? '0 2px 10px rgba(59, 130, 246, 0.25)'
                : '0 2px 8px rgba(37, 99, 235, 0.15)'
              : 'none',
          }}
        />
      ))}
    </div>
  );
}
