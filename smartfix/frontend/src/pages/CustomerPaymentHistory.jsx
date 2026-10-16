import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService, getApiBase } from '../services/api';
import {
  CreditCard,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wallet,
  Gift,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

export default function CustomerPaymentHistory() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchPayments = async () => {
    try {
      setErrorMsg('');
      const list = await apiService.getMyPayments();
      setPayments(Array.isArray(list) ? list : []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to load payments history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPayments();
  };

  // Aggregated Stats
  const paidPayments = payments.filter((p) => p.status === 'paid');
  const totalAmountPaid = paidPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const totalWalletUsed = paidPayments.reduce((sum, p) => sum + (p.walletUsed || 0), 0);
  const totalCashbackEarned = paidPayments.reduce((sum, p) => sum + (p.bonusCredited || p.customerCashback || 0), 0);

  return (
    <div className="container py-4" style={{ maxWidth: '960px', minHeight: '80vh' }}>
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <Link
            to="/customer/bookings"
            className="text-decoration-none text-muted small d-inline-flex align-items-center gap-1 mb-2"
          >
            <ArrowLeft size={16} />
            <span>{t('back_to_bookings', 'Back to My Bookings')}</span>
          </Link>
          <h1 className="h3 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
            <CreditCard size={28} className="text-primary" />
            <span>{t('payments.title', 'Payment History & Receipts')}</span>
          </h1>
          <p className="text-muted small mb-0">
            {t(
              'payments.sub',
              'Review all completed transactions, Razorpay receipts, and wallet cashback rewards.'
            )}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Link to="/customer/wallet" className="btn btn-outline-primary btn-sm rounded-pill px-3 d-flex align-items-center gap-1">
            <Wallet size={14} />
            <span>{t('my_wallet', 'SmartFix Wallet')}</span>
          </Link>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm rounded-pill d-flex align-items-center gap-1 px-3"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{t('refresh_btn', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border">
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 bg-primary-subtle text-primary rounded-3">
                <CreditCard size={24} />
              </div>
              <div>
                <span className="text-muted small d-block">{t('total_paid_razorpay', 'Total Paid (Razorpay)')}</span>
                <span className="fs-5 fw-bold text-dark">₹{totalAmountPaid.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border">
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 bg-success-subtle text-success rounded-3">
                <Wallet size={24} />
              </div>
              <div>
                <span className="text-muted small d-block">{t('wallet_balance_redeemed', 'Wallet Balance Applied')}</span>
                <span className="fs-5 fw-bold text-success">₹{totalWalletUsed.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm rounded-4 p-3 bg-white border">
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 bg-warning-subtle text-warning-emphasis rounded-3">
                <Gift size={24} />
              </div>
              <div>
                <span className="text-muted small d-block">{t('cashback_rewards_earned', 'Cashback Rewards Earned')}</span>
                <span className="fs-5 fw-bold text-dark">+₹{totalCashbackEarned.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-4 rounded-3">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Transactions Table */}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white border">
        <div className="card-header bg-white py-3 px-4 border-bottom d-flex align-items-center justify-content-between">
          <h2 className="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
            <Clock size={18} className="text-muted" />
            <span>{t('all_transactions', 'All Transactions')}</span>
          </h2>
          <span className="badge bg-light text-muted border px-2 py-1 small">
            {payments.length} {t('records_label', 'records')}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-5 text-muted small">
            <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
            <p className="mb-0">{t('loading_payments', 'Loading payment ledger...')}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-5 text-muted small">
            <CreditCard size={42} className="text-secondary opacity-30 mb-2" />
            <p className="mb-1 fw-semibold text-dark">{t('payments.no_payments', 'No payment transactions recorded yet.')}</p>
            <p className="text-muted mb-3">{t('payments_empty_sub', 'When you complete a service and pay via Razorpay or Wallet, your invoices will appear here.')}</p>
            <Link to="/customer/services" className="btn btn-primary btn-sm rounded-pill px-4">
              {t('browse_services_btn', 'Explore Services')}
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.88rem' }}>
              <thead className="table-light text-muted small">
                <tr>
                  <th className="ps-4">{t('job_id', 'Booking Ref')}</th>
                  <th>{t('date_time', 'Date')}</th>
                  <th>{t('service_trade', 'Service')}</th>
                  <th>{t('total_fare', 'Fare')}</th>
                  <th>{t('wallet_used_label', 'Wallet')}</th>
                  <th>{t('amount_paid_label', 'Paid via Razorpay')}</th>
                  <th>{t('bonus_cashback', 'Cashback')}</th>
                  <th>{t('status', 'Status')}</th>
                  <th className="pe-4 text-end">{t('action_invoice', 'Invoice')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const bId = p.booking?._id || p.booking?.id || p.booking;
                  const bookingTrade = p.booking?.trade || 'Service';
                  const isPaid = p.status === 'paid';
                  const dateStr = p.paidAt || p.createdAt ? new Date(p.paidAt || p.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }) : '—';

                  return (
                    <tr key={p._id || p.razorpayOrderId}>
                      <td className="ps-4">
                        <Link
                          to={`/booking/${bId}/status`}
                          className="fw-bold text-decoration-none font-monospace text-primary"
                        >
                          #{String(bId).slice(-6)}
                        </Link>
                      </td>
                      <td className="text-muted small">{dateStr}</td>
                      <td>
                        <span className="fw-semibold text-dark">{bookingTrade}</span>
                        {p.provider?.name && (
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            Pro: {p.provider.name}
                          </div>
                        )}
                      </td>
                      <td className="fw-semibold text-dark">₹{p.amountTotal}</td>
                      <td>
                        {p.walletUsed > 0 ? (
                          <span className="text-success fw-bold">-₹{p.walletUsed}</span>
                        ) : (
                          <span className="text-muted">₹0</span>
                        )}
                      </td>
                      <td>
                        <strong className="text-primary">₹{p.amountPaid}</strong>
                      </td>
                      <td>
                        {p.bonusCredited > 0 ? (
                          <span className="badge bg-success-subtle text-success fw-bold">
                            +₹{p.bonusCredited}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge rounded-pill px-2 py-1 small ${
                            isPaid
                              ? 'bg-success-subtle text-success'
                              : p.status === 'failed'
                              ? 'bg-danger-subtle text-danger'
                              : 'bg-warning-subtle text-warning-emphasis'
                          }`}
                        >
                          {isPaid ? '✓ Paid' : p.status}
                        </span>
                      </td>
                      <td className="pe-4 text-end">
                        {isPaid && bId ? (
                          <a
                            href={`${getApiBase()}/bookings/${bId}/invoice`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline-primary btn-sm rounded-3 py-1 px-2 d-inline-flex align-items-center gap-1"
                            title={t('download_pdf_invoice', 'Download PDF Invoice')}
                          >
                            <Download size={13} />
                            <span style={{ fontSize: '0.78rem' }}>PDF</span>
                          </a>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
