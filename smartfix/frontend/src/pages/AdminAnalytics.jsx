import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../services/api';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, DollarSign, Award, ShieldAlert, CheckCircle2, Clock, Star, RefreshCw 
} from 'lucide-react';

export default function AdminAnalytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [scorecards, setScorecards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('smartfix_token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };
      const apiBase = getApiBase();

      const [analyticsRes, scorecardsRes] = await Promise.all([
        fetch(`${apiBase}/admin/analytics`, { headers }),
        fetch(`${apiBase}/admin/worker-scorecards`, { headers }),
      ]);


      if (!analyticsRes.ok || !scorecardsRes.ok) {
        throw new Error('Failed to fetch analytics or scorecards data');
      }

      const analyticsData = await analyticsRes.json();
      const scorecardsData = await scorecardsRes.json();

      setAnalytics(analyticsData.analytics);
      setScorecards(scorecardsData.scorecards || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredScorecards = scorecards.filter((sc) =>
    sc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sc.trade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <div className="mt-2 text-secondary">Loading SmartFix Operational Analytics...</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-4 bg-light min-vh-100">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="fw-extrabold text-dark mb-1 d-flex align-items-center gap-2">
            <TrendingUp size={28} className="text-primary" /> Operational Analytics & Worker Scorecards
          </h2>
          <p className="text-secondary mb-0">Live Platform Demand, SLA Compliance %, and Handyman Performance Metrics</p>
        </div>
        <button className="btn btn-outline-primary d-flex align-items-center gap-2 shadow-xs" onClick={fetchData}>
          <RefreshCw size={16} /> Refresh Metrics
        </button>
      </div>

      {/* Admin Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <Link
          to="/admin/analytics"
          style={{
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '800',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
          }}
          aria-current="page"
        >
          <TrendingUp size={18} /> Analytics & Scorecards 📊
        </Link>

        <Link
          to="/admin"
          style={{
            background: '#ffffff',
            color: '#475569',
            border: '1px solid #cbd5e1',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          ← Back to Admin Operations Panel
        </Link>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {/* Summary KPI Cards */}
      {analytics && (
        <div className="row g-3 mb-4">
          <div className="col-lg-3 col-md-6">
            <div className="card border-0 shadow-sm rounded-3 p-3 bg-white border-start border-4 border-primary">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small fw-bold uppercase">Total Revenue</span>
                  <h3 className="fw-extrabold text-dark mb-0 mt-1">₹{analytics.totalRevenue.toLocaleString()}</h3>
                </div>
                <div className="p-3 bg-primary-subtle text-primary rounded-circle">
                  <DollarSign size={24} />
                </div>
              </div>
              <div className="mt-2 text-success extra-small fw-semibold">
                Platform Commission: ₹{analytics.platformCommissionRevenue?.toLocaleString()} (10%)
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="card border-0 shadow-sm rounded-3 p-3 bg-white border-start border-4 border-success">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small fw-bold uppercase">SLA Compliance</span>
                  <h3 className="fw-extrabold text-success mb-0 mt-1">{analytics.slaCompliancePercentage}%</h3>
                </div>
                <div className="p-3 bg-success-subtle text-success rounded-circle">
                  <Clock size={24} />
                </div>
              </div>
              <div className="mt-2 text-muted extra-small">
                Target: &lt; 60 Mins EnRoute to Arrival
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="card border-0 shadow-sm rounded-3 p-3 bg-white border-start border-4 border-info">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small fw-bold uppercase">Active Providers</span>
                  <h3 className="fw-extrabold text-dark mb-0 mt-1">{analytics.activeCaptains}</h3>
                </div>
                <div className="p-3 bg-info-subtle text-info rounded-circle">
                  <Users size={24} />
                </div>
              </div>
              <div className="mt-2 text-muted extra-small">
                Out of {analytics.totalCaptains} Total Handymen
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="card border-0 shadow-sm rounded-3 p-3 bg-white border-start border-4 border-warning">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <span className="text-muted small fw-bold uppercase">Active Bookings</span>
                  <h3 className="fw-extrabold text-dark mb-0 mt-1">{analytics.activeBookings || 0}</h3>
                </div>
                <div className="p-3 bg-warning-subtle text-warning rounded-circle">
                  <Calendar size={24} />
                </div>
              </div>
              <div className="mt-2 text-muted extra-small">
                Completed Jobs: {analytics.completedBookings}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="row g-4 mb-4">
        {/* Daily Booking Trend Chart */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-3 bg-white p-4 h-100">
            <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <Calendar size={20} className="text-primary" /> Daily Booking Volume & Revenue Trend
            </h5>
            <div style={{ width: '100%', height: 300 }}>
              {analytics?.dailyBookings && analytics.dailyBookings.length > 0 ? (
                <ResponsiveContainer>
                  <LineChart data={analytics.dailyBookings}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" stroke="#2563eb" />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#2563eb" name="Bookings Count" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue (₹)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                  No daily booking trend data available yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category-Wise Demand Bar Chart */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-3 bg-white p-4 h-100">
            <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <BarChart size={20} className="text-success" /> Category-Wise Demand Breakdown
            </h5>
            <div style={{ width: '100%', height: 300 }}>
              {analytics?.categoryDemand ? (
                <ResponsiveContainer>
                  <BarChart data={analytics.categoryDemand} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="category" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Booking Requests" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                  No category demand data available.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Worker Performance Scorecards Table */}
      <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
            <Award size={20} className="text-warning" /> Handyman Performance Scorecards Table
          </h5>
          <input
            type="text"
            className="form-control form-control-sm w-auto"
            placeholder="Search worker or trade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Worker Name</th>
                <th>Trade</th>
                <th>KYC Status</th>
                <th>Completion Rate</th>
                <th>Avg SLA Time</th>
                <th>Rating</th>
                <th>No-Show Strikes</th>
                <th>Badge Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredScorecards.map((sc) => (
                <tr key={sc.workerId}>
                  <td>
                    <div className="fw-bold text-dark">{sc.name}</div>
                    <div className="small text-muted">{sc.phone}</div>
                  </td>
                  <td><span className="badge bg-secondary">{sc.trade}</span></td>
                  <td>
                    <span className={`badge ${sc.verificationStatus === 'Verified' ? 'bg-success' : 'bg-warning text-dark'}`}>
                      {sc.verificationStatus}
                    </span>
                  </td>
                  <td>
                    <span className="fw-bold text-success">{sc.completionRate}%</span>
                    <span className="small text-muted ms-1">({sc.completedCount}/{sc.acceptedCount})</span>
                  </td>
                  <td><span className="fw-semibold text-primary">{sc.avgSlaTimeMinutes || '18'} mins</span></td>
                  <td>
                    <span className="fw-bold text-warning">★ {sc.rating ? sc.rating.toFixed(1) : '5.0'}</span>
                  </td>
                  <td>
                    <span className={`badge ${sc.noShowCount > 0 ? 'bg-danger' : 'bg-light text-dark border'}`}>
                      {sc.noShowCount} Strikes
                    </span>
                  </td>
                  <td>
                    {sc.trustedWorkerBadge ? (
                      <span className="badge bg-warning text-dark fw-bold">🏆 Trusted Worker</span>
                    ) : (
                      <span className="badge bg-light text-muted border">Standard</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredScorecards.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-muted">
                    No worker scorecards found matching search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
