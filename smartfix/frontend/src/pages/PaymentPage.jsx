import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { ShieldCheck, CreditCard, Wallet, CheckCircle2, AlertCircle, ArrowLeft, Gift, Sparkles, Receipt, Download } from 'lucide-react';

export default function PaymentPage() {
  const { t } = useTranslation();
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [useWallet, setUseWallet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Load Razorpay SDK Script dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const [bData, wData] = await Promise.all([
          apiService.getBooking(bookingId),
          apiService.getWallet().catch(() => ({ balance: 0 })),
        ]);
        setBooking(bData);
        setWallet(wData || { balance: 0 });
        if (bData?.status === 'paid' || bData?.status === 'reviewed') {
          setPaymentSuccess(true);
        }
      } catch (err) {
        setErrorMsg(err.message || 'Failed to load booking payment details');
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) {
      fetchData();
    }
  }, [bookingId]);

  const totalAmount = Number(booking?.price) || 350;
  const walletBal = Number(wallet?.balance) || 0;
  const appliedWalletAmount = useWallet ? Math.min(walletBal, totalAmount) : 0;
  const payableAmount = Math.max(0, totalAmount - appliedWalletAmount);

  const handleCheckout = async () => {
    setErrorMsg('');
    setPaying(true);

    try {
      // 1. Create order on server side (amount strictly calculated server side)
      const orderRes = await apiService.createPaymentOrder(bookingId, useWallet);

      // If covered 100% by wallet
      if (orderRes.paidWithWallet) {
        setPaymentSuccess(true);
        setReceiptData({
          method: 'SmartFix Wallet',
          transactionId: `WALLET_${Date.now()}`,
          amount: totalAmount,
          bonusCashback: orderRes.customerBonusCredited || Math.round(totalAmount * 0.05),
        });
        setPaying(false);
        return;
      }

      // If Razorpay online gateway is needed
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      const options = {
        key: orderRes.key || 'rzp_test_placeholder',
        amount: orderRes.order?.amount,
        currency: orderRes.order?.currency || 'INR',
        name: 'SmartFix / HandyBook',
        description: `Payment for Booking #${bookingId.slice(-6)}`,
        order_id: orderRes.order?.id,
        handler: async (response) => {
          try {
            // Verify HMAC signature on backend
            const verifyPayload = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              bookingId,
              useWallet,
            };

            const verification = await apiService.verifyPayment(verifyPayload);

            setPaymentSuccess(true);
            setReceiptData({
              method: 'Razorpay UPI / Cards',
              transactionId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              amount: totalAmount,
              walletDeducted: appliedWalletAmount,
              bonusCashback: verification.customerBonusCredited || Math.round(totalAmount * 0.05),
            });
          } catch (verErr) {
            setErrorMsg(verErr.message || 'Signature verification failed. Please contact support.');
          } finally {
            setPaying(false);
          }
        },
        prefill: {
          name: booking?.customer?.name || 'Customer',
          email: booking?.customer?.email || '',
        },
        theme: {
          color: '#2563eb',
        },
        modal: {
          ondismiss: () => {
            setPaying(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setErrorMsg(resp.error?.description || 'Payment transaction failed');
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initiate payment');
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center min-vh-50 d-flex flex-column justify-content-center align-items-center">
        <div className="spinner-border text-primary mb-3" role="status" />
        <p className="text-muted">{t('loading_payment_info', 'Loading secure payment details...')}</p>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: '640px', minHeight: '80vh' }}>
      <div className="mb-4">
        <Link to={`/booking/${bookingId}/status`} className="text-decoration-none text-muted small d-inline-flex align-items-center gap-1 mb-2">
          <ArrowLeft size={16} />
          <span>{t('back_to_booking_status', 'Back to Booking Status')}</span>
        </Link>
        <h1 className="h3 fw-bold text-dark mb-1">
          {t('secure_checkout', 'Secure Razorpay Checkout')}
        </h1>
        <p className="text-muted small mb-0">
          {t('step7_desc', 'Step 7 of 8: Complete settlement & earn instant customer cashback')}
        </p>
      </div>

      {errorMsg && (
        <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-4">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Receipt State */}
      {paymentSuccess ? (
        <div className="card border-0 shadow-sm rounded-4 p-4 text-center bg-white border">
          <div className="mb-3">
            <CheckCircle2 size={54} className="text-success mx-auto" />
          </div>
          <h2 className="h4 fw-bold text-dark mb-1">{t('payment_verified_title', 'Payment Verified & Completed!')}</h2>
          <p className="text-muted small mb-3">
            {t('payment_verified_sub', 'Your transaction signature has been verified and booking marked as Paid.')}
          </p>

          <div className="bg-light rounded-3 p-3 text-start small mb-4">
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">{t('booking_id_label', 'Booking ID')}</span>
              <span className="fw-semibold">#{bookingId}</span>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span className="text-muted">{t('total_fare_label', 'Amount Paid')}</span>
              <span className="fw-bold text-dark">₹{receiptData?.amount || totalAmount}</span>
            </div>
            {receiptData?.transactionId && (
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">{t('payment_ref_label', 'Payment Reference')}</span>
                <span className="font-monospace text-truncate" style={{ maxWidth: '200px' }}>{receiptData.transactionId}</span>
              </div>
            )}
            <div className="d-flex justify-content-between text-success fw-semibold pt-2 border-top">
              <span className="d-flex align-items-center gap-1">
                <Gift size={16} />
                <span>{t('bonus_cashback_credited', 'Wallet Bonus Cashback Credited')}</span>
              </span>
              <span>+₹{receiptData?.bonusCashback || Math.round(totalAmount * 0.05)}</span>
            </div>
          </div>

          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-grow-1 py-2 fw-semibold rounded-3"
              onClick={() => navigate(`/booking/${bookingId}/status`)}
            >
              {t('leave_a_review_cta', 'Leave a Review for Handyman ★')}
            </button>
            <Link to="/wallet" className="btn btn-outline-secondary py-2 rounded-3">
              <Wallet size={18} className="me-1 inline-block" />
              <span>{t('view_wallet_btn', 'Wallet')}</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Checkout Box */
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border">
          {/* Header Shield */}
          <div className="d-flex align-items-center gap-2 mb-3 pb-3 border-bottom">
            <ShieldCheck size={24} className="text-primary" />
            <div>
              <h2 className="h6 fw-bold mb-0 text-dark">{t('server_verified_pricing', '100% Server Verified Fare')}</h2>
              <span className="text-muted small" style={{ fontSize: '0.8rem' }}>
                {t('anti_tamper_shield', 'Tamper-proof backend order calculation with Razorpay')}
              </span>
            </div>
          </div>

          {/* Service Details */}
          <div className="mb-4">
            <div className="d-flex justify-content-between mb-2">
              <span className="text-dark fw-semibold">{booking?.category || 'Home Repair Service'}</span>
              <span className="fw-bold text-dark">₹{totalAmount}</span>
            </div>
            <div className="text-muted small mb-1">
              {booking?.subService || 'Standard Inspection & Labor'}
            </div>
            <div className="text-muted small" style={{ fontSize: '0.8rem' }}>
              📍 {booking?.address || 'Tamil Nadu'}
            </div>
          </div>

          {/* Wallet Balance Option */}
          <div className="p-3 bg-light rounded-3 mb-4 border">
            <div className="form-check d-flex align-items-center justify-content-between p-0">
              <label className="form-check-label d-flex align-items-center gap-2 cursor-pointer mb-0" htmlFor="useWalletCheck">
                <input
                  type="checkbox"
                  className="form-check-input mt-0"
                  id="useWalletCheck"
                  checked={useWallet}
                  disabled={walletBal <= 0 || paying}
                  onChange={(e) => setUseWallet(e.target.checked)}
                />
                <span className="fw-semibold text-dark small">
                  {t('use_wallet_balance', 'Use SmartFix Wallet Balance')}
                </span>
              </label>
              <span className="badge bg-primary-subtle text-primary fw-bold">
                ₹{walletBal} {t('available_label', 'available')}
              </span>
            </div>
            {useWallet && appliedWalletAmount > 0 && (
              <div className="mt-2 text-success small fw-semibold">
                - ₹{appliedWalletAmount} {t('deducted_from_wallet', 'deducted from wallet balance')}
              </div>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="border-top pt-3 mb-4">
            <div className="d-flex justify-content-between mb-1 small text-muted">
              <span>{t('subtotal_label', 'Service Subtotal')}</span>
              <span>₹{totalAmount}</span>
            </div>
            {useWallet && appliedWalletAmount > 0 && (
              <div className="d-flex justify-content-between mb-1 small text-success">
                <span>{t('wallet_credit_label', 'Wallet Balance Applied')}</span>
                <span>- ₹{appliedWalletAmount}</span>
              </div>
            )}
            <div className="d-flex justify-content-between fw-bold text-dark fs-5 mt-2 pt-2 border-top">
              <span>{t('net_payable', 'Total Payable')}</span>
              <span className="text-primary">₹{payableAmount}</span>
            </div>
          </div>

          {/* Customer Bonus Cashback Promo Banner */}
          <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-4 rounded-3">
            <Gift size={20} className="text-success flex-shrink-0" />
            <span>
              {t('cashback_guarantee', 'Earn 5% bonus cashback credited back to your wallet immediately upon payment!')}
            </span>
          </div>

          {/* Pay Button */}
          <button
            type="button"
            className="btn btn-primary w-100 py-3 rounded-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
            disabled={paying}
            onClick={handleCheckout}
          >
            {paying ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" />
                <span>{t('processing_payment', 'Processing Payment...')}</span>
              </>
            ) : payableAmount === 0 ? (
              <>
                <Wallet size={18} />
                <span>{t('pay_with_wallet_full', 'Pay ₹0 with Wallet Balance')}</span>
              </>
            ) : (
              <>
                <CreditCard size={18} />
                <span>{t('pay_now_razorpay', `Pay ₹${payableAmount} via Razorpay`)}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
