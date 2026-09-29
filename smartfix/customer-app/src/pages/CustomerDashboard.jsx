import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingAPI, walletAPI } from '../services/api';
import socket from '../services/socket';
import {
  ClipboardList, Wallet, Clock, CheckCircle, Navigation,
  AlertTriangle, CreditCard, Star, MapPin, Loader, RefreshCw, Plus
} from 'lucide-react';
import './CustomerDashboard.css';

const STATUS_COLOR = {
  Pending: 'pending', Accepted: 'accepted', EnRoute: 'enroute',
  Arrived: 'arrived', WorkInProgress: 'wip', Completed: 'completed',
  Paid: 'paid', Reviewed: 'reviewed', Cancelled: 'cancelled', SLABreached: 'sla',
};

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, wRes] = await Promise.all([
        bookingAPI.getMyBookings(),
        walletAPI.getMyWallet(),
      ]);
      setBookings(bRes.data.bookings || []);
      setWallet(wRes.data.wallet);
    } catch (e) {
      console.warn('Dashboard fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    socket.on('booking-updated', (updated) => {
      setBookings(prev => prev.map(b =>
        (b._id || b.id) === (updated._id || updated.id) ? { ...b, ...updated } : b
      ));
    });

    socket.on('booking-status-changed', (data) => {
      setBookings(prev => prev.map(b =>
        (b._id || b.id) === data.bookingId ? { ...b, status: data.status } : b
      ));
    });

    socket.on('cashback-credited', () => walletAPI.getMyWallet().then(r => setWallet(r.data.wallet)));

    return () => {
      socket.off('booking-updated');
      socket.off('booking-status-changed');
      socket.off('cashback-credited');
    };
  }, []);

  const activeBookings = bookings.filter(b => !['Paid', 'Reviewed', 'Cancelled'].includes(b.status));
  const historyBookings = bookings.filter(b => ['Paid', 'Reviewed', 'Cancelled'].includes(b.status));
  const displayBookings = activeTab === 'active' ? activeBookings : historyBookings;

  return (
    <div className="page dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>My Dashboard</h1>
          <p className="text-muted">Manage your bookings and wallet</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost btn-sm" onClick={fetchData}><RefreshCw size={16} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => navigate('/')}><Plus size={16} /> New Booking</button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid-4 mb-24">
        <div className="stat-card">
          <div className="stat-icon orange"><ClipboardList size={22} /></div>
          <div className="stat-info">
            <span className="stat-num">{bookings.length}</span>
            <span className="stat-lbl">Total Bookings</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><Clock size={22} /></div>
          <div className="stat-info">
            <span className="stat-num">{activeBookings.length}</span>
            <span className="stat-lbl">Active</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><CheckCircle size={22} /></div>
          <div className="stat-info">
            <span className="stat-num">{historyBookings.length}</span>
            <span className="stat-lbl">Completed</span>
          </div>
        </div>
        <div className="stat-card wallet-stat" onClick={() => setActiveTab('wallet')}>
          <div className="stat-icon yellow"><Wallet size={22} /></div>
          <div className="stat-info">
            <span className="stat-num">₹{wallet?.balance || 0}</span>
            <span className="stat-lbl">Wallet Balance</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tab-bar mb-16">
        {[
          { key: 'active',  label: `Active (${activeBookings.length})` },
          { key: 'history', label: `History (${historyBookings.length})` },
          { key: 'wallet',  label: 'Wallet' },
        ].map(t => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Wallet Tab ── */}
      {activeTab === 'wallet' && (
        <div className="wallet-section">
          <div className="wallet-balance-card">
            <div className="wallet-icon"><Wallet size={32} /></div>
            <div>
              <div className="wallet-balance">₹{wallet?.balance || 0}</div>
              <div className="wallet-label">Available Balance</div>
            </div>
            <div className="wallet-meta">
              <div><span>Total Earned</span><strong>₹{wallet?.totalEarned || 0}</strong></div>
            </div>
          </div>
          <div className="transactions-list">
            <h3 className="mb-16">Transaction History</h3>
            {wallet?.transactions?.length > 0 ? wallet.transactions.map((tx, i) => (
              <div key={i} className="tx-row">
                <div className={`tx-icon ${tx.type}`}>
                  {tx.type === 'credit' ? <Plus size={14} /> : <CreditCard size={14} />}
                </div>
                <div className="tx-info">
                  <span className="tx-desc">{tx.description}</span>
                  <span className="tx-date">{new Date(tx.createdAt).toLocaleDateString()}</span>
                </div>
                <span className={`tx-amount ${tx.type}`}>
                  {tx.type === 'credit' ? '+' : '-'}₹{tx.amount}
                </span>
              </div>
            )) : (
              <div className="empty-state">
                <Wallet size={40} color="#CBD5E1" />
                <p>No transactions yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Booking List ── */}
      {activeTab !== 'wallet' && (
        loading ? (
          <div className="loading-state"><Loader size={32} className="spin-icon" color="#FF6B35" /></div>
        ) : displayBookings.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={48} color="#CBD5E1" />
            <h3>No bookings {activeTab === 'active' ? 'yet' : 'in history'}</h3>
            <button className="btn btn-primary mt-16" onClick={() => navigate('/')}>Book a Service</button>
          </div>
        ) : (
          <div className="bookings-list">
            {displayBookings.map(booking => {
              const id = booking._id || booking.id;
              const isActive = !['Paid','Reviewed','Cancelled'].includes(booking.status);
              return (
                <div key={id} className="booking-row card">
                  <div className="card-body booking-row-inner">
                    <div className="booking-info">
                      <div className="booking-trade">{booking.trade}</div>
                      <div className="booking-address"><MapPin size={14} /> {booking.address || 'Address not set'}</div>
                      <div className="booking-meta">
                        <span>{booking.date} {booking.time}</span>
                        <span className={`badge badge-${STATUS_COLOR[booking.status] || 'pending'}`}>{booking.status}</span>
                      </div>
                      {booking.slaBreached && (
                        <div className="sla-warning"><AlertTriangle size={12} /> SLA Breached</div>
                      )}
                    </div>
                    <div className="booking-right">
                      <div className="booking-price">₹{booking.price}</div>
                      <div className="booking-actions">
                        {isActive && (
                          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/track/${id}`)}>
                            <Navigation size={14} /> Track
                          </button>
                        )}
                        {booking.status === 'Completed' && booking.paymentStatus !== 'Paid' && (
                          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/pay/${id}`)}>
                            <CreditCard size={14} /> Pay
                          </button>
                        )}
                        {(booking.status === 'Paid' || booking.paymentStatus === 'Paid') && !booking.rating && (
                          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/review/${id}`)}>
                            <Star size={14} /> Review
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
