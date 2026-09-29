import { useState, useEffect } from 'react';
import { getAnalytics, getAllBookings } from '../services/adminAPI';
import { Users, ClipboardList, DollarSign, TrendingUp, AlertTriangle, Loader, RefreshCw, Activity } from 'lucide-react';
import './DashboardPage.css';

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState({});
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aRes, bRes] = await Promise.all([
        getAnalytics(),
        getAllBookings({ limit: 8 }),
      ]);
      setAnalytics(aRes.data.analytics || aRes.data || {});
      setRecentBookings((bRes.data.bookings || []).slice(0, 8));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const kpis = [
    { label: 'Total Users', value: analytics.totalUsers || 0, icon: Users, color: 'blue', delta: '+12%' },
    { label: 'Total Bookings', value: analytics.totalBookings || 0, icon: ClipboardList, color: 'purple', delta: '+8%' },
    { label: 'Revenue', value: `₹${(analytics.totalRevenue || 0).toLocaleString()}`, icon: DollarSign, color: 'green', delta: '+15%' },
    { label: 'SLA Breaches', value: analytics.slaBreaches || 0, icon: AlertTriangle, color: 'red', delta: 'This week' },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted text-sm">Platform overview and analytics</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetchData}><RefreshCw size={15} /> Refresh</button>
      </div>

      {loading ? (
        <div className="text-center" style={{ padding: '48px' }}>
          <Loader size={32} className="spin-icon" color="var(--primary)" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid-4 mb-24">
            {kpis.map(({ label, value, icon: Icon, color, delta }) => (
              <div key={label} className={`kpi-card kpi-${color}`}>
                <div className="kpi-top">
                  <div className="kpi-icon"><Icon size={20} /></div>
                  <div className={`kpi-delta ${color === 'red' ? 'neg' : 'pos'}`}>{delta}</div>
                </div>
                <div className="kpi-value">{value}</div>
                <div className="kpi-label">{label}</div>
              </div>
            ))}
          </div>

          {/* Status Distribution */}
          {analytics.statusBreakdown && (
            <div className="card mb-24">
              <div className="card-header"><h3>Booking Status Distribution</h3></div>
              <div className="card-body">
                <div className="status-grid">
                  {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
                    <div key={status} className="status-stat">
                      <div className="status-count">{count}</div>
                      <div className="status-name">{status}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent Bookings */}
          <div className="card">
            <div className="card-header">
              <h3>Recent Bookings</h3>
              <span className="text-muted text-sm">{recentBookings.length} shown</span>
            </div>
            {recentBookings.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Service</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Price</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map(b => {
                      const id = b._id || b.id;
                      return (
                        <tr key={id}>
                          <td className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>{id.toString().slice(-6)}</td>
                          <td style={{ fontWeight: 600 }}>{b.trade}</td>
                          <td>{b.customer?.name || '—'}</td>
                          <td><span className={`badge badge-${b.status?.toLowerCase() || 'pending'}`}>{b.status}</span></td>
                          <td className="font-mono" style={{ color: 'var(--success)' }}>₹{b.price}</td>
                          <td className="text-muted text-sm">{b.date}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><Activity size={32} /><p>No bookings data</p></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
