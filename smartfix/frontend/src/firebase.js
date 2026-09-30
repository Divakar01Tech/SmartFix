import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  GoogleAuthProvider 
} from "firebase/auth";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCZJ9E09zuCt2wyLaesJ1D-jZSyOyJkxw0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smartfix-37bc7.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smartfix-37bc7",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smartfix-37bc7.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "979711564592",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:979711564592:web:e16f79725a09ab225686f5",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-VR5661YZG2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Google OAuth Provider — use the explicit Web Client ID
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '979711564592-72s6n7srov6140ljd0706c95vlgn7916.apps.googleusercontent.com',
  prompt: 'select_account', // Always show account picker
});

export const setupRecaptcha = (containerId = 'recaptcha-container') => {
  if (typeof window === 'undefined') return null;

  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {}
  }

  let element = document.getElementById(containerId);
  if (!element) {
    element = document.createElement('div');
    element.id = containerId;
    document.body.appendChild(element);
  }

  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: (response) => {
      console.log('✅ reCAPTCHA verified:', response);
    },
    'expired-callback': () => {
      console.warn('⚠️ reCAPTCHA expired.');
    }
  });

  return window.recaptchaVerifier;
};

export const sendPhoneOtp = async (phoneNumber, containerId = 'recaptcha-container') => {
  const formattedPhone = phoneNumber.startsWith('+') 
    ? phoneNumber 
    : `+91${phoneNumber.replace(/\D/g, '')}`;

  const appVerifier = setupRecaptcha(containerId);
  console.log(`📱 Firebase Auth: Sending SMS OTP to ${formattedPhone}...`);

  const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
  window.confirmationResult = confirmationResult;
  return confirmationResult;
};

export const verifyPhoneOtp = async (otpCode, confirmationResultObj = null) => {
  const confirmation = confirmationResultObj || window.confirmationResult;
  if (!confirmation) {
    throw new Error('No active Firebase OTP verification session found. Please click Send OTP first.');
  }

  const result = await confirmation.confirm(otpCode);
  const user = result.user;
  const idToken = await user.getIdToken();

  return {
    user,
    idToken,
    phone: user.phoneNumber,
    uid: user.uid,
  };
};

export default app;
