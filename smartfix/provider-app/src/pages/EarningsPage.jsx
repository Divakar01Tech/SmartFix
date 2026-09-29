import { useState, useEffect } from 'react';
import { walletAPI } from '../services/api';
import { Wallet, TrendingUp, DollarSign, Plus, Loader } from 'lucide-react';
import './EarningsPage.css';

export default function EarningsPage() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    walletAPI.getMyWallet().then(r => { setWallet(r.data.wallet); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <Loader size={32} className="spin-icon" color="var(--primary)" />
    </div>
  );

  return (
    <div className="page earnings-page">
      <h1 className="mb-8">Earnings & Wallet</h1>
      <p className="text-muted mb-24">Your earnings history and wallet balance</p>

      {/* Balance Cards */}
      <div className="grid-3 mb-24">
        <div className="earn-card earn-card-primary">
          <div className="earn-icon"><Wallet size={26} /></div>
          <div className="earn-value">₹{wallet?.balance || 0}</div>
          <div className="earn-label">Available Balance</div>
        </div>
        <div className="earn-card">
          <div className="earn-icon green"><TrendingUp size={26} /></div>
          <div className="earn-value">₹{wallet?.totalEarned || 0}</div>
          <div className="earn-label">Total Earned</div>
        </div>
        <div className="earn-card">
          <div className="earn-icon purple"><DollarSign size={26} /></div>
          <div className="earn-value">₹{wallet?.totalWithdrawn || 0}</div>
          <div className="earn-label">Total Withdrawn</div>
        </div>
      </div>

      {/* Transactions */}
      <div className="card">
        <div className="card-header">
          <h3>Transaction History</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {wallet?.transactions?.length > 0 ? wallet.transactions.map((tx, i) => (
            <div key={i} className="tx-row">
              <div className={`tx-icon-wrap ${tx.type}`}>
                {tx.type === 'credit' ? <Plus size={14} /> : <DollarSign size={14} />}
              </div>
              <div className="tx-info">
                <span className="tx-desc">{tx.description}</span>
                <span className="tx-date">{new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <span className={`tx-amount ${tx.type}`}>{tx.type === 'credit' ? '+' : '-'}₹{tx.amount}</span>
            </div>
          )) : (
            <div className="empty-state" style={{ padding: '48px' }}>
              <Wallet size={40} color="var(--text-muted)" />
              <p>No transactions yet. Complete jobs to earn!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
