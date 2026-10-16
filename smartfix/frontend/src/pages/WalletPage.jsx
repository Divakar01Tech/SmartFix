import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { Wallet, ArrowUpRight, ArrowDownLeft, Gift, ShieldCheck, Clock, RefreshCw } from 'lucide-react';

export default function WalletPage() {
  const { t } = useTranslation();
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWallet = async () => {
    try {
      const data = await apiService.getWallet();
      setWallet(data || { balance: 0, transactions: [] });
    } catch (err) {
      console.warn('Failed to load wallet:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWallet();
  };

  return (
    <div className="container py-4" style={{ maxWidth: '720px', minHeight: '80vh' }}>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1 d-flex align-items-center gap-2">
            <Wallet size={28} className="text-primary" />
            <span>{t('my_wallet_title', 'SmartFix Customer Wallet')}</span>
          </h1>
          <p className="text-muted small mb-0">
            {t('wallet_sub', 'Your rewards, cashback bonus, and instant booking credits')}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm rounded-pill d-flex align-items-center gap-1"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span>{t('refresh_btn', 'Refresh')}</span>
        </button>
      </div>

      {/* Balance Card */}
      <div
        className="card border-0 rounded-4 text-white p-4 mb-4 shadow"
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
        }}
      >
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <span className="text-white-50 small text-uppercase fw-semibold" style={{ letterSpacing: '0.05em' }}>
              {t('available_balance', 'Available Balance')}
            </span>
            <div className="display-5 fw-bold mt-1">₹{wallet?.balance || 0}</div>
          </div>
          <span className="badge bg-white text-primary rounded-pill px-3 py-2 fw-semibold">
            <ShieldCheck size={16} className="me-1 inline-block" />
            {t('auto_redeemable', 'Auto-Redeemable')}
          </span>
        </div>

        <div className="d-flex align-items-center gap-2 pt-2 border-top border-white-25 small text-white-75">
          <Gift size={16} className="text-warning" />
          <span>
            {t('bonus_cashback_note', 'Earn 5% bonus reward on every completed booking payment!')}
          </span>
        </div>
      </div>

      {/* Transactions History */}
      <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h2 className="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
            <Clock size={18} className="text-muted" />
            <span>{t('transaction_history', 'Transaction History')}</span>
          </h2>
          <Link to="/customer/payments" className="btn btn-outline-primary btn-sm rounded-pill px-3 d-flex align-items-center gap-1" style={{ fontSize: '0.8rem' }}>
            <span>{t('view_payment_history_btn', 'View All Razorpay Payments')}</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-4 text-muted small">
            <div className="spinner-border spinner-border-sm text-primary mb-2" role="status" />
            <p className="mb-0">{t('loading_transactions', 'Loading wallet ledger...')}</p>
          </div>
        ) : (wallet.transactions || []).length === 0 ? (
          <div className="text-center py-5 text-muted small">
            <Wallet size={36} className="text-secondary opacity-30 mb-2" />
            <p className="mb-0">{t('no_transactions_yet', 'No wallet transactions recorded yet.')}</p>
            <p className="small text-muted">{t('transactions_hint', 'Complete booking payments to earn promotional cashback credits.')}</p>
          </div>
        ) : (
          <div className="list-group list-group-flush">
            {wallet.transactions.map((tx, idx) => {
              const isCredit = tx.type === 'credit' || (tx.amount && tx.amount > 0);
              return (
                <div key={idx} className="list-group-item px-0 py-3 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className={`rounded-circle p-2 d-flex align-items-center justify-content-center ${
                        isCredit ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div>
                      <div className="fw-semibold text-dark small">{tx.description || (isCredit ? 'Cashback Credit' : 'Payment Debit')}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {new Date(tx.createdAt || tx.date || Date.now()).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className={`fw-bold ${isCredit ? 'text-success' : 'text-danger'}`}>
                    {isCredit ? '+' : '-'}₹{Math.abs(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
