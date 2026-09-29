import { useRef, useEffect } from 'react';

/**
 * Reusable 6-digit OTP input component with auto-focus-next,
 * backspace navigation, and paste support.
 */
export default function OtpInput({ value = '', onChange, disabled = false, error = false, autoFocus = true }) {
  const inputRefs = useRef([]);

  // Ensure value is formatted as array of 6 characters
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (e, index) => {
    const val = e.target.value;
    const lastChar = val.substring(val.length - 1);

    if (!/^\d*$/.test(lastChar)) return;

    const newDigits = [...digits];
    newDigits[index] = lastChar;
    const newCombined = newDigits.join('');
    onChange(newCombined);

    // Auto-focus next box if digit was typed
    if (lastChar && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0 && inputRefs.current[index - 1]) {
        // If current box is empty, focus previous box and delete its value
        inputRefs.current[index - 1].focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        onChange(newDigits.join(''));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData) {
      onChange(pasteData);
      const nextFocusIndex = Math.min(pasteData.length, 5);
      if (inputRefs.current[nextFocusIndex]) {
        inputRefs.current[nextFocusIndex].focus();
      }
    }
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
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          style={{
            width: '46px',
            height: '52px',
            fontSize: '1.4rem',
            fontWeight: '700',
            textAlign: 'center',
            borderRadius: '12px',
            border: error ? '2px solid #ef4444' : digit ? '2px solid #2563eb' : '1.5px solid #cbd5e1',
            background: disabled ? '#f1f5f9' : '#ffffff',
            color: '#0f172a',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: digit ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none',
          }}
        />
      ))}
    </div>
  );
}
