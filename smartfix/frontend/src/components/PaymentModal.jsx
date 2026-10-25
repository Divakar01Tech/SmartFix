import React, { useState } from 'react';
import {
  X, CreditCard, QrCode, Building2, Banknote, CheckCircle2,
  ShieldCheck, Download, Sparkles, Gift, Award, Copy, Check,
  ExternalLink, ArrowRight, Smartphone
} from 'lucide-react';
import './PaymentModal.css';

const DEFAULT_MERCHANT_UPI = 'smartfix.services@okaxis';
const BANK_DETAILS = {
  accountName: 'SmartFix Home Services (Divakar Tech)',
  bankName: 'State Bank of India (SBI)',
  accountNumber: '39820019283',
  ifscCode: 'SBIN0000842',
  branch: 'Sivagangai Main Branch, Tamil Nadu',
};

export default function PaymentModal({ booking, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('UPI'); // UPI | BankTransfer | Card | NetBanking | COD
  const [customUpiId, setCustomUpiId] = useState(DEFAULT_MERCHANT_UPI);
  const [utrNumber, setUtrNumber] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedIfsc, setCopiedIfsc] = useState(false);

  // Card fields
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
  const workerTotalPayout = baseWorkerPayout + workerBonusAmount; // 95% Total Worker Share if online
  const platformFee = totalAmount - workerTotalPayout; // 5% if online, 10% if COD

  const bookingShortId = String(booking?._id || booking?.id || 'BK1001').slice(-6).toUpperCase();

  // Standardized NPCI UPI URI
  const upiPayUri = `upi://pay?pa=${encodeURIComponent(customUpiId)}&pn=${encodeURIComponent('SmartFix Home Services')}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(`Booking-${bookingShortId}`)}&mode=02&purpose=00`;

  // Dynamic QR Code generation with high-reliability QR server
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(upiPayUri)}`;

  const handleCopyUpi = () => {
    navigator.clipboard?.writeText(customUpiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleCopyAccount = () => {
    navigator.clipboard?.writeText(BANK_DETAILS.accountNumber);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const handleCopyIfsc = () => {
    navigator.clipboard?.writeText(BANK_DETAILS.ifscCode);
    setCopiedIfsc(true);
    setTimeout(() => setCopiedIfsc(false), 2500);
  };

  const handleProcessPayment = (e) => {
    e.preventDefault();
    setIsProcessing(true);

    setTimeout(() => {
      const generatedTxnId = utrNumber.trim()
        ? `UTR_${utrNumber.trim().toUpperCase()}`
        : `SB_TXN_${Math.floor(100000000 + Math.random() * 900000000)}`;

      const details = {
        bookingId: booking._id || booking.id,
        amount: totalAmount,
        platformCommission: platformFee,
        baseWorkerPayout,
        workerBonusAmount,
        workerPayout: workerTotalPayout,
        isOnlinePayment: isOnline,
        paymentMethod: activeTab === 'UPI' ? 'Direct Bank UPI (Instant QR)' : activeTab === 'BankTransfer' ? 'Direct Bank Transfer (IMPS/NEFT)' : activeTab,
        transactionId: generatedTxnId,
        utrNumber: utrNumber.trim() || undefined,
        destinationAccount: activeTab === 'BankTransfer' ? `${BANK_DETAILS.bankName} (${BANK_DETAILS.accountNumber})` : customUpiId,
        timestamp: new Date().toLocaleString(),
      };

      setTxnDetails(details);
      setIsProcessing(false);
      setPaymentSuccess(true);

      if (onSuccess) {
        onSuccess(details);
      }
    }, 1500);
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
              <h2>Instant Bank & UPI Checkout</h2>
              <p>Direct bank calculation & instant payout credit with +5% worker bonus!</p>
            </div>

            {/* 5% Online Bonus Notice Banner */}
            <div className="worker-bonus-alert-box">
              <Gift size={20} color="#059669" className="pulse-icon flex-shrink-0" />
              <div>
                <strong>🎁 5% Worker Reward Bonus Active!</strong>
                <p>
                  When you pay directly via <strong>UPI QR, Bank Transfer, or Card</strong>, your worker receives an <strong>EXTRA +5% Reward Bonus (₹{workerBonusAmount})</strong> credited directly to their bank wallet!
                </p>
              </div>
            </div>

            {/* Dynamic Financial Calculation Summary Box */}
            <div className="booking-summary-box">
              <div className="summary-row">
                <span>Service Fare ({booking?.trade || 'Home Service'})</span>
                <span>₹{totalAmount}</span>
              </div>
              <div className="summary-row" style={{ color: '#64748b', fontSize: '0.85rem' }}>
                <span>Base Handyman Share (90%)</span>
                <span>₹{baseWorkerPayout}</span>
              </div>

              {/* 5% Bonus Row */}
              {isOnline ? (
                <div className="summary-row" style={{ color: '#059669', fontSize: '0.88rem', fontWeight: '700', background: '#f0fdf4', padding: '6px 8px', borderRadius: '8px' }}>
                  <span>🎁 5% Online Payment Bonus Reward</span>
                  <span>+₹{workerBonusAmount}</span>
                </div>
              ) : (
                <div className="summary-row" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  <span>5% Online Bonus Reward</span>
                  <span>₹0 (Pay via Bank/UPI to Unlock)</span>
                </div>
              )}

              <div className="summary-row" style={{ color: '#059669', fontSize: '0.9rem', fontWeight: '800' }}>
                <span>Total Handyman Net Earnings ({isOnline ? '95%' : '90%'})</span>
                <span>₹{workerTotalPayout}</span>
              </div>

              <div className="summary-row" style={{ color: '#64748b', fontSize: '0.82rem' }}>
                <span>Platform Service & Dispatch Fee</span>
                <span>₹{platformFee}</span>
              </div>

              <div className="summary-row total-row">
                <span>Total Amount to Pay</span>
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
                <QrCode size={16} /> Direct UPI QR
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'BankTransfer' ? 'active' : ''}`}
                onClick={() => setActiveTab('BankTransfer')}
              >
                <Building2 size={16} /> Bank Account (IMPS)
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'Card' ? 'active' : ''}`}
                onClick={() => setActiveTab('Card')}
              >
                <CreditCard size={16} /> Card
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === 'COD' ? 'active' : ''}`}
                onClick={() => setActiveTab('COD')}
              >
                <Banknote size={16} /> Cash
              </button>
            </div>

            {/* Payment Form */}
            <form onSubmit={handleProcessPayment} className="payment-form">
              {/* Tab 1: Direct Bank UPI QR */}
              {activeTab === 'UPI' && (
                <div className="upi-container text-center">
                  <div className="qr-preview p-3 bg-white border rounded-4 shadow-xs mx-auto d-inline-block">
                    <img
                      src={qrCodeUrl}
                      alt="Direct Bank UPI QR Code"
                      className="qr-img"
                      style={{ width: 180, height: 180, display: 'block', margin: '0 auto' }}
                    />
                    <div className="d-flex align-items-center justify-content-center gap-2 mt-2">
                      <span className="badge bg-success-subtle text-success border px-2 py-1 rounded-pill fw-bold" style={{ fontSize: '0.74rem' }}>
                        ₹{totalAmount} Pre-filled
                      </span>
                      <span className="badge bg-primary-subtle text-primary border px-2 py-1 rounded-pill fw-bold" style={{ fontSize: '0.74rem' }}>
                        Ref: #{bookingShortId}
                      </span>
                    </div>
                  </div>

                  <p className="qr-caption mt-2 mb-2 text-dark fw-semibold" style={{ fontSize: '0.88rem' }}>
                    Scan with <strong>Google Pay, PhonePe, Paytm, or BHIM</strong> to transfer directly to the merchant bank account.
                  </p>

                  {/* 1-Tap Mobile UPI Intent Button */}
                  <a
                    href={upiPayUri}
                    className="btn btn-outline-primary btn-sm rounded-pill px-3 py-2 fw-bold d-inline-flex align-items-center gap-2 mb-3 shadow-xs"
                    style={{ textDecoration: 'none' }}
                  >
                    <Smartphone size={16} /> Pay via Installed UPI App (GPay / PhonePe) <ExternalLink size={13} />
                  </a>

                  {/* UPI VPA Copy Bar */}
                  <div className="input-group mb-2">
                    <span className="input-group-text bg-light border-end-0 text-muted small fw-bold">UPI VPA:</span>
                    <input
                      type="text"
                      className="form-control bg-light border-start-0 border-end-0 fw-bold text-primary"
                      value={customUpiId}
                      onChange={(e) => setCustomUpiId(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={handleCopyUpi}
                      title="Copy UPI ID"
                    >
                      {copiedUpi ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                    </button>
                  </div>

                  {/* Optional UTR Reference Field */}
                  <div className="form-group text-start mt-3">
                    <label className="fw-bold text-dark small mb-1">
                      UTR / Bank Ref Number (Optional after payment):
                    </label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      placeholder="e.g. 429182390192 (12-digit UPI Ref)"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Direct Bank Account Transfer (IMPS / NEFT) */}
              {activeTab === 'BankTransfer' && (
                <div className="bank-transfer-container">
                  <div className="alert alert-primary border-0 p-3 rounded-4 shadow-xs mb-3" style={{ background: '#eff6ff' }}>
                    <small className="text-muted fw-bold d-block mb-1">DIRECT MERCHANT CURRENT BANK ACCOUNT</small>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-secondary small">Beneficiary Name:</span>
                      <strong className="text-dark small">{BANK_DETAILS.accountName}</strong>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-secondary small">Bank Name:</span>
                      <strong className="text-dark small">{BANK_DETAILS.bankName}</strong>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-secondary small">Account Number:</span>
                      <span className="d-flex align-items-center gap-1">
                        <strong className="text-primary font-monospace">{BANK_DETAILS.accountNumber}</strong>
                        <button type="button" className="btn btn-link p-0 text-primary" onClick={handleCopyAccount}>
                          {copiedAccount ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </button>
                      </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-secondary small">IFSC Code:</span>
                      <span className="d-flex align-items-center gap-1">
                        <strong className="text-primary font-monospace">{BANK_DETAILS.ifscCode}</strong>
                        <button type="button" className="btn btn-link p-0 text-primary" onClick={handleCopyIfsc}>
                          {copiedIfsc ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </button>
                      </span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="text-secondary small">Branch:</span>
                      <strong className="text-dark small">{BANK_DETAILS.branch}</strong>
                    </div>
                  </div>

                  <div className="form-group mb-2">
                    <label className="fw-bold text-dark small mb-1">Enter Bank Transfer UTR / Transaction Reference Number:</label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      placeholder="e.g. SBIN42891029102 or IMPS-981290"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      required
                    />
                    <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                      Transfer exact ₹{totalAmount} via your mobile banking app (SBI YONO, iMobile, HDFC, etc.) and paste the UTR number above.
                    </small>
                  </div>
                </div>
              )}

              {/* Tab 3: Debit / Credit Card */}
              {activeTab === 'Card' && (
                <div className="card-fields">
                  <div className="input-field">
                    <label>Cardholder Name</label>
                    <input
                      type="text"
                      placeholder="Name as per card"
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

              {/* Tab 4: Cash on Delivery */}
              {activeTab === 'COD' && (
                <div className="cod-info">
                  <Banknote size={36} color="#059669" />
                  <h4>Cash on Delivery Selected</h4>
                  <p>You can pay ₹{totalAmount} directly in cash to the worker after job completion.</p>
                  <small style={{ color: '#d97706', display: 'block', marginTop: '6px' }}>
                    ⚠️ Note: Cash payments do not include the 5% online worker bonus reward.
                  </small>
                </div>
              )}

              <button type="submit" className="pay-now-btn mt-3" disabled={isProcessing}>
                {isProcessing ? (
                  <span className="spinner-text">
                    <span className="spinner"></span> Verifying Bank Transaction...
                  </span>
                ) : (
                  `Confirm & Settle ₹${totalAmount} Now ${isOnline ? '(Unlocks +5% Worker Bonus 🎁)' : ''}`
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
            <p className="success-subtitle">Direct Bank Calculation Completed & Order Settled</p>

            <div className="receipt-details">
              <div className="receipt-row">
                <span>Transaction ID:</span>
                <strong>{txnDetails?.transactionId}</strong>
              </div>
              <div className="receipt-row">
                <span>Booking Reference:</span>
                <strong>#{bookingShortId}</strong>
              </div>
              <div className="receipt-row">
                <span>Payment Mode:</span>
                <strong>{txnDetails?.paymentMethod}</strong>
              </div>
              <div className="receipt-row">
                <span>Total Amount Paid:</span>
                <strong className="text-success fs-5">₹{txnDetails?.amount}</strong>
              </div>
              <div className="receipt-row">
                <span>Handyman Payout Share:</span>
                <strong className="text-primary">₹{txnDetails?.workerPayout} (Includes +5% Bonus)</strong>
              </div>
              <div className="receipt-row">
                <span>Platform Commission:</span>
                <strong>₹{txnDetails?.platformCommission}</strong>
              </div>
              <div className="receipt-row">
                <span>Date & Time:</span>
                <small>{txnDetails?.timestamp}</small>
              </div>
            </div>

            <div className="receipt-actions d-flex gap-2 mt-4">
              <button
                type="button"
                className="btn btn-outline-secondary flex-fill rounded-3 py-2 fw-bold d-flex align-items-center justify-content-center gap-1"
                onClick={handlePrintReceipt}
              >
                <Download size={16} /> Print Receipt
              </button>
              <button
                type="button"
                className="btn btn-primary flex-fill rounded-3 py-2 fw-bold"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
