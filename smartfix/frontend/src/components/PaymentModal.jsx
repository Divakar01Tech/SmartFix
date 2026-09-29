import { useState } from 'react';
import { X, CreditCard, QrCode, Building2, Banknote, CheckCircle2, ShieldCheck, Download, Sparkles, Gift, Award } from 'lucide-react';
import './PaymentModal.css';

const PaymentModal = ({ booking, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('UPI'); // UPI | Card | NetBanking | COD
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [selectedBank, setSelectedBank] = useState('SBI');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [txnDetails, setTxnDetails] = useState(null);

  const totalAmount = Number(booking?.price) || 350;
  const isOnline = activeTab !== 'COD';

  // 5% Worker Reward Bonus calculation
  const workerBonusAmount = isOnline ? Math.round(totalAmount * 0.05) : 0;
  const baseWorkerPayout = totalAmount - Math.round(totalAmount * 0.10); // 90% Base Share
  const workerTotalPayout = baseWorkerPayout + workerBonusAmount; // 95% Total Worker Share if online!
  const platformFee = totalAmount - workerTotalPayout; // 5% if online, 10% if COD

  const handleProcessPayment = (e) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      const generatedTxnId = `SB_TXN_${Math.floor(100000000 + Math.random() * 900000000)}`;
      const details = {
        bookingId: booking._id || booking.id,
        amount: totalAmount,
        platformCommission: platformFee,
        baseWorkerPayout,
        workerBonusAmount,
        workerPayout: workerTotalPayout,
        isOnlinePayment: isOnline,
        paymentMethod: activeTab,
        transactionId: generatedTxnId,
        timestamp: new Date().toLocaleString(),
      };

      setTxnDetails(details);
      setIsProcessing(false);
      setPaymentSuccess(true);

      if (onSuccess) {
        onSuccess(details);
      }
    }, 1800);
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="payment-modal-overlay">
      <div className="payment-modal-card">
        <button className="close-modal-btn" onClick={onClose} disabled={isProcessing}>
          <X size={20} />
        </button>

        {!paymentSuccess ? (
          <>
            <div className="modal-header-section">
              <div className="shield-icon">
                <ShieldCheck size={28} color="#2563eb" />
              </div>
              <h2>In-App Instant Checkout</h2>
              <p>Pay safely within website & reward your worker with +5% extra bonus!</p>
            </div>

            {/* 5% Online Bonus Notice Banner */}
            <div className="worker-bonus-alert-box">
              <Gift size={20} color="#059669" className="pulse-icon" />
              <div>
                <strong>🎁 5% Worker Bonus & Reward Active!</strong>
                <p>
                  When you pay online via <strong>UPI, Card, or NetBanking</strong>, your worker gets an <strong>EXTRA +5% Reward Bonus (₹{Math.round(totalAmount * 0.05)})</strong> credited directly to their wallet!
                </p>
              </div>
            </div>

            <div className="booking-summary-box">
              <div className="summary-row">
                <span>Service Fare ({booking?.trade || 'Handyman Service'})</span>
                <span>₹{totalAmount}</span>
              </div>
              <div className="summary-row" style={{ color: '#64748b', fontSize: '0.85rem' }}>
                <span>Base Worker Share (90%)</span>
                <span>₹{baseWorkerPayout}</span>
              </div>

              {/* 5% Bonus Row */}
              {isOnline ? (
                <div className="summary-row" style={{ color: '#059669', fontSize: '0.88rem', fontWeight: '700', background: '#f0fdf4', padding: '6px 8px', borderRadius: '8px' }}>
                  <span>🎁 5% Online Worker Bonus Reward</span>
                  <span>+₹{workerBonusAmount}</span>
                </div>
              ) : (
                <div className="summary-row" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  <span>5% Online Bonus Reward</span>
                  <span>₹0 (Pay Online to Unlock)</span>
                </div>
              )}

              <div className="summary-row" style={{ color: '#059669', fontSize: '0.9rem', fontWeight: '800' }}>
                <span>Total Worker Net Payout ({isOnline ? '95%' : '90%'})</span>
                <span>₹{workerTotalPayout}</span>
              </div>

              <div className="summary-row total-row">
                <span>Total Amount Payable</span>
                <span className="total-price">₹{totalAmount}</span>
              </div>
            </div>

            {/* Payment Method Tabs */}
            <div className="payment-tabs">
              <button
                type="button"
                className={`tab-btn ${activeTab === 'UPI' ? 'active' : ''}`}
                onClick={() => setActiveTab('UPI')}
              >
                <QrCode size={18} /> UPI / QR
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'Card' ? 'active' : ''}`}
                onClick={() => setActiveTab('Card')}
              >
                <CreditCard size={18} /> Card
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'NetBanking' ? 'active' : ''}`}
                onClick={() => setActiveTab('NetBanking')}
              >
                <Building2 size={18} /> NetBanking
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'COD' ? 'active' : ''}`}
                onClick={() => setActiveTab('COD')}
              >
                <Banknote size={18} /> Cash
              </button>
            </div>

            {/* Payment Form */}
            <form onSubmit={handleProcessPayment} className="payment-form">
              {activeTab === 'UPI' && (
                <div className="upi-container">
                  <div className="qr-preview">
                    <img
                      src={`https://chart.googleapis.com/chart?cht=qr&chs=180x180&chl=${encodeURIComponent(`upi://pay?pa=${upiId || 'smartfix@upi'}&pn=SmartFix&am=${totalAmount}&cu=INR`)}`}
                      alt="Custom UPI QR Code"
                      className="qr-img border p-2 bg-white rounded-3 shadow-xs"
                      onError={(e) => {
                        e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=${upiId || 'smartfix@upi'}&pn=SmartFix&am=${totalAmount}&cu=INR`)}`;
                      }}
                    />
                    <p className="qr-caption mt-2">
                      Scan with GPay, PhonePe, Paytm, or BHIM to pay <strong>₹{totalAmount}</strong>
                    </p>
                    <span className="badge bg-success-subtle text-success border px-2 py-1 rounded-pill" style={{ fontSize: '0.76rem' }}>
                      ⚡ Custom UPI ID Active: {upiId || 'smartfix@upi'}
                    </span>
                  </div>
                  <div className="upi-input-group mt-3">
                    <label className="fw-bold text-dark">Enter your Merchant or Custom UPI VPA ID:</label>
                    <input
                      type="text"
                      placeholder="e.g. divakar@upi, 9003390146@upi, or yourname@okicici"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="form-control rounded-3"
                    />
                    <small className="text-muted d-block mt-1">
                      💡 Type any custom GPay / PhonePe / Paytm UPI ID above to generate your instant QR code!
                    </small>
                  </div>
                </div>
              )}

              {activeTab === 'Card' && (
                <div className="card-fields">
                  <div className="input-field">
                    <label>Cardholder Name</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-field">
                    <label>Card Number</label>
                    <input
                      type="text"
                      placeholder="4532 •••• •••• 8921"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="card-row">
                    <div className="input-field">
                      <label>Expiry Date</label>
                      <input
                        type="text"
                        placeholder="MM/YY"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        required
                      />
                    </div>
                    <div className="input-field">
                      <label>CVC / CVV</label>
                      <input
                        type="password"
                        placeholder="123"
                        maxLength={4}
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'NetBanking' && (
                <div className="netbanking-container">
                  <label>Select Popular Bank</label>
                  <select value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
                    <option value="SBI">State Bank of India (SBI)</option>
                    <option value="HDFC">HDFC Bank</option>
                    <option value="ICICI">ICICI Bank</option>
                    <option value="Axis">Axis Bank</option>
                    <option value="Kotak">Kotak Mahindra Bank</option>
                  </select>
                </div>
              )}

              {activeTab === 'COD' && (
                <div className="cod-info">
                  <Banknote size={36} color="#059669" />
                  <h4>Cash on Delivery Selected</h4>
                  <p>You can pay ₹{totalAmount} directly to the worker after job completion.</p>
                  <small style={{ color: '#d97706', display: 'block', marginTop: '6px' }}>
                    ⚠️ Note: Cash payments do not include the 5% online worker bonus reward.
                  </small>
                </div>
              )}

              <button type="submit" className="pay-now-btn" disabled={isProcessing}>
                {isProcessing ? (
                  <span className="spinner-text">
                    <span className="spinner"></span> Processing Secure Payment...
                  </span>
                ) : (
                  `Pay ₹${totalAmount} Now ${isOnline ? '(Unlocks +5% Worker Bonus 🎁)' : ''}`
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="receipt-container">
            <div className="success-badge">
              <CheckCircle2 size={54} color="#059669" />
            </div>
            <h2>Payment Successful!</h2>
            <p className="success-subtitle">Transaction Completed & Worker Bonus Credited</p>

            <div className="receipt-card">
              <div className="receipt-header">
                <h3><Sparkles size={16} color="#2563eb" /> SmartFix Digital Receipt</h3>
                <span className="receipt-status">PAID</span>
              </div>
              <div className="receipt-line">
                <span>Transaction ID:</span>
                <strong>{txnDetails?.transactionId}</strong>
              </div>
              <div className="receipt-line">
                <span>Payment Method:</span>
                <strong>{txnDetails?.paymentMethod}</strong>
              </div>
              <div className="receipt-line">
                <span>Service:</span>
                <strong>{booking?.trade}</strong>
              </div>
              <div className="receipt-line">
                <span>Worker Pro:</span>
                <strong>{booking?.workerName || booking?.worker?.name || 'Assigned Handyman'}</strong>
              </div>

              {/* Bonus Highlight in Receipt */}
              {txnDetails?.isOnlinePayment && (
                <div className="receipt-line" style={{ color: '#059669', background: '#f0fdf4', padding: '6px 8px', borderRadius: '8px' }}>
                  <span>🎁 5% Online Worker Bonus Reward:</span>
                  <strong>+₹{txnDetails?.workerBonusAmount}</strong>
                </div>
              )}

              <div className="receipt-line">
                <span>Total Worker Net Payout:</span>
                <span style={{ color: '#059669', fontWeight: '700' }}>₹{txnDetails?.workerPayout}</span>
              </div>
              <hr />
              <div className="receipt-line total-receipt-line">
                <span>Total Amount Paid:</span>
                <strong className="paid-amount">₹{txnDetails?.amount}</strong>
              </div>
            </div>

            <div className="receipt-actions">
              <button className="print-btn" onClick={handlePrintReceipt}>
                <Download size={16} /> Print / Save Receipt
              </button>
              <button className="done-btn" onClick={onClose}>
                Done & Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
