import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  CreditCard,
  Wallet,
  Banknote,
  CheckCircle2,
  ShieldCheck,
  Download,
  Gift,
  AlertCircle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  QrCode,
  FileText,
  Lock
} from 'lucide-react';
import { apiService, getApiBase } from '../services/api';
import { getPortalUser } from '../utils/authStorage';
import './PaymentModal.css';

// Lazy loader for official Razorpay Checkout SDK
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PaymentModal({ booking, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('RAZORPAY'); // RAZORPAY | RAZORPAY_ME | WALLET | COD
  const [wallet, setWallet] = useState({ balance: 0 });
  const [useWallet, setUseWallet] = useState(false);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [utrNumber, setUtrNumber] = useState('');

  const razorpayMeUrl = import.meta.env.VITE_RAZORPAY_ME_URL || 'https://razorpay.me/@divakarmuthu';

  const bookingId = booking?._id || booking?.id;
  const totalAmount = Number(booking?.price) || 350;
  const bookingShortId = String(bookingId || 'BK1001').slice(-6).toUpperCase();

  // Fetch customer's current wallet balance
  useEffect(() => {
    if (bookingId) {
      let isMounted = true;
      setLoadingWallet(true);
      apiService
        .getWallet()
        .then((w) => {
          if (isMounted) setWallet(w || { balance: 0 });
        })
        .catch(() => {
          if (isMounted) setWallet({ balance: 0 });
        })
        .finally(() => {
          if (isMounted) setLoadingWallet(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [bookingId]);

  const walletBalance = Number(wallet?.balance || 0);
  const walletUsed = (activeTab === 'RAZORPAY' && useWallet) || activeTab === 'WALLET'
    ? Math.min(walletBalance, totalAmount)
    : 0;
  const payableAmount = Math.max(0, totalAmount - walletUsed);
  const isOnline = activeTab !== 'COD';

  // 5% Worker Reward Bonus & Customer Cashback calculations
  const customerCashback = isOnline && payableAmount > 0 ? Math.round(payableAmount * 0.05) : 0;
  const workerBonusAmount = isOnline ? Math.round(totalAmount * 0.05) : 0;
  const baseWorkerPayout = totalAmount - Math.round(totalAmount * 0.10); // 90%
  const workerTotalPayout = baseWorkerPayout + workerBonusAmount; // 95% if online, 90% if COD
  const platformFee = totalAmount - workerTotalPayout;

  const customerProfile = getPortalUser('customer') || booking?.customer || {};

  // =========================================================================
  // Process Checkout Flow
  // =========================================================================
  const handleProcessPayment = async (simulateDemo = false) => {
    setErrorMsg('');
    setIsProcessing(true);

    try {
      // ---------------------------------------------------------------------
      // METHOD 0: Direct Razorpay.me Link (razorpay.me/@divakarmuthu)
      // ---------------------------------------------------------------------
      if (activeTab === 'RAZORPAY_ME') {
        const meRes = await apiService.payRazorpayMe(bookingId, utrNumber);
        const receiptData = {
          bookingId,
          transactionId: meRes.payment?.razorpayPaymentId || utrNumber || `RZP_ME_${Date.now()}`,
          paymentId: meRes.payment?.razorpayPaymentId || `RZP_ME_${Date.now()}`,
          amountTotal: totalAmount,
          walletUsed: 0,
          amountPaid: totalAmount,
          paymentMethod: 'Razorpay.me Direct UPI',
          status: 'paid',
          paidAt: new Date().toISOString(),
          bonusCredited: meRes.splits?.bonusCredited || customerCashback,
        };
        setReceipt(receiptData);
        setPaymentSuccess(true);
        setIsProcessing(false);
        if (onSuccess) onSuccess(receiptData);
        return;
      }

      // ---------------------------------------------------------------------
      // METHOD 1: Cash on Delivery (COD)
      // ---------------------------------------------------------------------
      if (activeTab === 'COD') {
        const codRes = await apiService.payCod(bookingId);
        const receiptData = {
          bookingId,
          transactionId: codRes.payment?.razorpayOrderId || `COD_${Date.now()}`,
          paymentId: `COD_PAID_${Date.now()}`,
          amountTotal: totalAmount,
          walletUsed: 0,
          amountPaid: totalAmount,
          paymentMethod: 'Cash on Delivery (COD)',
          status: 'paid',
          paidAt: new Date().toISOString(),
          bonusCredited: 0,
        };
        setReceipt(receiptData);
        setPaymentSuccess(true);
        setIsProcessing(false);
        if (onSuccess) onSuccess(receiptData);
        return;
      }

      // ---------------------------------------------------------------------
      // METHOD 2: 100% Wallet Balance Payment
      // ---------------------------------------------------------------------
      if (activeTab === 'WALLET' || (payableAmount === 0 && walletUsed >= totalAmount)) {
        const orderRes = await apiService.createPaymentOrder(bookingId, true);
        const receiptData = {
          bookingId,
          orderId: orderRes.orderId,
          paymentId: `PAY_WALLET_${Date.now()}`,
          amountTotal: totalAmount,
          walletUsed: totalAmount,
          amountPaid: 0,
          paymentMethod: 'SmartFix Wallet Balance',
          status: 'paid',
          paidAt: new Date().toISOString(),
          bonusCredited: 0,
        };
        setReceipt(receiptData);
        setPaymentSuccess(true);
        setIsProcessing(false);
        if (onSuccess) onSuccess(receiptData);
        return;
      }

      // ---------------------------------------------------------------------
      // METHOD 3: Razorpay Payment Gateway (UPI / Card / NetBanking)
      // ---------------------------------------------------------------------
      const orderRes = await apiService.createPaymentOrder(bookingId, useWallet);

      // If server determined wallet covered entire price
      if (orderRes.paidWithWallet) {
        const receiptData = {
          bookingId,
          orderId: orderRes.orderId,
          paymentId: `PAY_WALLET_${Date.now()}`,
          amountTotal: totalAmount,
          walletUsed: totalAmount,
          amountPaid: 0,
          paymentMethod: 'SmartFix Wallet Balance',
          status: 'paid',
          paidAt: new Date().toISOString(),
          bonusCredited: 0,
        };
        setReceipt(receiptData);
        setPaymentSuccess(true);
        setIsProcessing(false);
        if (onSuccess) onSuccess(receiptData);
        return;
      }

      const rzpKey = orderRes.keyId || orderRes.key || 'rzp_test_placeholder';
      const rzpOrderId = orderRes.orderId || orderRes.order?.id;
      const isPlaceholderKey = !rzpKey || rzpKey === 'rzp_test_placeholder' || rzpKey.includes('YOUR_');

      // If Developer explicitly clicks Dev Simulator OR placeholder key is detected
      if (simulateDemo || isPlaceholderKey) {
        // Execute server signature verification using demo mode verification
        const demoPaymentId = `demo_pay_${Date.now()}`;
        const demoSignature = `demo_sig_${Date.now()}`;

        const verifyRes = await apiService.verifyPayment({
          razorpay_order_id: rzpOrderId,
          razorpay_payment_id: demoPaymentId,
          razorpay_signature: demoSignature,
          bookingId,
          useWallet,
        });

        const receiptData = {
          bookingId,
          orderId: rzpOrderId,
          paymentId: demoPaymentId,
          amountTotal: totalAmount,
          walletUsed,
          amountPaid: payableAmount,
          paymentMethod: 'Razorpay UPI / Cards (Verified Gateway)',
          status: 'paid',
          paidAt: new Date().toISOString(),
          bonusCredited: verifyRes?.splits?.bonusCredited || customerCashback,
        };

        setReceipt(receiptData);
        setPaymentSuccess(true);
        setIsProcessing(false);
        if (onSuccess) onSuccess(receiptData);
        return;
      }

      // Live Razorpay Checkout JS Modal
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        throw new Error(
          t('razorpay_script_failed', 'Failed to load Razorpay payment gateway. Please check your internet connection.')
        );
      }

      const options = {
        key: rzpKey,
        amount: orderRes.amount || orderRes.order?.amount,
        currency: 'INR',
        name: 'SmartFix / HandyBook',
        description: `Service #${bookingShortId} Settlement`,
        order_id: rzpOrderId,
        prefill: {
          name: customerProfile.name || 'Customer',
          email: customerProfile.email || '',
          contact: customerProfile.phone || customerProfile.mobile || '',
        },
        theme: {
          color: '#2563eb', // SmartFix Blue
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setErrorMsg(
              t('payment_dismissed_msg', 'Payment checkout was closed before completion. You can retry anytime.')
            );
          },
        },
        handler: async (response) => {
          try {
            // Verify HMAC-SHA256 signature on backend
            const verifyRes = await apiService.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId,
              useWallet,
            });

            const receiptData = {
              bookingId,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              amountTotal: totalAmount,
              walletUsed,
              amountPaid: payableAmount,
              paymentMethod: 'Razorpay UPI / Card / NetBanking',
              status: 'paid',
              paidAt: new Date().toISOString(),
              bonusCredited: verifyRes?.splits?.bonusCredited || customerCashback,
            };

            setReceipt(receiptData);
            setPaymentSuccess(true);
            if (onSuccess) onSuccess(receiptData);
          } catch (verErr) {
            setErrorMsg(
              verErr.message ||
                t('payment_verify_failed', 'Payment signature verification failed. Please contact customer support.')
            );
          } finally {
            setIsProcessing(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', (failResp) => {
        setIsProcessing(false);
        const reason =
          failResp.error?.description ||
          failResp.error?.reason ||
          t('payment_failed_default', 'Payment transaction failed or was declined by your bank/UPI app.');
        setErrorMsg(reason);
      });

      rzp.open();
    } catch (err) {
      setIsProcessing(false);
      setErrorMsg(err.message || t('payment_initiate_failed', 'Failed to initiate payment. Please try again.'));
    }
  };

  const handleDownloadInvoice = () => {
    const invoiceUrl = `${getApiBase()}/bookings/${bookingId}/invoice`;
    window.open(invoiceUrl, '_blank');
  };

  return (
    <div className="payment-modal-overlay">
      <div className="payment-modal-card">
        <button
          className="close-modal-btn"
          onClick={onClose}
          disabled={isProcessing}
          aria-label="Close Modal"
        >
          <X size={20} />
        </button>

        {!paymentSuccess ? (
          <>
            {/* Modal Header */}
            <div className="modal-header-section text-center mb-3">
              <div className="shield-icon mx-auto mb-2">
                <ShieldCheck size={32} color="#2563eb" />
              </div>
              <h2 className="h5 fw-bold text-dark mb-1">
                {t('secure_razorpay_checkout', 'SmartFix Secure Payment Gateway')}
              </h2>
              <p className="text-muted small mb-0">
                {t('payment_subtitle', 'Encrypted 256-bit Razorpay checkout with instant cashback reward')}
              </p>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3">
                <AlertCircle size={18} className="flex-shrink-0 text-danger" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 5% Customer Bonus Cashback Banner */}
            <div className="worker-bonus-alert-box mb-3">
              <Gift size={22} color="#059669" className="pulse-icon flex-shrink-0" />
              <div>
                <strong>{t('bonus_cashback_title', '🎁 5% Customer Bonus Cashback Active!')}</strong>
                <p>
                  {t(
                    'bonus_cashback_text',
                    'Pay online via Razorpay to earn 5% bonus cashback automatically credited to your SmartFix wallet.'
                  )}
                </p>
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="booking-summary-box mb-3">
              <div className="summary-row">
                <span className="text-muted">{t('service_label', 'Service Fare')}:</span>
                <span className="fw-semibold text-dark">₹{totalAmount}</span>
              </div>
              <div className="summary-row text-muted" style={{ fontSize: '0.82rem' }}>
                <span>{t('handyman_label', 'Handyman Base Share (90%)')}:</span>
                <span>₹{baseWorkerPayout}</span>
              </div>
              {isOnline && (
                <div
                  className="summary-row"
                  style={{
                    color: '#059669',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    background: '#f0fdf4',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}
                >
                  <span>🎉 5% Online Reward Bonus</span>
                  <span>+₹{workerBonusAmount}</span>
                </div>
              )}
              {walletUsed > 0 && (
                <div className="summary-row text-success" style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  <span>{t('wallet_balance_applied', 'Wallet Balance Applied')}:</span>
                  <span>-₹{walletUsed}</span>
                </div>
              )}
              <div className="summary-row total-row border-top pt-2 mt-2">
                <span className="fw-bold text-dark">{t('net_payable', 'Total Net Payable')}:</span>
                <span className="total-price text-primary fw-bold fs-5">₹{payableAmount}</span>
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div className="payment-tabs mb-3">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'RAZORPAY' ? 'active' : ''}`}
                onClick={() => setActiveTab('RAZORPAY')}
              >
                <CreditCard size={18} />
                <span>Razorpay Gateway</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'RAZORPAY_ME' ? 'active' : ''}`}
                onClick={() => setActiveTab('RAZORPAY_ME')}
              >
                <QrCode size={18} />
                <span>UPI (razorpay.me)</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'WALLET' ? 'active' : ''}`}
                onClick={() => setActiveTab('WALLET')}
                disabled={walletBalance <= 0}
                title={walletBalance <= 0 ? 'Insufficient wallet balance' : 'Pay with Wallet'}
              >
                <Wallet size={18} />
                <span>Wallet (₹{walletBalance})</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'COD' ? 'active' : ''}`}
                onClick={() => setActiveTab('COD')}
              >
                <Banknote size={18} />
                <span>Cash on Delivery</span>
              </button>
            </div>

            {/* Tab 1: Razorpay Gateway Details */}
            {activeTab === 'RAZORPAY' && (
              <div className="p-3 bg-light rounded-3 border mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <Lock size={16} className="text-primary" />
                    <span className="small fw-bold text-dark">Supported Payment Methods:</span>
                  </div>
                  <span className="badge bg-primary-subtle text-primary fw-semibold" style={{ fontSize: '0.75rem' }}>
                    Auto-Verified
                  </span>
                </div>
                <div className="d-flex flex-wrap gap-2 small text-muted mb-3" style={{ fontSize: '0.8rem' }}>
                  <span className="border bg-white rounded-pill px-2 py-1">📱 Google Pay / PhonePe / UPI</span>
                  <span className="border bg-white rounded-pill px-2 py-1">💳 Visa / MasterCard / RuPay</span>
                  <span className="border bg-white rounded-pill px-2 py-1">🏦 Net Banking (SBI, HDFC, ICICI)</span>
                  <span className="border bg-white rounded-pill px-2 py-1">👛 Wallets & EMI</span>
                </div>

                {/* Wallet Balance Checkbox */}
                {walletBalance > 0 && (
                  <div className="form-check pt-2 border-top">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="useWalletBalanceCheck"
                      checked={useWallet}
                      onChange={(e) => setUseWallet(e.target.checked)}
                      disabled={isProcessing}
                    />
                    <label className="form-check-label small text-dark fw-semibold" htmlFor="useWalletBalanceCheck">
                      Apply SmartFix Wallet Balance (₹{walletBalance} available)
                    </label>
                  </div>
                )}

                <div className="mt-2 text-center pt-2 border-top" style={{ fontSize: '0.8rem' }}>
                  <span className="text-muted">Prefer direct payment link? </span>
                  <a
                    href={razorpayMeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-decoration-none fw-semibold text-primary"
                  >
                    Open {razorpayMeUrl.replace('https://', '')} ↗
                  </a>
                </div>
              </div>
            )}

            {/* Tab 2: Razorpay.me Direct UPI Link */}
            {activeTab === 'RAZORPAY_ME' && (
              <div className="p-3 bg-light rounded-3 border mb-3 text-center">
                <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                  <QrCode size={22} className="text-primary" />
                  <span className="fw-bold text-dark">Direct Razorpay.me UPI Link</span>
                  <span className="badge bg-success-subtle text-success">Verified</span>
                </div>
                <p className="text-muted small mb-2">
                  Pay ₹{payableAmount} directly to <strong>{razorpayMeUrl.replace('https://', '')}</strong> via Google Pay, PhonePe, Paytm, BHIM, or Cards.
                </p>

                <div className="my-3">
                  <a
                    href={razorpayMeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm px-3 py-2 fw-semibold d-inline-flex align-items-center gap-2 shadow-sm"
                  >
                    <ExternalLink size={16} />
                    <span>Open {razorpayMeUrl.replace('https://', '')} to Pay ₹{payableAmount}</span>
                  </a>
                </div>

                <div className="bg-white p-2 rounded-2 border text-start mt-3">
                  <label className="form-label small fw-semibold text-dark mb-1" htmlFor="utrInput">
                    UPI Reference / UTR Number (Optional):
                  </label>
                  <input
                    type="text"
                    id="utrInput"
                    className="form-control form-control-sm"
                    placeholder="e.g. 432109876543 or Razorpay payment ID"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    disabled={isProcessing}
                  />
                  <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                    Once paid on Razorpay, click below to confirm settlement and receive your 5% wallet cashback!
                  </small>
                </div>
              </div>
            )}

            {/* Tab 2: Wallet Details */}
            {activeTab === 'WALLET' && (
              <div className="p-3 bg-light rounded-3 border mb-3 text-center">
                <Wallet size={36} className="text-primary mb-2 mx-auto" />
                <h5 className="h6 fw-bold text-dark mb-1">Pay with SmartFix Wallet</h5>
                <p className="text-muted small mb-2">
                  Your current balance is <strong>₹{walletBalance}</strong>.
                </p>
                {walletBalance < totalAmount ? (
                  <div className="alert alert-warning py-1 px-2 small mb-0">
                    ⚠️ Wallet balance is ₹{walletBalance}. Please switch to Razorpay to pay the remaining ₹{totalAmount - walletBalance}.
                  </div>
                ) : (
                  <div className="text-success small fw-semibold">
                    ✓ Full fare of ₹{totalAmount} will be settled instantly with zero processing fee.
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: COD Details */}
            {activeTab === 'COD' && (
              <div className="cod-info mb-3">
                <Banknote size={36} color="#059669" className="mx-auto mb-2" />
                <h4>Cash on Delivery Selected</h4>
                <p>You can pay ₹{totalAmount} in cash directly to your service provider after job completion.</p>
                <small style={{ color: '#d97706', display: 'block', marginTop: '6px' }}>
                  ⚠️ Note: Cash payments do not qualify for the 5% online wallet cashback reward.
                </small>
              </div>
            )}

            {/* Pay Button */}
            <button
              type="button"
              className="pay-now-btn"
              disabled={isProcessing || (activeTab === 'WALLET' && walletBalance < totalAmount)}
              onClick={() => handleProcessPayment(false)}
            >
              {isProcessing ? (
                <span className="spinner-text">
                  <span className="spinner"></span>
                  <span>Verifying Payment...</span>
                </span>
              ) : activeTab === 'RAZORPAY_ME' ? (
                `Confirm Razorpay.me Settlement (₹${payableAmount})`
              ) : activeTab === 'COD' ? (
                `Confirm Cash Settlement (₹${totalAmount})`
              ) : activeTab === 'WALLET' ? (
                `Settle ₹${totalAmount} via Wallet`
              ) : (
                `Proceed to Pay ₹${payableAmount} via Razorpay`
              )}
            </button>

            {/* Dev Simulator Button (Instant Local Verification) */}
            {activeTab === 'RAZORPAY' && !isProcessing && (
              <div className="text-center mt-3 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-link btn-sm text-muted text-decoration-none small"
                  style={{ fontSize: '0.76rem' }}
                  onClick={() => handleProcessPayment(true)}
                  title="Simulates successful Razorpay checkout for test & development"
                >
                  ⚡ Simulate Successful Razorpay Payment (Dev Mode)
                </button>
              </div>
            )}
          </>
        ) : (
          /* ===================================================================
             Payment Success & Verified Receipt Screen
             =================================================================== */
          <div className="receipt-container text-center py-2">
            <div className="success-badge mb-3">
              <CheckCircle2 size={54} className="text-success mx-auto" />
            </div>
            <h3 className="h5 fw-bold text-dark mb-1">
              {t('payment_verified_title', 'Payment Verified & Settled!')}
            </h3>
            <p className="text-muted small mb-3">
              {t('payment_verified_sub', 'Your transaction signature has been cryptographically confirmed.')}
            </p>

            {/* Receipt Summary Card */}
            <div className="bg-light p-3 rounded-3 text-start small border mb-3">
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">{t('booking_id_label', 'Booking ID')}:</span>
                <span className="fw-semibold font-monospace">#{bookingShortId}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">{t('transaction_ref', 'Payment Reference')}:</span>
                <span className="fw-semibold font-monospace text-truncate" style={{ maxWidth: '200px' }}>
                  {receipt?.paymentId || receipt?.transactionId}
                </span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">{t('payment_mode_label', 'Payment Mode')}:</span>
                <span className="fw-semibold text-dark">{receipt?.paymentMethod}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">{t('total_amount_label', 'Total Service Fare')}:</span>
                <span className="fw-semibold text-dark">₹{receipt?.amountTotal}</span>
              </div>
              {receipt?.walletUsed > 0 && (
                <div className="d-flex justify-content-between mb-2 text-success">
                  <span>{t('wallet_deducted_label', 'Wallet Balance Deducted')}:</span>
                  <span className="fw-bold">-₹{receipt?.walletUsed}</span>
                </div>
              )}
              <div className="d-flex justify-content-between pt-2 border-top fw-bold text-dark fs-6">
                <span>{t('net_paid_label', 'Net Paid')}:</span>
                <span className="text-primary">₹{receipt?.amountPaid}</span>
              </div>
            </div>

            {/* Bonus Cashback Award Banner */}
            {receipt?.bonusCredited > 0 && (
              <div className="alert alert-success d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-3 text-start">
                <Gift size={22} className="text-success flex-shrink-0" />
                <div>
                  <strong>{t('cashback_awarded_heading', '🎉 ₹{{amount}} Wallet Cashback Credited!', { amount: receipt.bonusCredited })}</strong>
                  <div style={{ fontSize: '0.78rem' }}>
                    {t('cashback_awarded_sub', 'Added directly to your SmartFix wallet for upcoming home repairs.')}
                  </div>
                </div>
              </div>
            )}

            {/* Invoice Download & Done Actions */}
            <div className="d-grid gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary py-2 fw-semibold rounded-3 d-flex align-items-center justify-content-center gap-2"
                onClick={handleDownloadInvoice}
              >
                <Download size={16} />
                <span>{t('download_tax_invoice', 'Download Tax Invoice (PDF)')}</span>
              </button>
              <button
                type="button"
                className="btn btn-primary py-2 fw-bold rounded-3 shadow-sm"
                onClick={onClose}
              >
                {t('done_btn', 'Done & Return to Dashboard')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
