import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingAPI, paymentAPI } from '../services/api';
import socket from '../services/socket';
import { CreditCard, Shield, CheckCircle, Loader, Wallet, Gift, ArrowRight } from 'lucide-react';
import './PaymentPage.css';

export default function PaymentPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [splits, setSplits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const res = await bookingAPI.getById(bookingId);
        setBooking(res.data.booking);
      } catch (e) {
        setError('Could not load booking details');
      }
      setLoading(false);
    };
    fetchBooking();
  }, [bookingId]);

  const handlePay = async () => {
    setPaying(true);
    setError('');
    try {
      // Step 1: Create Razorpay order
      const orderRes = await paymentAPI.createOrder({ bookingId });
      const { order, splits: splitData, key } = orderRes.data;
      setSplits(splitData);

      // Step 2: If Razorpay SDK available, open checkout
      if (window.Razorpay && key !== 'rzp_test_demo') {
        const options = {
          key,
          amount: order.amount,
          currency: order.currency,
          name: 'HandyBook',
          description: `Payment for ${booking?.trade}`,
          order_id: order.id,
          handler: async (response) => {
            // Step 3: Verify payment
            await paymentAPI.verify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              bookingId,
              paymentId: order.paymentId,
            });
            setSuccess(true);
          },
          prefill: { name: booking?.customer?.name || '', contact: booking?.customer?.phone || '' },
          theme: { color: '#FF6B35' },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Demo mode — auto-verify
        await paymentAPI.verify({
          razorpayOrderId: order.id,
          razorpayPaymentId: `demo_pay_${Date.now()}`,
          razorpaySignature: 'demo_signature',
          bookingId,
          paymentId: order.paymentId,
        });
        setSuccess(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return (
    <div className="page flex items-center justify-center" style={{ minHeight: '70vh' }}>
      <Loader size={40} className="spin-icon" color="#FF6B35" />
    </div>
  );

  if (success) return (
    <div className="page page-sm text-center payment-success">
      <div className="success-icon"><CheckCircle size={56} /></div>
      <h1>Payment Successful!</h1>
      <p>Your payment has been processed. Thank you for using HandyBook!</p>
      {splits && (
        <div className="cashback-reward">
          <Gift size={24} color="#10B981" />
          <div>
            <strong>₹{splits.customerCashback} Cashback Credited!</strong>
            <span>Added to your HandyBook Wallet</span>
          </div>
        </div>
      )}
      <div className="success-actions">
        <button className="btn btn-primary btn-lg" onClick={() => navigate(`/review/${bookingId}`)}>
          Rate Your Experience <ArrowRight size={18} />
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="page page-sm payment-page">
      <h1 className="mb-8">Complete Payment</h1>
      <p className="text-muted mb-24">Secure payment powered by Razorpay</p>

      {/* Booking Summary */}
      {booking && (
        <div className="card mb-16">
          <div className="card-body">
            <h3 className="mb-12">Booking Summary</h3>
            <div className="pay-row"><span>Service</span><strong>{booking.trade}</strong></div>
            <div className="pay-row"><span>Address</span><strong>{booking.address}</strong></div>
            <div className="pay-row"><span>Date</span><strong>{booking.date}</strong></div>
            {booking.worker?.name && <div className="pay-row"><span>Provider</span><strong>{booking.worker.name}</strong></div>}
            <div className="pay-divider" />
            <div className="pay-row total">
              <span>Total Amount</span>
              <strong className="text-primary text-xl">₹{booking.price}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Commission Preview */}
      <div className="card commission-card mb-16">
        <div className="card-body">
          <h3 className="mb-12">Payment Breakdown</h3>
          <div className="commission-row">
            <span>Amount Paid</span>
            <strong>₹{booking?.price || 0}</strong>
          </div>
          <div className="commission-row highlight">
            <span><Gift size={14} /> Your Cashback (~5% of commission)</span>
            <strong className="text-success">₹{Math.round((booking?.price || 0) * 0.005)}</strong>
          </div>
          <div className="commission-row">
            <span>Provider Earns</span>
            <strong>₹{Math.round((booking?.price || 0) * 0.9)}</strong>
          </div>
        </div>
      </div>

      {error && <div className="error-box mb-16">{error}</div>}

      <button className="btn btn-primary btn-full btn-lg" onClick={handlePay} disabled={paying}>
        {paying ? <><Loader size={18} className="spin-icon" /> Processing...</>
                : <><CreditCard size={20} /> Pay ₹{booking?.price} Securely</>}
      </button>

      <div className="security-note">
        <Shield size={16} color="#64748B" />
        <span>256-bit SSL encryption. Your payment is fully secure.</span>
      </div>

      <script src="https://checkout.razorpay.com/v1/checkout.js" async />
    </div>
  );
}
