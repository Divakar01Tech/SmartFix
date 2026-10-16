import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreditCard,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Gift,
  ArrowRight,
  Star,
  Receipt,
  X,
  FileText
} from 'lucide-react';
import { apiService } from '../services/api';
import { getPortalUser } from '../utils/authStorage';

// Lazy script loader for Razorpay Checkout
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

export default function PayButton({
  booking,
  onSuccess,
  onRefresh,
  buttonText,
  buttonClassName = 'btn btn-primary fw-bold px-4 py-2 rounded-3 shadow-sm d-inline-flex align-items-center gap-2',
  autoOpen = false,
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [useWallet, setUseWallet] = useState(false);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);

  const bookingId = booking?._id || booking?.id;
  const price = Number(booking?.price || 0);

  // Fetch customer's current wallet balance when modal opens
  useEffect(() => {
    if (isOpen && bookingId) {
      let isMounted = true;
      setLoadingWallet(true);
      setErrorMsg('');
      apiService
        .getWallet()
        .then((w) => {
          if (isMounted) {
            setWallet(w || { balance: 0 });
          }
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
  }, [isOpen, bookingId]);

  const walletBalance = Number(wallet?.balance || 0);
  const walletUsed = useWallet ? Math.min(walletBalance, price) : 0;
  const amountToPay = Math.max(0, price - walletUsed);
  const estimatedBonus = amountToPay > 0 ? Math.round(amountToPay * 0.05) : 0;

  // Retrieve current customer contact details for Razorpay prefill
  const customerProfile = getPortalUser('customer') || booking?.customer || {};

  const handleInitiatePayment = async () => {
    setErrorMsg('');
    setPaying(true);

    try {
      // 1. Request server-calculated order
      const orderRes = await apiService.createPaymentOrder(bookingId, useWallet);

      // Scenario A: 100% covered by wallet balance (Direct Settlement)
      if (orderRes.paidWithWallet) {
        const receiptData = {
          bookingId,
          orderId: orderRes.orderId,
          paymentId: `PAY_WALLET_${Date.now()}`,
          amountTotal: price,
          walletUsed: price,
          amountPaid: 0,
          paymentMethod: 'Wallet Balance',
          status: 'paid',
          paidAt: new Date().toISOString(),
          bonusCredited: 0,
        };

        setReceipt(receiptData);
        setShowReviewPrompt(true);
        setPaying(false);
        if (onSuccess) onSuccess(receiptData);
        if (onRefresh) onRefresh();
        return;
      }

      // Scenario B: Online Payment via Razorpay Checkout
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        throw new Error(
          t('razorpay_script_failed', 'Failed to load Razorpay payment gateway. Please check your internet connection.')
        );
      }

      const rzpKey = orderRes.keyId || orderRes.key || 'rzp_test_placeholder';
      const rzpOrderId = orderRes.orderId || orderRes.order?.id;
      const rzpAmount = orderRes.amount || orderRes.order?.amount;

      const options = {
        key: rzpKey,
        amount: rzpAmount,
        currency: 'INR',
        name: 'SmartFix / HandyBook',
        description: `${booking?.trade || 'Service'} #${String(bookingId).slice(-6)}`,
        order_id: rzpOrderId,
        prefill: {
          name: customerProfile.name || 'Customer',
          email: customerProfile.email || '',
          contact: customerProfile.phone || customerProfile.mobile || '',
        },
        theme: {
          color: '#2563eb', // SmartFix Brand Blue
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
            setErrorMsg(
              t(
                'payment_dismissed_msg',
                'Payment window was closed before completion. You can retry whenever you are ready.'
              )
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
              amountTotal: price,
              walletUsed,
              amountPaid: amountToPay,
              paymentMethod: 'Razorpay UPI / Card / NetBanking',
              status: 'paid',
              paidAt: new Date().toISOString(),
              bonusCredited: verifyRes?.splits?.bonusCredited || estimatedBonus,
            };

            setReceipt(receiptData);
            setShowReviewPrompt(true);
            if (onSuccess) onSuccess(receiptData);
            if (onRefresh) onRefresh();
          } catch (verErr) {
            setErrorMsg(
              verErr.message ||
                t('payment_verify_failed', 'Payment verification failed. Please contact customer support.')
            );
          } finally {
            setPaying(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', (failResp) => {
        setPaying(false);
        const reason =
          failResp.error?.description ||
          failResp.error?.reason ||
          t('payment_failed_default', 'Payment transaction failed or was declined by your bank/UPI app.');
        setErrorMsg(reason);
      });

      rzp.open();
    } catch (err) {
      setPaying(false);
      setErrorMsg(err.message || t('payment_initiate_failed', 'Failed to initiate payment. Please try again.'));
    }
  };

  const closeModal = () => {
    if (paying) return;
    setIsOpen(false);
    setErrorMsg('');
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        className={buttonClassName}
        onClick={() => setIsOpen(true)}
      >
        <CreditCard size={18} />
        <span>{buttonText || t('pay_now_btn', `Pay ₹${price}`)}</span>
      </button>

      {/* Payment & Checkout Modal */}
      {isOpen && (
        <div
          className="modal show d-block fade"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '480px' }}>
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              {/* Modal Header */}
              <div className="modal-header border-bottom py-3 px-4 bg-light d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-primary-subtle text-primary rounded-3">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-dark fs-6 mb-0">
                      {receipt
                        ? t('payment_receipt_title', 'Payment Receipt')
                        : t('secure_payment_header', 'SmartFix Secure Checkout')}
                    </h5>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {t('ssl_encrypted_badge', '🔒 256-Bit SSL Encrypted Razorpay Gateway')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={closeModal}
                  disabled={paying}
                />
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4">
                {/* 1. Payment Success / Receipt Screen */}
                {receipt ? (
                  <div className="text-center py-2">
                    <div className="mb-3">
                      <div
                        className="rounded-circle bg-success-subtle text-success d-inline-flex align-items-center justify-content-center p-3 shadow-sm animate__animated animate__zoomIn"
                        style={{ width: '64px', height: '64px' }}
                      >
                        <CheckCircle2 size={36} />
                      </div>
                    </div>
                    <h4 className="fw-bold text-dark mb-1">
                      {t('payment_successful_title', 'Payment Successful!')}
                    </h4>
                    <p className="text-muted small mb-3">
                      {t(
                        'payment_successful_sub',
                        'Your payment has been verified. The booking is now marked Paid.'
                      )}
                    </p>

                    {/* Receipt Breakdown Card */}
                    <div className="bg-light p-3 rounded-3 text-start small border mb-3">
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">{t('booking_id_label', 'Booking ID')}</span>
                        <span className="fw-semibold font-monospace">#{String(receipt.bookingId).slice(-8)}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">{t('payment_id_label', 'Payment ID')}</span>
                        <span className="fw-semibold font-monospace">{receipt.paymentId}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">{t('payment_method_label', 'Payment Mode')}</span>
                        <span className="fw-semibold text-dark">{receipt.paymentMethod}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">{t('total_amount_label', 'Total Service Fare')}</span>
                        <span className="fw-semibold text-dark">₹{receipt.amountTotal}</span>
                      </div>
                      {receipt.walletUsed > 0 && (
                        <div className="d-flex justify-content-between mb-2 text-success">
                          <span>{t('wallet_deducted_label', 'Wallet Balance Applied')}</span>
                          <span className="fw-bold">-₹{receipt.walletUsed}</span>
                        </div>
                      )}
                      <div className="d-flex justify-content-between pt-2 border-top fw-bold text-dark fs-6">
                        <span>{t('amount_paid_label', 'Amount Paid via Razorpay')}</span>
                        <span className="text-primary">₹{receipt.amountPaid}</span>
                      </div>
                    </div>

                    {/* Bonus Cashback Credited Badge */}
                    {receipt.bonusCredited > 0 && (
                      <div className="alert alert-success d-flex align-items-center gap-2 py-2 px-3 small rounded-3 mb-3 text-start">
                        <Gift size={20} className="text-success flex-shrink-0" />
                        <div>
                          <strong>{t('cashback_credited_title', '🎉 Cashback Bonus Credited!')}</strong>
                          <div style={{ fontSize: '0.8rem' }}>
                            {t(
                              'cashback_credited_desc',
                              '₹{{amount}} has been credited directly to your SmartFix wallet for future bookings.',
                              { amount: receipt.bonusCredited }
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Next Steps: Review & Close */}
                    <div className="d-grid gap-2">
                      {showReviewPrompt && (
                        <button
                          type="button"
                          className="btn btn-warning fw-bold py-2 rounded-3 d-flex align-items-center justify-content-center gap-2 text-dark shadow-sm"
                          onClick={() => {
                            closeModal();
                            if (window.location.pathname !== `/booking/${bookingId}/status`) {
                              window.location.href = `/booking/${bookingId}/status`;
                            }
                          }}
                        >
                          <Star size={18} />
                          <span>{t('rate_technician_btn', 'Rate & Review Technician')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm py-2 rounded-3"
                        onClick={closeModal}
                      >
                        {t('done_btn', 'Done')}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 2. Checkout Calculation & Payment Controls */
                  <div>
                    {/* Error Banner with Retry */}
                    {errorMsg && (
                      <div className="alert alert-danger py-2 px-3 small rounded-3 mb-3 d-flex align-items-start gap-2">
                        <AlertCircle size={18} className="text-danger flex-shrink-0 mt-1" />
                        <div className="flex-grow-1">
                          <div className="fw-semibold">{t('payment_error_title', 'Payment Incomplete')}</div>
                          <div className="text-break">{errorMsg}</div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-danger p-0 ms-1"
                          onClick={handleInitiatePayment}
                          title={t('retry_btn', 'Retry')}
                        >
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    )}

                    {/* Service Summary Row */}
                    <div className="p-3 bg-light rounded-3 border mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <span className="text-muted small">{t('service_label', 'Service Requested')}</span>
                        <span className="fw-bold text-dark">{booking?.trade || 'Home Service'}</span>
                      </div>
                      <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted small">{t('booking_price_label', 'Agreed Price')}</span>
                        <span className="fw-bold text-dark fs-5">₹{price}</span>
                      </div>
                    </div>

                    {/* Use Wallet Balance Toggle Section */}
                    <div className="p-3 rounded-3 border mb-3 bg-white">
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <Wallet size={20} className={walletBalance > 0 ? 'text-success' : 'text-muted'} />
                          <div>
                            <div className="fw-semibold text-dark small">
                              {t('use_wallet_toggle', 'Use Wallet Balance')}
                            </div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                              {loadingWallet ? (
                                <span className="spinner-border spinner-border-sm me-1" />
                              ) : null}
                              {t('wallet_available_label', 'Available')}:{' '}
                              <strong className="text-success">₹{walletBalance}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Toggle Checkbox Switch */}
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="useWalletSwitch"
                            checked={useWallet}
                            disabled={walletBalance <= 0 || paying}
                            onChange={(e) => setUseWallet(e.target.checked)}
                            style={{ cursor: walletBalance > 0 ? 'pointer' : 'not-allowed', width: '2.5em', height: '1.3em' }}
                          />
                        </div>
                      </div>

                      {/* Live Wallet Deduction Notice */}
                      {useWallet && walletUsed > 0 && (
                        <div className="mt-2 pt-2 border-top d-flex justify-content-between align-items-center small text-success">
                          <span>{t('wallet_deduction_applied', 'Wallet Balance Applied:')}</span>
                          <span className="fw-bold">-₹{walletUsed}</span>
                        </div>
                      )}
                    </div>

                    {/* Breakdown Summary Box */}
                    <div className="bg-light p-3 rounded-3 border mb-3 small">
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">{t('service_fare', 'Price')}</span>
                        <span className="fw-semibold">₹{price}</span>
                      </div>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">{t('wallet_used_label', 'Wallet used')}</span>
                        <span className={walletUsed > 0 ? 'fw-bold text-success' : 'text-muted'}>
                          {walletUsed > 0 ? `-₹${walletUsed}` : '₹0'}
                        </span>
                      </div>
                      <div className="d-flex justify-content-between pt-2 border-top fw-bold fs-6">
                        <span className="text-dark">{t('you_pay_label', 'You Pay')}</span>
                        <span className="text-primary fs-5">₹{amountToPay}</span>
                      </div>
                    </div>

                    {/* Customer 5% Reward Notice Banner */}
                    {amountToPay > 0 && (
                      <div className="d-flex align-items-center gap-2 p-2 bg-success-subtle text-success-emphasis rounded-3 small mb-3">
                        <Gift size={18} className="flex-shrink-0 text-success" />
                        <span style={{ fontSize: '0.8rem' }}>
                          {t(
                            'online_cashback_prompt',
                            'Pay online via Razorpay to earn ₹{{cashback}} cashback directly into your SmartFix wallet!',
                            { cashback: estimatedBonus }
                          )}
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="d-grid gap-2">
                      <button
                        type="button"
                        className="btn btn-primary py-2 px-3 fw-bold rounded-3 shadow-sm d-flex align-items-center justify-content-center gap-2"
                        onClick={handleInitiatePayment}
                        disabled={paying || price <= 0}
                      >
                        {paying ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" />
                            <span>{t('processing_payment', 'Processing...')}</span>
                          </>
                        ) : amountToPay === 0 ? (
                          <>
                            <CheckCircle2 size={18} />
                            <span>{t('pay_wallet_full_btn', `Pay ₹0 via Wallet Balance`)}</span>
                          </>
                        ) : (
                          <>
                            <CreditCard size={18} />
                            <span>{t('pay_razorpay_btn', `Pay ₹${amountToPay} via Razorpay`)}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm rounded-3 py-2"
                        onClick={closeModal}
                        disabled={paying}
                      >
                        {t('cancel_btn', 'Cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
