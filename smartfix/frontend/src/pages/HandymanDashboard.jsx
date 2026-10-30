import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { useLanguage } from '../context/LanguageContext';
import { mockBookings } from '../data/mockData';
import { apiService } from '../services/api';
import socket from '../services/socket';
import LiveTrackerMap from '../components/LiveTrackerMap';
import SkillInterviewModal from '../components/SkillInterviewModal';
import WorkerScorecard from '../components/WorkerScorecard';
import WorkerAiCopilotModal from '../components/WorkerAiCopilotModal';
import SOSButton from '../components/SOSButton';
import DisputeModal from '../components/DisputeModal';

import { Wrench, CheckCircle2, Clock, MapPin, Phone, PhoneCall, MessageSquare, ShieldCheck, UserCheck, DollarSign, Award, Calendar, Navigation, ToggleLeft, ToggleRight, Radio, RefreshCw, AlertTriangle, ArrowRight, Zap, Ban, Check, X, FileText, CheckCircle, Gift, Sparkles, XCircle, CreditCard, Map, Bot } from 'lucide-react';
import './Dashboard.css';

const HandymanDashboard = ({ initialTab }) => {
  const location = useLocation();
  const { user, updateProfile } = useAuth();
  const { startCall } = useCall();
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(true);

  const getTabFromPath = () => {
    if (initialTab) return initialTab;
    const p = location.pathname;
    if (p.includes('/requests')) return 'incoming';
    if (p.includes('/jobs')) return 'completed';
    if (p.includes('/earnings')) return 'earnings';
    return 'incoming';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath);
  const [copilotBooking, setCopilotBooking] = useState(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else {
      const p = location.pathname;
      if (p.includes('/requests')) setActiveTab('incoming');
      else if (p.includes('/jobs')) setActiveTab('completed');
      else if (p.includes('/earnings')) setActiveTab('earnings');
    }
  }, [initialTab, location.pathname]);
  const [toastMessage, setToastMessage] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disputeBooking, setDisputeBooking] = useState(null);
  const [uploadingStage, setUploadingStage] = useState(null);

  // Incoming Dispatch Popup Modal
  const [incomingDispatch, setIncomingDispatch] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const countdownTimerRef = useRef(null);

  // Live GPS Broadcast State
  const [gpsActive, setGpsActive] = useState(false);
  const [currentLat, setCurrentLat] = useState(9.8433);
  const [currentLng, setCurrentLng] = useState(78.4809);
  const gpsWatchIdRef = useRef(null);

  // Withdrawal & Bank Account States
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('UPI'); // 'UPI' | 'BANK'

  const [upiPhone, setUpiPhone] = useState(user?.upiPhone || user?.phone || '');
  const [upiId, setUpiId] = useState(user?.upiId || `${user?.phone ? user.phone.replace(/\D/g, '') : '9876543210'}@upi`);
  const [bankAccountName, setBankAccountName] = useState(user?.bankAccountName || user?.name || '');
  const [bankName, setBankName] = useState(user?.bankName || 'State Bank of India');
  const [bankAccountNumber, setBankAccountNumber] = useState(user?.bankAccountNumber || '');
  const [bankIfscCode, setBankIfscCode] = useState(user?.bankIfscCode || 'SBIN0001234');
  const [savePayoutDetails, setSavePayoutDetails] = useState(true);

  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState([
    {
      id: 'WTH_984712',
      amount: 1450,
      method: 'UPI (PhonePe / GPay)',
      destination: `${user?.phone || '9876543210'}@ybl`,
      date: new Date(Date.now() - 86400000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: 'INSTANT PAYOUT SUCCESSFUL 🟢',
    },
  ]);

  const handleUploadProof = async (e, bookingId, stage) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingStage(`${bookingId}-${stage}`);
    try {
      await apiService.uploadWorkProof(bookingId, stage, file);
      setToastMessage(`✅ ${stage === 'before' ? 'Before' : 'After'} photo uploaded successfully!`);
      loadBookings();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    }
    setUploadingStage(null);
  };

  // Load bookings from API & localStorage
  const loadBookings = async () => {
    setLoading(true);
    try {
      const apiB = await apiService.getMyBookings();
      setBookings(apiB || []);
    } catch (err) {
      console.warn('Backend fetch bookings notice:', err.message);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  // Load saved worker bank & UPI payout details
  const loadBankDetails = async () => {
    try {
      const data = await apiService.getWorkerBankDetails();
      if (data && data.success && data.bankDetails) {
        const b = data.bankDetails;
        if (b.bankAccountName) setBankAccountName(b.bankAccountName);
        if (b.bankName) setBankName(b.bankName);
        if (b.bankAccountNumber) setBankAccountNumber(b.bankAccountNumber);
        if (b.bankIfscCode) setBankIfscCode(b.bankIfscCode);
        if (b.upiId) setUpiId(b.upiId);
        if (b.upiPhone) setUpiPhone(b.upiPhone);
      }
    } catch (err) {
      console.warn('Bank details fetch notice:', err.message);
    }
  };

  useEffect(() => {
    loadBookings();
    loadBankDetails();
  }, []);

  // Periodic ticker to auto-expire jobs whose SLA passes while on screen
  const [, setTicker] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker((t) => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Auto-show AI Interview Modal for new Handymen who haven't completed it
  useEffect(() => {
    const isApproved =
      user?.verificationStatus === 'Verified' ||
      user?.verificationStatus === 'approved' ||
      user?.verificationStatus === 'verified' ||
      user?.isVerified === true;

    if (user && !isApproved) {
      if (user.verificationStatus === 'Rejected' || user.verificationStatus === 'rejected') {
        setActiveTab('documents');
        setIsOnline(false);
      } else if (
        user.verificationStatus === 'Pending' ||
        user.verificationStatus === 'pending' ||
        user.verificationStatus === 'pending_verification'
      ) {
        const interviewStatus = user?.aiInterview?.status || 'pending';
        if (interviewStatus === 'pending') {
          setShowInterviewModal(true);
        }
      }
    }
  }, [user]);

  // Ref to hold the latest active booking ID for the GPS watch callback
  const activeBookingIdRef = useRef(null);
  const latestGpsRef = useRef(null);

  useEffect(() => {
    const activeJob = bookings.find((b) =>
      ['accepted', 'confirmed', 'enroute', 'en_route', 'arrived', 'inprogress', 'workinprogress'].includes(
        (b.status || '').toLowerCase()
      )
    );
    activeBookingIdRef.current = activeJob?._id || activeJob?.id || null;
  }, [bookings]);

  // Live GPS Watch Broadcast Effect
  // Emits canonical 'worker-location' event
  useEffect(() => {
    if (isOnline && navigator.geolocation) {
      // 1. Start watchPosition to react immediately to movement
      gpsWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, heading = 0, speed = 0 } = pos.coords;
          setCurrentLat(latitude);
          setCurrentLng(longitude);
          setGpsActive(true);
          latestGpsRef.current = { latitude, longitude, heading, speed };

          if (socket && isOnline) {
            socket.emit('location-update', {
              bookingId: activeBookingIdRef.current,
              latitude,
              longitude,
              timestamp: new Date().toISOString()
            });
          }
        },
        (err) => {
          console.warn('GPS Watch Notice:', err.message);
          setGpsActive(false);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
      );

      // 2. Fallback Polling interval: Emit even if stationary (every 10s)
      const forceEmitInterval = setInterval(() => {
        if (socket && isOnline && latestGpsRef.current) {
          socket.emit('location-update', {
            bookingId: activeBookingIdRef.current,
            latitude: latestGpsRef.current.latitude,
            longitude: latestGpsRef.current.longitude,
            timestamp: new Date().toISOString()
          });
        }
      }, 10000);

      return () => {
        if (gpsWatchIdRef.current) {
          navigator.geolocation.clearWatch(gpsWatchIdRef.current);
        }
        clearInterval(forceEmitInterval);
      };
    } else {
      setGpsActive(false);
    }
  }, [isOnline, user, socket]); // Re-run if socket reconnects or online status toggles

  // Socket.IO Room Joining & Multi-Event Listeners for Handyman
  useEffect(() => {
    if (!socket || !user) return;

    const userId = user._id || user.id;
    if (userId) {
      socket.emit('join-user', userId);
    }

    const handleIncomingBooking = (newBooking) => {
      console.log('⚡ Handyman received real-time booking request:', newBooking);
      if (!newBooking) return;

      // Update local state immediately
      setBookings((prev) => {
        const id = newBooking._id || newBooking.id;
        const exists = prev.some((b) => (b._id || b.id) === id);
        if (exists) {
          return prev.map((b) => ((b._id || b.id) === id ? { ...b, ...newBooking } : b));
        }
        return [newBooking, ...prev];
      });

      // Show incoming dispatch popup alert if pending
      const s = (newBooking.status || '').toLowerCase();
      if (s === 'pending' || s === 'pendingdispatch' || s === 'requested') {
        setIncomingDispatch(newBooking);
        setCountdown(30);
        setActiveTab('incoming');

        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(countdownTimerRef.current);
              setIncomingDispatch(null);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };

    socket.on('new-dispatch-request', handleIncomingBooking);
    socket.on('booking-created', handleIncomingBooking);
    const handleBookingUpdated = (updatedBooking) => {
      if (!updatedBooking) return;
      setBookings((prev) =>
        prev.map((b) => ((b._id || b.id) === (updatedBooking._id || updatedBooking.id) ? { ...b, ...updatedBooking } : b))
      );
    };

    socket.on('new-dispatch-request', handleIncomingBooking);
    socket.on('booking-created', handleIncomingBooking);
    socket.on('new-booking-request', handleIncomingBooking);
    socket.on('booking-updated', handleBookingUpdated);
    
    const handleRiskUpdated = (riskData) => {
      setBookings((prev) =>
        prev.map((b) => ((b._id || b.id) === riskData.bookingId ? { ...b, riskFlag: riskData.riskFlag, riskFactors: riskData.riskFactors } : b))
      );
    };
    
    const handleSuggestArrived = (data) => {
      if (data && data.distanceMeters !== undefined) {
        setToastMessage(`📍 You are ${Math.round(data.distanceMeters)}m away! Please mark as 'Arrived' if you have reached.`);
        setTimeout(() => setToastMessage(''), 8000);
      }
    };

    socket.on('booking-risk-updated', handleRiskUpdated);
    socket.on('suggest-arrived', handleSuggestArrived);

    return () => {
      socket.off('new-dispatch-request', handleIncomingBooking);
      socket.off('booking-created', handleIncomingBooking);
      socket.off('new-booking-request', handleIncomingBooking);
      socket.off('booking-updated', handleBookingUpdated);
      socket.off('booking-risk-updated', handleRiskUpdated);
      socket.off('suggest-arrived', handleSuggestArrived);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [user]);

  const handleAcceptDispatch = async (bId) => {
    try {
      if (apiService.acceptBooking) {
        await apiService.acceptBooking(bId);
      } else {
        await apiService.updateBookingStatus(bId, 'Accepted', { workerId: user?._id || user?.id });
      }
    } catch (e) {
      console.warn('Accept dispatch fallback:', e.message);
      try {
        await apiService.updateBookingStatus(bId, 'Accepted', { workerId: user?._id || user?.id });
      } catch (err2) {}
    }

    setBookings((prev) =>
      prev.map((b) => ((b._id || b.id) === bId ? { ...b, status: 'Accepted' } : b))
    );

    setIncomingDispatch(null);
    setActiveTab('active');
    setToastMessage('✅ Dispatch request ACCEPTED! Live GPS Navigation started.');
    setTimeout(() => setToastMessage(''), 5000);
    loadBookings();
  };

  const handleDeclineDispatch = async (bId) => {
    try {
      if (apiService.declineBooking) {
        await apiService.declineBooking(bId, 'Declined by provider');
      } else {
        await apiService.updateBookingStatus(bId, 'Declined', { workerId: user?._id || user?.id });
      }
    } catch (e) {
      try {
        await apiService.updateBookingStatus(bId, 'Declined', { workerId: user?._id || user?.id });
      } catch (err2) {}
    }

    setBookings((prev) =>
      prev.map((b) => ((b._id || b.id) === bId ? { ...b, status: 'Declined' } : b))
    );

    setIncomingDispatch(null);
    setToastMessage('❌ Request declined and passed to next available handyman.');
    setTimeout(() => setToastMessage(''), 4000);
    loadBookings();
  };

  const handleStatusUpdate = async (bId, nextStatus) => {
    const isCompleted = ['completed', 'workcompleted'].includes((nextStatus || '').toLowerCase());

    // 1. Instantly update local state so active jobs list removes it immediately
    setBookings((prev) =>
      prev.map((b) =>
        (b._id || b.id) === bId
          ? { ...b, status: nextStatus, completedAt: new Date().toISOString() }
          : b
      )
    );

    // 2. If completed, switch tab to Completed Jobs page immediately
    if (isCompleted) {
      setActiveTab('completed');
      setToastMessage(`🎉 Work Completed! Order #${String(bId).slice(-6)} moved to Completed Work page.`);
    } else {
      setToastMessage(`⚡ Job status updated to ${nextStatus}!`);
    }

    // 3. Persist update to backend database
    try {
      await apiService.updateBookingStatus(bId, nextStatus, {
        workerId: user?._id || user?.id,
        completedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Backend status update notice:', e.message);
    }

    setTimeout(() => setToastMessage(''), 5000);
    // 4. Reload from database to ensure complete sync
    loadBookings();
  };

  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(withdrawAmount) || totalWorkerPayout;
    if (amt <= 0) {
      alert('Please enter a valid withdrawal amount.');
      return;
    }

    setWithdrawSubmitting(true);

    if (savePayoutDetails) {
      try {
        await apiService.updateWorkerBankDetails({
          upiPhone,
          upiId,
          bankAccountName,
          bankName,
          bankAccountNumber,
          bankIfscCode,
        });
      } catch (err) {}
      if (updateProfile) {
        try {
          await updateProfile({
            upiPhone,
            upiId,
            bankAccountName,
            bankName,
            bankAccountNumber,
            bankIfscCode,
          });
        } catch (err) {}
      }
    }

    try {
      await apiService.withdrawWallet({
        amount: amt,
        payoutMethod,
        upiPhone,
        upiId,
        bankAccountName,
        bankAccountNumber,
        bankIfscCode,
        bankName,
      });
    } catch (e) {}

    const txnId = `TXN_WTH_${Math.floor(100000 + Math.random() * 900000)}`;
    const destinationText = payoutMethod === 'UPI'
      ? `UPI Phone: ${upiPhone} (${upiId})`
      : `${bankName} A/c ****${bankAccountNumber.slice(-4) || '1098'} (IFSC: ${bankIfscCode})`;

    const newWithdrawal = {
      id: txnId,
      amount: amt,
      method: payoutMethod === 'UPI' ? 'UPI (PhonePe/GPay)' : 'Bank Account Direct',
      destination: destinationText,
      date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      status: 'INSTANT PAYOUT SUCCESSFUL 🟢',
    };

    setTimeout(() => {
      setWithdrawalHistory((prev) => [newWithdrawal, ...prev]);
      setWithdrawSubmitting(false);
      setShowWithdrawModal(false);
      setToastMessage(`🎉 Instant Payout of ₹${amt} transferred to ${destinationText}! Transaction ID: ${txnId}`);
      setTimeout(() => setToastMessage(''), 8000);
    }, 1200);
  };

  const handleSaveBankDetails = async () => {
    setWithdrawSubmitting(true);
    try {
      await apiService.updateWorkerBankDetails({
        upiPhone,
        upiId,
        bankAccountName,
        bankName,
        bankAccountNumber,
        bankIfscCode,
      });
      if (updateProfile) {
        try {
          await updateProfile({
            upiPhone,
            upiId,
            bankAccountName,
            bankName,
            bankAccountNumber,
            bankIfscCode,
          });
        } catch (err) {}
      }
      setToastMessage('✅ Bank Account & UPI Payout details saved successfully!');
      setTimeout(() => setToastMessage(''), 5000);
      setShowWithdrawModal(false);
    } catch (err) {
      alert(`Could not save bank details: ${err.message}`);
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const getLocationLabel = (b) => {
    if (!b) return 'Tamil Nadu Area';
    if (typeof b.location === 'string' && b.location.trim()) return b.location;
    if (b.district) return `${b.district} District, Tamil Nadu`;
    if (typeof b.address === 'string' && b.address.trim()) {
      return b.address.split(',')[0] || b.address;
    }
    return 'Tamil Nadu Area';
  };

  const isApprovedWorker =
    user?.verificationStatus === 'Verified' ||
    user?.verificationStatus === 'approved' ||
    user?.verificationStatus === 'verified' ||
    user?.isVerified === true;

  // Helper to determine if a booking's SLA has expired
  const isJobExpired = (b) => {
    if (!b) return false;
    const s = (b.status || '').toLowerCase();
    if (['sla_breached', 'slabreached', 'expired'].includes(s)) return true;
    if (b.slaBreached === true) return true;
    if (b.slaDeadline) {
      const deadline = new Date(b.slaDeadline).getTime();
      if (!isNaN(deadline) && deadline < Date.now()) {
        return true;
      }
    }
    return false;
  };

  const incomingBookings = bookings.filter((b) => {
    const s = (b.status || '').toLowerCase();
    return s === 'pending' || s === 'pendingdispatch' || s === 'requested';
  });

  const activeBookings = bookings.filter((b) => {
    const s = (b.status || '').toLowerCase();
    const isActiveStatus = ['accepted', 'confirmed', 'enroute', 'en_route', 'arrived', 'captainarrived', 'inprogress', 'workinprogress'].includes(s);
    if (!isActiveStatus) return false;
    // CRITICAL: Remove expired / breached jobs from Active Jobs page
    if (isJobExpired(b)) return false;
    return true;
  });

  const completedBookings = bookings
    .filter((b) => {
      const s = (b.status || '').toLowerCase();
      return ['completed', 'workcompleted', 'paid', 'reviewed'].includes(s);
    })
    .sort((a, b) => new Date(b.completedAt || b.updatedAt || b.createdAt || 0) - new Date(a.completedAt || a.updatedAt || a.createdAt || 0));

  const cancelledBookings = bookings
    .filter((b) => {
      const s = (b.status || '').toLowerCase();
      const isCompleted = ['completed', 'workcompleted', 'paid', 'reviewed'].includes(s);
      if (isCompleted) return false;
      const isExplicitCancelled = ['cancelled', 'declined', 'rejected', 'sla_breached', 'slabreached', 'expired'].includes(s);
      return isExplicitCancelled || isJobExpired(b);
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

  // Financial Stats (90% Base Net Payout + 5% Online Customer Bonus Rewards)
  const baseWorkerPayout = completedBookings.reduce((sum, b) => {
    const price = Number(b.price) || 350;
    return sum + (price - Math.round(price * 0.10));
  }, 0);

  // 5% Online Payment Bonus sum
  const onlineBonusRewards = completedBookings.reduce((sum, b) => {
    const price = Number(b.price) || 350;
    const isOnline = b.paymentMethod && b.paymentMethod !== 'COD' && b.paymentMethod !== 'Cash';
    return sum + (isOnline ? Math.round(price * 0.05) : (b.workerBonusAmount || 0));
  }, 0);

  const totalWorkerPayout = baseWorkerPayout + onlineBonusRewards;

  return (
    <div className="handyman-dashboard container">
      {/* Header Banner with Online Toggle */}
      <div className="hd-header-card">
        <div className="hd-header-left">
          <div className="hd-avatar-badge">👨‍🔧</div>
          <div>
            <h1>Welcome, {user?.name || 'Service Partner'}</h1>
            <p className="hd-subtitle">
              <Wrench size={14} /> Trade: <strong>{user?.trade || 'Handyman Expert'}</strong> • <MapPin size={14} /> Tamil Nadu
              {user?.workerId && (
                <> • <span className="badge bg-primary text-white ms-1">ID: {user.workerId}</span></>
              )}
            </p>
          </div>
        </div>

        <div className="hd-header-right">
          {/* Online / Offline Broadcast Switch */}
          <div className={`online-toggle-box ${isOnline ? 'is-online' : 'is-offline'}`}>
            <div className="toggle-info">
              <span className="online-indicator-dot"></span>
              <strong>{isOnline ? 'ONLINE & RECEIVING JOBS' : 'OFFLINE'}</strong>
              <small>{isOnline ? (gpsActive ? '📍 GPS Broadcasting Active' : '📍 Seeking GPS Signal...') : 'Location Broadcast Paused'}</small>
            </div>
            <button
              type="button"
              className="toggle-switch-btn"
              onClick={() => {
                if (user?.verificationStatus !== 'Verified') {
                  setToastMessage('⚠️ You cannot go online until your account is approved by Admin.');
                  return;
                }
                const nextState = !isOnline;
                setIsOnline(nextState);
                if (socket) {
                  socket.emit('worker-status-changed', {
                    workerId: user?._id || user?.id,
                    isOnline: nextState,
                  });
                }
              }}
            >
              {isOnline ? <ToggleRight size={36} color="#059669" /> : <ToggleLeft size={36} color="#94a3b8" />}
            </button>
          </div>

          <button type="button" className="refresh-btn" onClick={loadBookings} title="Refresh Bookings">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Worker Performance Scorecard */}
      <div className="mt-4">
        <WorkerScorecard workerId={user?._id || user?.id} />
      </div>

      {toastMessage && (
        <div className="alert alert-danger shadow-sm rounded-4 border-0 p-3 mb-4 d-flex align-items-center gap-2 fw-bold animate__animated animate__fadeInDown">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* KYC Verification Pending or Rejected Banner */}
      {user?.verificationStatus === 'Pending' && (
        <div className="alert alert-warning d-flex align-items-center justify-content-between p-3 rounded-4 shadow-sm border-0 mb-4" style={{ background: '#fff7ed', borderLeft: '6px solid #d97706' }}>
          <div className="d-flex align-items-center gap-3">
            <Clock size={28} color="#d97706" />
            <div>
              <h6 className="fw-extrabold text-warning-emphasis mb-0">⏳ KYC VERIFICATION PENDING APPROVAL</h6>
              <small className="text-secondary">Your Mobile Number and ID proof documents are under review by SmartFix Admin. Job dispatch will activate automatically once approved.</small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm fw-bold rounded-3 px-3 shadow-xs d-inline-flex align-items-center gap-1"
              onClick={() => setShowInterviewModal(true)}
            >
              <Bot size={16} /> Skill Test 🤖
            </button>
            <button
              type="button"
              className="btn btn-warning btn-sm fw-bold rounded-3 px-3 shadow-xs"
              onClick={() => setActiveTab('documents')}
            >
              View Documents 🛡️
            </button>
          </div>
        </div>
      )}

      {user?.verificationStatus === 'Rejected' && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between p-3 rounded-4 shadow-sm border-0 mb-4" style={{ background: '#fef2f2', borderLeft: '6px solid #dc2626' }}>
          <div className="d-flex align-items-center gap-3">
            <AlertTriangle size={28} color="#dc2626" />
            <div>
              <h6 className="fw-extrabold text-danger mb-0">❌ VERIFICATION REJECTED</h6>
              <small className="text-danger-emphasis">Reason: <strong>{user?.rejectionReason || 'Documents could not be verified. Please re-upload clear ID proofs.'}</strong></small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger btn-sm fw-bold rounded-3 px-3 shadow-xs"
            onClick={() => setActiveTab('documents')}
          >
            Review Vault 🛡️
          </button>
        </div>
      )}

      {/* 5% Bonus Announcement Banner */}
      <div className="alert alert-success d-flex align-items-center justify-content-between p-3 rounded-4 shadow-sm border-0 mb-4" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #dcfce7 100%)', borderLeft: '6px solid #059669' }}>
        <div className="d-flex align-items-center gap-3">
          <Gift size={28} color="#059669" className="pulse-icon" />
          <div>
            <h6 className="fw-extrabold text-success mb-0">🎉 5% ONLINE PAYMENT BONUS ACTIVE!</h6>
            <small className="text-secondary">When customers pay online in-app via UPI, Card, or NetBanking, you get an <strong>EXTRA +5% Reward Bonus (95% Total Payout)</strong> credited instantly to your wallet!</small>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-success btn-sm fw-bold rounded-3 px-3 shadow-xs"
          onClick={() => {
            setWithdrawAmount(totalWorkerPayout > 0 ? totalWorkerPayout : 1000);
            setShowWithdrawModal(true);
          }}
        >
          Withdraw Funds 🏦
        </button>
      </div>

      {/* KPI Stats Cards (Hidden if not verified) */}
      {isApprovedWorker && (
        <div className="hd-stats-grid">
          <div className="stat-box blue">
            <div className="stat-icon"><Radio size={24} /></div>
            <div>
              <span className="stat-num">{incomingBookings.length}</span>
              <span className="stat-lbl">Incoming Requests</span>
            </div>
          </div>

          <div className="stat-box amber">
            <div className="stat-icon"><Zap size={24} /></div>
            <div>
              <span className="stat-num">{activeBookings.length}</span>
              <span className="stat-lbl">Active En Route Jobs</span>
            </div>
          </div>

          <div className="stat-box green">
            <div className="stat-icon"><CheckCircle2 size={24} /></div>
            <div>
              <span className="stat-num">{completedBookings.length}</span>
              <span className="stat-lbl">Completed Repairs</span>
            </div>
          </div>

          <div className="stat-box purple">
            <div className="stat-icon"><Gift size={24} color="#059669" /></div>
            <div>
              <span className="stat-num">₹{totalWorkerPayout}</span>
              <span className="stat-lbl">Total Net Earnings (+5% Bonus)</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs (Restricted if not verified) */}
      <div className="hd-tabs-bar">
        {isApprovedWorker && (
          <>
            <button
              className={`hd-tab-btn ${activeTab === 'incoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('incoming')}
            >
              <Radio size={16} /> Incoming Requests ({incomingBookings.length})
            </button>
            <button
              className={`hd-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
              onClick={() => setActiveTab('active')}
            >
              <Zap size={16} /> Active Jobs ({activeBookings.length})
            </button>
            <button
              className={`hd-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              <CheckCircle2 size={16} /> Completed Jobs ({completedBookings.length})
            </button>
            <button
              className={`hd-tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
              onClick={() => setActiveTab('cancelled')}
            >
              <XCircle size={16} /> Cancelled / Expired ({cancelledBookings.length})
            </button>
            <button
              className={`hd-tab-btn ${activeTab === 'earnings' ? 'active' : ''}`}
              onClick={() => setActiveTab('earnings')}
            >
              <DollarSign size={16} /> Wallet & Withdrawals 🏦
            </button>
          </>
        )}
        <button
          className={`hd-tab-btn ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <ShieldCheck size={16} /> Verification & Documents
        </button>
      </div>

      {/* Tab 1: Incoming Dispatch Requests */}
      {activeTab === 'incoming' && (
        <div className="hd-tab-content">
          <h2 className="section-title">⚡ Real-Time On-Demand Dispatch Requests</h2>

          {!isOnline && (
            <div className="offline-notice-box">
              <AlertTriangle size={20} color="#d97706" />
              <div>
                <strong>You are currently OFFLINE.</strong>
                <p>Toggle your status switch to ONLINE to start receiving 5 km radial job dispatches.</p>
              </div>
            </div>
          )}

          {incomingBookings.length === 0 ? (
            <div className="empty-state-box">
              <Radio size={48} color="#94a3b8" />
              <h3>No Incoming Dispatch Requests</h3>
              <p>New service requests within your 5 km dispatch radius will appear here live with audio alerts.</p>
            </div>
          ) : (
            <div className="incoming-jobs-list">
              {incomingBookings.map((b) => {
                const bId = b._id || b.id;
                return (
                  <div key={bId} className="incoming-job-card highlight">
                    <div className="job-card-head">
                      <div>
                        <span className="trade-badge">{b.trade} Service</span>
                        <h3>📍 {getLocationLabel(b)} <small style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 'normal' }}>(Exact address hidden until accepted)</small></h3>
                        <p className="job-customer-info">
                          Customer: <strong>{b.customerName || b.customer?.name || 'Homeowner'}</strong>
                        </p>
                        {b.notes && (
                          <p className="small text-secondary mb-1">
                            <strong>Problem:</strong> <span className="fst-italic text-dark">"{b.notes}"</span>
                          </p>
                        )}
                      </div>
                      <div className="job-price-badge">
                        <span>Rate / Price</span>
                        <strong>₹{b.price || 350}/hr</strong>
                      </div>
                    </div>

                    <div className="job-card-body">
                      <div className="job-meta-row">
                        <span><Clock size={14} /> Requested: {b.time || 'Immediate Dispatch'}</span>
                        <span><MapPin size={14} /> {getLocationLabel(b)}</span>
                      </div>
                      {b.subServices && b.subServices.length > 0 && (
                        <div className="job-subservices-chips">
                          {b.subServices.map((sub) => (
                            <span key={sub} className="sub-chip">✓ {sub}</span>
                          ))}
                        </div>
                      )}

                      <div className="job-onehour-notice">
                        <Gift size={14} color="#059669" /> Online Payment unlocks <strong>+5% Bonus (₹{Math.round((b.price || 350) * 0.05)})</strong> for you!
                      </div>
                    </div>

                    <div className="job-card-actions">
                      <button
                        type="button"
                        className="btn btn-sm fw-bold d-inline-flex align-items-center gap-1 rounded-pill px-3"
                        onClick={() => setCopilotBooking(b)}
                        style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#b45309', fontSize: '0.8rem' }}
                      >
                        <Sparkles size={14} /> ⚡ AI Tools & Parts
                      </button>
                      <button
                        type="button"
                        className="accept-job-btn"
                        onClick={() => handleAcceptDispatch(bId)}
                      >
                        <Check size={18} /> Accept Job
                      </button>
                      <button
                        type="button"
                        className="decline-job-btn"
                        onClick={() => handleDeclineDispatch(bId)}
                      >
                        <X size={18} /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Active En-Route Jobs */}
      {activeTab === 'active' && (
        <div className="hd-tab-content">
          <h2 className="section-title">🚗 Active Jobs En Route (Live Location Broadcast)</h2>

          {activeBookings.length === 0 ? (
            <div className="empty-state-box">
              <Zap size={48} color="#94a3b8" />
              <h3>No Active Jobs En Route</h3>
              <p>Accept an incoming dispatch request to start live GPS navigation.</p>
            </div>
          ) : (
            <div className="active-jobs-list">
              {activeBookings.map((b) => {
                const bId = b._id || b.id;
                const custPhone = b.customerPhone || b.customer?.phone || '+919876543210';
                const cleanPhone = custPhone.replace(/[^0-9]/g, '');
                const waMsg = encodeURIComponent(`Hello, I am your SmartFix handyman ${user?.name || ''}. I have accepted your job and am on my way to ${typeof b.address === 'string' && b.address ? b.address : 'your location'}.`);

                return (
                  <div key={bId} className="active-job-detailed-card">
                    <div className="aj-header">
                      <div>
                        <h3>{b.trade} Service — Order #{bId.slice(-6)}</h3>
                        <p><MapPin size={14} /> {typeof b.address === 'string' && b.address ? b.address : getLocationLabel(b)}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <span className="aj-status-pill">{b.status}</span>
                        {(b.riskFlag === 'high' || b.riskFlag === 'medium') && (
                          <div style={{ background: b.riskFlag === 'high' ? '#fff1f2' : '#fffbeb', border: `1px solid ${b.riskFlag === 'high' ? '#fecdd3' : '#fef3c7'}`, color: b.riskFlag === 'high' ? '#be123c' : '#b45309', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={14} /> 
                            {b.riskFlag === 'high' ? 'High Risk:' : 'Medium Risk:'} 
                            <span style={{ fontWeight: 'normal', fontStyle: 'italic' }}>{(b.riskFactors && b.riskFactors[0]) || 'Potential cancellation'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="aj-contact-bar flex-wrap align-items-center justify-content-between p-3 rounded-3 mb-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="d-flex align-items-center gap-2 mb-2 mb-md-0">
                        <span className="fw-bold text-dark small">📍 Customer Doorstep Spot:</span>
                        <span className="badge bg-primary font-monospace">
                          {Number(b.userLat || b.pickupLat || b.location?.coordinates?.[1] || 9.8433).toFixed(4)}, {Number(b.userLng || b.pickupLng || b.location?.coordinates?.[0] || 78.4809).toFixed(4)}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${b.userLat || b.pickupLat || b.location?.coordinates?.[1] || 9.8433},${b.userLng || b.pickupLng || b.location?.coordinates?.[0] || 78.4809}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-success btn-sm text-white fw-bold d-inline-flex align-items-center gap-1 shadow-sm px-3"
                          style={{ background: '#059669', borderColor: '#059669' }}
                        >
                          <Navigation size={14} /> Navigate Turn-by-Turn (Google Maps) 🗺️
                        </a>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm text-white fw-bold d-inline-flex align-items-center gap-1 shadow-sm px-3"
                          onClick={() =>
                            startCall({
                              receiverId: b.customerId || b.user || 'cust_default',
                              receiverName: b.customerName || 'Customer',
                              receiverRole: 'Customer',
                              receiverAvatar: '👤',
                              receiverPhone: custPhone,
                              bookingId: bId,
                            })
                          }
                        >
                          <PhoneCall size={14} /> In-App Call
                        </button>
                        <a href={`tel:${custPhone}`} className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1">
                          <Phone size={14} /> Mobile
                        </a>
                        <a href={`https://wa.me/${cleanPhone}?text=${waMsg}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1">
                          <MessageSquare size={14} /> WhatsApp
                        </a>
                        <button
                          type="button"
                          className="btn btn-warning btn-sm text-dark fw-bold d-inline-flex align-items-center gap-1 shadow-sm px-3"
                          onClick={() => setCopilotBooking(b)}
                          title="Open AI Technician Pre-Visit Co-Pilot"
                        >
                          <Sparkles size={14} /> ⚡ AI Co-Pilot
                        </button>
                      </div>
                    </div>

                    {/* Live Tracker Map Integration: Shown immediately once accepted */}
                    <div className="aj-map-wrapper mb-3">
                      {['Accepted', 'accepted', 'Confirmed', 'confirmed', 'EnRoute', 'en_route', 'Arrived', 'arrived', 'WorkInProgress', 'workinprogress', 'in_progress', 'InProgress'].includes(b.status) && (
                        <LiveTrackerMap
                          booking={b}
                          worker={user}
                          userLat={b.userLat || b.pickupLat || b.location?.coordinates?.[1] || 9.8433}
                          userLng={b.userLng || b.pickupLng || b.location?.coordinates?.[0] || 78.4809}
                          slaDeadline={b.slaDeadline}
                        />
                      )}
                      {/* Mutual Live GPS Broadcasting status */}
                      <div className="gps-broadcasting-banner" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                        <span className="live-dot-pulse" />
                        📡 Mutual Live Tracking Active: Customer can see your live position approaching their doorstep.
                      </div>
                    </div>

                    {/* Status Stepper Actions — canonical status values */}
                    <div className="aj-stepper-actions">
                      {/* Accepted → start journey en-route to customer */}
                      {['Accepted', 'accepted', 'Confirmed', 'confirmed'].includes(b.status) && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="step-btn arrival-btn"
                            style={{ flex: 1, minWidth: '180px' }}
                            onClick={() => handleStatusUpdate(bId, 'EnRoute')}
                          >
                            <Navigation size={16} /> Start Journey → "En Route"
                          </button>
                          <button
                            type="button"
                            className="step-btn complete-work-btn"
                            style={{ flex: 1, minWidth: '180px', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#ffffff', fontWeight: '800' }}
                            onClick={() => handleStatusUpdate(bId, 'Completed')}
                          >
                            <CheckCircle2 size={16} /> Complete Work ✓
                          </button>
                        </div>
                      )}

                      {/* EnRoute → mark physical arrival, stops GPS tracking */}
                      {['EnRoute', 'en_route'].includes(b.status) && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="step-btn arrival-btn"
                            style={{ flex: 1, minWidth: '180px' }}
                            onClick={() => handleStatusUpdate(bId, 'Arrived')}
                          >
                            <MapPin size={16} /> Mark "I Have Arrived"
                          </button>
                          <button
                            type="button"
                            className="step-btn complete-work-btn"
                            style={{ flex: 1, minWidth: '180px', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#ffffff', fontWeight: '800' }}
                            onClick={() => handleStatusUpdate(bId, 'Completed')}
                          >
                            <CheckCircle2 size={16} /> Complete Work ✓
                          </button>
                        </div>
                      )}

                      {['Arrived', 'arrived', 'CaptainArrived'].includes(b.status) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label className="step-btn" style={{ background: '#475569', cursor: 'pointer', textAlign: 'center' }}>
                            {uploadingStage === `${bId}-before` ? 'Uploading...' : '📷 Upload Before Photo (Optional)'}
                            <input type="file" accept="image/*" hidden onChange={(e) => handleUploadProof(e, bId, 'before')} disabled={uploadingStage} />
                          </label>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="step-btn start-work-btn"
                              style={{ flex: 1, minWidth: '150px' }}
                              onClick={() => handleStatusUpdate(bId, 'WorkInProgress')}
                            >
                              <Wrench size={16} /> Mark "Work In Progress"
                            </button>
                            <button
                              type="button"
                              className="step-btn complete-work-btn"
                              style={{ flex: 1, minWidth: '180px', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#ffffff', fontWeight: '800' }}
                              onClick={() => handleStatusUpdate(bId, 'Completed')}
                            >
                              <CheckCircle2 size={16} /> Complete Work &amp; Move to Completed Page ✓
                            </button>
                          </div>
                        </div>
                      )}

                      {/* WorkInProgress / InProgress → complete */}
                      {(b.status === 'WorkInProgress' || b.status === 'InProgress' || b.status === 'workinprogress' || b.status === 'in_progress') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label className="step-btn" style={{ background: '#475569', cursor: 'pointer', textAlign: 'center' }}>
                            {uploadingStage === `${bId}-after` ? 'Uploading...' : '📸 Upload After Photo (Optional)'}
                            <input type="file" accept="image/*" hidden onChange={(e) => handleUploadProof(e, bId, 'after')} disabled={uploadingStage} />
                          </label>
                          <button
                            type="button"
                            className="step-btn complete-work-btn"
                            style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#ffffff', fontWeight: '800', padding: '14px', fontSize: '1rem' }}
                            onClick={() => handleStatusUpdate(bId, 'Completed')}
                          >
                            <CheckCircle2 size={18} /> Complete Work &amp; Move to Completed Work Page (Collect ₹{b.price}) ✓
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Completed Jobs */}
      {activeTab === 'completed' && (
        <div className="hd-tab-content">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <h2 className="section-title mb-0">✓ Completed Service Orders &amp; Payout Records</h2>
            <span className="badge bg-success-subtle text-success fs-6 px-3 py-2 rounded-pill fw-bold border border-success">
              🟢 {completedBookings.length} Total Completed Jobs
            </span>
          </div>

          {completedBookings.length > 0 && (
            <div className="alert alert-success d-flex align-items-center justify-content-between p-3 rounded-4 mb-3 border-0 shadow-sm flex-wrap gap-2" style={{ background: '#ecfdf5', color: '#065f46' }}>
              <div className="d-flex align-items-center gap-2">
                <CheckCircle size={24} className="text-success flex-shrink-0" />
                <div>
                  <strong className="d-block">All Completed Work Recorded Successfully</strong>
                  <small style={{ color: '#047857' }}>Completed jobs are safely archived here. 90% base share + 5% online rewards are credited to your withdrawable wallet.</small>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-success fw-bold rounded-3 px-3 shadow-sm"
                onClick={() => setActiveTab('earnings')}
              >
                View In Wallet 💰
              </button>
            </div>
          )}

          {completedBookings.length === 0 ? (
            <div className="empty-state-box">
              <CheckCircle2 size={48} color="#94a3b8" />
              <h3>No Completed Jobs Yet</h3>
              <p>Jobs you complete will be logged here with customer ratings &amp; 90% payout breakdowns.</p>
            </div>
          ) : (
            <div className="completed-table-wrapper">
              <table className="completed-jobs-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Customer Name</th>
                    <th>Service Trade</th>
                    <th>Status</th>
                    <th>Total Fare</th>
                    <th>Base Share (90%)</th>
                    <th>Bonus (+5%)</th>
                    <th>Total Payout</th>
                    <th>Payment Mode</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {completedBookings.map((b) => {
                    const bId = b._id || b.id;
                    const price = Number(b.price) || 350;
                    const baseShare = price - Math.round(price * 0.10);
                    const isOnline = b.paymentMethod && b.paymentMethod !== 'COD' && b.paymentMethod !== 'Cash';
                    const bonus = isOnline ? Math.round(price * 0.05) : (b.workerBonusAmount || 0);

                    return (
                      <tr key={bId}>
                        <td><strong>#{String(bId).slice(-6)}</strong></td>
                        <td>
                          <div className="fw-bold text-dark">{b.customerName || b.customer?.name || 'Customer'}</div>
                          <small className="text-muted">{b.location || b.address || 'Service Spot'}</small>
                        </td>
                        <td>{b.trade}</td>
                        <td>
                          <span className="badge bg-success-subtle text-success fw-bold px-2 py-1 rounded-pill border border-success">
                            ✓ Completed
                          </span>
                        </td>
                        <td>₹{price}</td>
                        <td>₹{baseShare}</td>
                        <td><span className="text-success fw-bold">+₹{bonus}</span></td>
                        <td><strong style={{ color: '#059669', fontSize: '1rem' }}>₹{baseShare + bonus}</strong></td>
                        <td>
                          <span className={`badge ${isOnline ? 'bg-primary' : 'bg-secondary'}`}>
                            {b.paymentMethod || 'Paid'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger fw-bold d-inline-flex align-items-center gap-1 rounded-3"
                            onClick={() => setDisputeBooking(b)}
                          >
                            <AlertTriangle size={14} /> Report Issue
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Cancelled, Declined & Expired Jobs */}
      {activeTab === 'cancelled' && (
        <div className="hd-tab-content">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <h2 className="section-title mb-0">❌ Cancelled, Declined &amp; Expired Requests</h2>
            <span className="badge bg-danger-subtle text-danger fs-6 px-3 py-2 rounded-pill fw-bold border border-danger">
              ⚠️ {cancelledBookings.length} Expired / Cancelled Orders
            </span>
          </div>

          {cancelledBookings.length === 0 ? (
            <div className="empty-state-box">
              <XCircle size={48} color="#94a3b8" />
              <h3>No Cancelled or Expired Requests</h3>
              <p>Jobs that were declined, cancelled by customer, or expired by SLA guarantee are safely archived here.</p>
            </div>
          ) : (
            <div className="completed-table-wrapper">
              <table className="completed-jobs-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Customer Name</th>
                    <th>Service Trade</th>
                    <th>Address</th>
                    <th>Quoted Price</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledBookings.map((b) => {
                    const bId = b._id || b.id;
                    const expired = isJobExpired(b);
                    return (
                      <tr key={bId}>
                        <td><strong>#{String(bId).slice(-6)}</strong></td>
                        <td>{b.customerName || b.customer?.name || 'Homeowner'}</td>
                        <td>{b.trade}</td>
                        <td>{b.address || 'Tamil Nadu'}</td>
                        <td>₹{b.price || 350}</td>
                        <td>
                          {expired ? (
                            <span className="badge bg-danger text-white fw-bold px-2 py-1 rounded-pill">
                              ⏰ SLA Expired (Breached)
                            </span>
                          ) : (
                            <span className="badge bg-secondary text-white fw-bold px-2 py-1 rounded-pill">
                              ❌ {b.status}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            {expired && (
                              <button
                                type="button"
                                className="btn btn-sm btn-success fw-bold d-inline-flex align-items-center gap-1 rounded-3 shadow-sm"
                                onClick={() => handleStatusUpdate(bId, 'Completed')}
                                title="If you finished the work, mark it completed to collect your payout"
                              >
                                <CheckCircle size={14} /> Claim Completed
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger fw-bold d-inline-flex align-items-center gap-1 rounded-3"
                              onClick={() => setDisputeBooking(b)}
                            >
                              <AlertTriangle size={14} /> Report Issue
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Wallet, Bank Payout & Withdrawals */}
      {activeTab === 'earnings' && (
        <div className="hd-tab-content">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <h2 className="section-title mb-0">💰 Wallet, Bank Payout & 5% Online Rewards</h2>
            <button
              type="button"
              className="btn btn-success fw-bold rounded-3 px-4 py-2 d-flex align-items-center gap-2 shadow-sm"
              onClick={() => {
                setWithdrawAmount(totalWorkerPayout > 0 ? totalWorkerPayout : 1000);
                setShowWithdrawModal(true);
              }}
            >
              <CreditCard size={18} /> Withdraw Funds to Bank / UPI 🏦
            </button>
          </div>

          <div className="wallet-cards-grid">
            <div className="wallet-card primary">
              <DollarSign size={32} />
              <div>
                <span className="wc-label">Base Payout (90% Share)</span>
                <h3 className="wc-value">₹{baseWorkerPayout}</h3>
                <small>Standard 90% direct earnings credit</small>
              </div>
            </div>

            <div className="wallet-card secondary" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#ffffff' }}>
              <Gift size={32} />
              <div>
                <span className="wc-label" style={{ color: '#a7f3d0' }}>5% Online Payment Rewards</span>
                <h3 className="wc-value" style={{ color: '#ffffff' }}>+₹{onlineBonusRewards}</h3>
                <small style={{ color: '#ecfdf5' }}>Extra bonus granted on customer online payments!</small>
              </div>
            </div>

            <div className="wallet-card tertiary">
              <CheckCircle size={32} />
              <div>
                <span className="wc-label">Total Withdrawable Balance</span>
                <h3 className="wc-value">₹{totalWorkerPayout}</h3>
                <button
                  type="button"
                  className="withdraw-btn"
                  onClick={() => {
                    setWithdrawAmount(totalWorkerPayout > 0 ? totalWorkerPayout : 1000);
                    setShowWithdrawModal(true);
                  }}
                >
                  Withdraw Funds Now 🏦
                </button>
              </div>
            </div>
          </div>

          {/* Active Payout Details Box */}
          <div className="card border-0 shadow-sm rounded-4 p-4 mt-4 bg-white">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <ShieldCheck size={20} className="text-primary" /> Active Payout Account Details
              </h5>
              <button
                type="button"
                className="btn btn-outline-primary btn-sm fw-bold rounded-3"
                onClick={() => setShowWithdrawModal(true)}
              >
                Edit / Change Account
              </button>
            </div>

            <div className="row g-3">
              <div className="col-12 col-md-6">
                <div className="p-3 bg-light rounded-3 border">
                  <small className="text-muted fw-bold d-block mb-1">📱 UPI & Phone Number Transfer</small>
                  <div className="fw-bold text-dark">{upiPhone || user?.phone || 'Not configured'}</div>
                  <small className="text-primary">{upiId || 'No UPI ID saved'}</small>
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div className="p-3 bg-light rounded-3 border">
                  <small className="text-muted fw-bold d-block mb-1">🏦 Direct Bank Account</small>
                  <div className="fw-bold text-dark">{bankName || 'State Bank of India'}</div>
                  <small className="text-secondary">
                    Name: {bankAccountName || user?.name} • A/c: {bankAccountNumber ? `****${bankAccountNumber.slice(-4)}` : 'Not configured'} (IFSC: {bankIfscCode})
                  </small>
                </div>
              </div>
            </div>
          </div>

          {/* Withdrawal History Log Table */}
          <div className="card border-0 shadow-sm rounded-4 p-4 mt-4 bg-white">
            <h5 className="fw-bold text-dark mb-3">📋 Payout & Withdrawal History Log</h5>
            <div className="history-table-wrapper">
              <table className="completed-jobs-table">
                <thead>
                  <tr>
                    <th>Txn ID</th>
                    <th>Date & Time</th>
                    <th>Payout Method</th>
                    <th>Transfer Destination</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawalHistory.map((item) => (
                    <tr key={item.id}>
                      <td><strong>#{item.id}</strong></td>
                      <td>{item.date}</td>
                      <td><span className="badge bg-primary-subtle text-primary fw-bold px-2 py-1 rounded-pill">{item.method}</span></td>
                      <td>{item.destination}</td>
                      <td><strong className="text-success fs-6">₹{item.amount}</strong></td>
                      <td><span className="badge bg-success-subtle text-success fw-bold px-2 py-1 rounded-pill">{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Verification & Documents */}
      {activeTab === 'documents' && (
        <div className="hd-tab-content">
          <h2 className="section-title">🛡️ Partner Verification & Document Vault</h2>

          <div
            className="verification-status-banner"
            style={{
              background: user?.verificationStatus === 'Pending' ? '#fff7ed' : user?.verificationStatus === 'Rejected' ? '#fef2f2' : '#f0fdf4',
              borderColor: user?.verificationStatus === 'Pending' ? '#fde68a' : user?.verificationStatus === 'Rejected' ? '#fecaca' : '#bbf7d0',
            }}
          >
            {user?.verificationStatus === 'Pending' ? (
              <Clock size={28} color="#d97706" />
            ) : user?.verificationStatus === 'Rejected' ? (
              <XCircle size={28} color="#dc2626" />
            ) : (
              <ShieldCheck size={28} color="#059669" />
            )}
            <div>
              <h3 style={{ color: user?.verificationStatus === 'Pending' ? '#b45309' : user?.verificationStatus === 'Rejected' ? '#b91c1c' : '#15803d' }}>
                {user?.verificationStatus === 'Pending' ? 'VERIFICATION PENDING APPROVAL ⏳' : user?.verificationStatus === 'Rejected' ? 'VERIFICATION REJECTED ❌' : 'VERIFIED HANDYMAN PRO 🟢'}
              </h3>
              <p style={{ color: '#475569' }}>
                {user?.verificationStatus === 'Pending'
                  ? 'Your Mobile Number and ID proof documents are under review by SmartFix Admin. Verification usually takes less than 24 hours.'
                  : user?.verificationStatus === 'Rejected'
                  ? `Rejection reason: ${user?.rejectionReason || 'Please contact support or re-upload clear document proofs.'}`
                  : 'Your Mobile Number and Email are verified for instant customer dispatch.'}
              </p>
            </div>
          </div>

          <div className="doc-cards-grid">
            <div className="doc-card">
              <FileText size={24} color="#2563eb" />
              <div>
                <h4>Mobile Number</h4>
                <p>{user?.phone || 'Verified during signup'}</p>
                <span className="doc-badge verified">✓ Verified</span>
              </div>
            </div>

            <div className="doc-card">
              <FileText size={24} color="#2563eb" />
              <div>
                <h4>Email Address</h4>
                <p>{user?.email || 'Verified during signup'}</p>
                <span className="doc-badge verified">✓ Verified</span>
              </div>
            </div>

            <div className="doc-card">
              <FileText size={24} color="#2563eb" />
              <div>
                <h4>SmartFix Worker ID</h4>
                <p>{user?.workerId || user?._id?.slice(-6).toUpperCase() || 'SFX-9988'}</p>
                <span className="doc-badge verified">✓ Active</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BANK & UPI WITHDRAWAL MODAL */}
      {showWithdrawModal && (
        <div className="payment-modal-overlay" onClick={() => !withdrawSubmitting && setShowWithdrawModal(false)}>
          <div className="payment-modal-content" style={{ maxWidth: '540px', width: '92%', borderRadius: '24px', padding: '28px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header d-flex justify-content-between align-items-center mb-3">
              <h4 className="fw-extrabold text-dark mb-0 d-flex align-items-center gap-2">
                🏦 Handyman Instant Payout
              </h4>
              <button type="button" className="close-btn" onClick={() => setShowWithdrawModal(false)} disabled={withdrawSubmitting}>✕</button>
            </div>

            <form onSubmit={handleWithdrawSubmit}>
              {/* Payout Method Selector */}
              <div className="payout-type-tabs d-flex gap-2 mb-3">
                <button
                  type="button"
                  className={`btn flex-fill fw-bold rounded-3 py-2 ${payoutMethod === 'UPI' ? 'btn-primary shadow-xs' : 'btn-light border text-secondary'}`}
                  onClick={() => setPayoutMethod('UPI')}
                >
                  📱 Mobile Phone / UPI
                </button>
                <button
                  type="button"
                  className={`btn flex-fill fw-bold rounded-3 py-2 ${payoutMethod === 'BANK' ? 'btn-primary shadow-xs' : 'btn-light border text-secondary'}`}
                  onClick={() => setPayoutMethod('BANK')}
                >
                  🏦 Direct Bank Transfer
                </button>
              </div>

              {/* Amount Input */}
              <div className="form-group mb-3">
                <label className="fw-bold text-dark mb-1">Withdrawal Amount (₹)</label>
                <input
                  type="number"
                  className="form-control form-control-lg rounded-3 fw-bold"
                  placeholder={`Enter amount (Available: ₹${totalWorkerPayout})`}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  required
                />
                <div className="d-flex gap-2 mt-2">
                  {[500, 1000, 2000, totalWorkerPayout].map((val) => (
                    <button
                      type="button"
                      key={val}
                      className="btn btn-sm btn-outline-secondary rounded-pill fw-semibold"
                      onClick={() => setWithdrawAmount(val)}
                    >
                      ₹{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payout Method 1: Phone Number / UPI */}
              {payoutMethod === 'UPI' && (
                <div className="p-3 bg-light rounded-3 border mb-3">
                  <div className="form-group mb-3">
                    <label className="fw-bold text-dark mb-1">GPay / PhonePe / Paytm Mobile Number</label>
                    <input
                      type="tel"
                      className="form-control rounded-3"
                      placeholder="10-digit mobile number"
                      value={upiPhone}
                      onChange={(e) => setUpiPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group mb-0">
                    <label className="fw-bold text-dark mb-1">UPI VPA Address (Optional)</label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      placeholder="e.g. 9876543210@upi or name@okaxis"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Payout Method 2: Bank Account Transfer */}
              {payoutMethod === 'BANK' && (
                <div className="p-3 bg-light rounded-3 border mb-3">
                  <div className="form-group mb-2">
                    <label className="fw-bold text-dark mb-1">Select Bank Name</label>
                    <select
                      className="form-select rounded-3"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                    >
                      <option value="State Bank of India">State Bank of India (SBI)</option>
                      <option value="Indian Bank">Indian Bank</option>
                      <option value="Canara Bank">Canara Bank</option>
                      <option value="HDFC Bank">HDFC Bank</option>
                      <option value="ICICI Bank">ICICI Bank</option>
                      <option value="Axis Bank">Axis Bank</option>
                      <option value="Tamilnad Mercantile Bank">Tamilnad Mercantile Bank (TMB)</option>
                      <option value="Indian Overseas Bank">Indian Overseas Bank (IOB)</option>
                    </select>
                  </div>
                  <div className="form-group mb-2">
                    <label className="fw-bold text-dark mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      placeholder="Name as per Bank Passbook"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="row g-2">
                    <div className="col-12 col-md-7">
                      <div className="form-group mb-2">
                        <label className="fw-bold text-dark mb-1">Bank Account Number</label>
                        <input
                          type="text"
                          className="form-control rounded-3"
                          placeholder="9876 5432 1098"
                          value={bankAccountNumber}
                          onChange={(e) => setBankAccountNumber(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="col-12 col-md-5">
                      <div className="form-group mb-2">
                        <label className="fw-bold text-dark mb-1">IFSC Code</label>
                        <input
                          type="text"
                          className="form-control rounded-3 text-uppercase"
                          placeholder="SBIN0001234"
                          value={bankIfscCode}
                          onChange={(e) => setBankIfscCode(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="savePayoutCheck"
                  checked={savePayoutDetails}
                  onChange={(e) => setSavePayoutDetails(e.target.checked)}
                />
                <label className="form-check-label text-secondary small fw-semibold" htmlFor="savePayoutCheck">
                  Save these Payout Account details for future 1-click withdrawals
                </label>
              </div>

              <div className="d-flex flex-column flex-sm-row gap-2">
                <button
                  type="button"
                  className="btn btn-outline-primary fw-bold rounded-3 py-2 px-3 d-flex align-items-center justify-content-center gap-1"
                  onClick={handleSaveBankDetails}
                  disabled={withdrawSubmitting}
                >
                  💾 Save Bank Details Only
                </button>
                <button
                  type="submit"
                  className="btn btn-success btn-lg flex-fill fw-extrabold rounded-3 py-3 shadow-sm d-flex align-items-center justify-content-center gap-2"
                  disabled={withdrawSubmitting}
                >
                  {withdrawSubmitting ? (
                    <>Processing Instant Transfer...</>
                  ) : (
                    <>
                      <CheckCircle2 size={20} /> Submit Instant Payout (₹{withdrawAmount || totalWorkerPayout})
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Live AI Skill Verification Modal */}
      {showInterviewModal && (
        <SkillInterviewModal
          worker={user}
          category={user?.trade || 'Plumbing'}
          onClose={() => setShowInterviewModal(false)}
          onCompleted={() => {
            setToastMessage('✅ AI Skill Interview completed! Your responses have been submitted to Admin.');
            setTimeout(() => setToastMessage(''), 5000);
          }}
        />
      )}
      
      {disputeBooking && (
        <DisputeModal
          booking={disputeBooking}
          role="handyman"
          onClose={() => setDisputeBooking(null)}
        />
      )}

      {/* Real-time Incoming Dispatch Request Alert Modal */}
      {incomingDispatch && (
        <div className="payment-modal-overlay" style={{ zIndex: 9999 }}>
          <div
            className="payment-modal-content border-0 shadow-lg text-start"
            style={{
              maxWidth: '520px',
              width: '92%',
              borderRadius: '24px',
              padding: '28px',
              background: '#ffffff',
              borderTop: '6px solid #2563eb',
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-danger text-white pulse-icon px-3 py-2 fs-6 rounded-pill">
                  ⚡ NEW JOB REQUEST ({countdown}s)
                </span>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIncomingDispatch(null)}
              >
                ✕
              </button>
            </div>

            <div className="mb-3 p-3 rounded-4" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h4 className="fw-bold text-dark mb-1">
                    {incomingDispatch.trade || 'Home Service'} Repair
                  </h4>
                  <p className="text-muted small mb-1">
                    <MapPin size={14} className="text-primary me-1" />
                    <strong>{getLocationLabel(incomingDispatch)}</strong>
                  </p>
                  <p className="text-secondary small mb-0">
                    Customer: <strong>{incomingDispatch.customerName || incomingDispatch.customer?.name || 'Homeowner'}</strong>
                  </p>
                </div>
                <div className="text-end">
                  <span className="d-block text-muted small">Estimated Fare</span>
                  <span className="fs-4 fw-extrabold text-success">
                    ₹{incomingDispatch.price || 350}
                  </span>
                </div>
              </div>

              {incomingDispatch.notes && (
                <div className="mt-2 pt-2 border-top border-blue-200">
                  <small className="text-muted d-block fw-semibold">Problem Description:</small>
                  <p className="small mb-0 text-dark fst-italic">"{incomingDispatch.notes}"</p>
                </div>
              )}
            </div>

            <div className="d-flex align-items-center justify-content-between p-2 px-3 rounded-3 mb-3 bg-light text-muted small">
              <span>⏰ Auto-expires in: <strong className="text-danger">{countdown} seconds</strong></span>
              <span className="text-success fw-semibold">🎁 +5% Online Bonus Eligible</span>
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-success btn-lg flex-fill fw-bold rounded-3 shadow-sm d-flex align-items-center justify-content-center gap-2 py-3"
                style={{ background: '#059669', borderColor: '#059669' }}
                onClick={() => handleAcceptDispatch(incomingDispatch._id || incomingDispatch.id)}
              >
                <Check size={20} /> ACCEPT JOB NOW
              </button>
              <button
                type="button"
                className="btn btn-outline-danger btn-lg fw-bold rounded-3 px-3 d-flex align-items-center justify-content-center"
                onClick={() => handleDeclineDispatch(incomingDispatch._id || incomingDispatch.id)}
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
      

      {copilotBooking && (
        <WorkerAiCopilotModal
          booking={copilotBooking}
          onClose={() => setCopilotBooking(null)}
        />
      )}

    </div>
  );
};

export default HandymanDashboard;
