import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService, getApiBase } from '../services/api';
import AddWorkerModal from '../components/AddWorkerModal';
import AdminLocations from '../components/AdminLocations';

import { useLanguage } from '../context/LanguageContext';
import socket from '../services/socket';
import { ShieldCheck, CheckCircle2, XCircle, TrendingUp, Users, DollarSign, Activity, Wrench, RefreshCw, Plus, Trash2, MapPin, Phone, UserX, UserCheck, Search, Award, FileText, BookOpen, Wallet, Percent, ChevronDown, AlertTriangle, Bot, Sparkles, MessageSquare } from 'lucide-react';
import './AdminPanel.css';

const AdminPanel = () => {
  const { t, tTrade } = useLanguage();
  const [activeTab, setActiveTab] = useState('workers'); // 'workers' | 'customers' | 'pending_kyc' | 'review_flags'
  const [metrics, setMetrics] = useState({
    totalCaptains: 0,
    activeCaptains: 0,
    verifiedCaptains: 0,
    totalCustomers: 0,
    totalBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
  });
  const [dispatchStats, setDispatchStats] = useState(null);

  const [workers, setWorkers] = useState([]);
  const [pendingCaptains, setPendingCaptains] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [adminBookings, setAdminBookings] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');
  const [commissionConfig, setCommissionConfig] = useState(null);
  const [commissionEdit, setCommissionEdit] = useState({ commissionPercent: 10, cashbackPercent: 0 });
  const [walletOverview, setWalletOverview] = useState({ totalLiability: 0, wallets: [] });
  const [loading, setLoading] = useState(false);
  const [actionToast, setActionToast] = useState('');
  const [slaAlerts, setSlaAlerts] = useState([]);
  const [slaRisks, setSlaRisks] = useState([]);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);

  // AI Skill Verification Inspection Modal state
  const [aiModalWorker, setAiModalWorker] = useState(null);
  const [aiModalSession, setAiModalSession] = useState(null);
  const [aiModalLoading, setAiModalLoading] = useState(false);

  // AI Review Insights Modal state
  const [aiInsightsWorker, setAiInsightsWorker] = useState(null);
  const [aiInsightsData, setAiInsightsData] = useState(null);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);

  const [sosAlerts, setSosAlerts] = useState([]);
  const [highRiskBookings, setHighRiskBookings] = useState([]);
  const [reviewFlags, setReviewFlags] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('smartfix_token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };
      const apiBase = getApiBase();

      const [
        workerList,
        pendingList,
        customerList,
        data,
        bkgs,
        cfg,
        wov,
        sosRes,
        disputesRes,
        highRiskRes,
        dispatchRes,
        reviewFlagsRes
      ] = await Promise.all([
        apiService.getWorkers().catch(() => []),
        apiService.getPendingCaptains('Pending').catch(() => []),
        apiService.getAdminCustomers().catch(() => []),
        apiService.getAdminAnalytics().catch(() => null),
        apiService.getAdminBookings().catch(() => []),
        apiService.getCommissionConfig().catch(() => null),
        apiService.getWalletOverview().catch(() => null),
        fetch(`${apiBase}/admin/sos-alerts`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${apiBase}/admin/disputes`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${apiBase}/admin/bookings/high-risk`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${apiBase}/admin/dispatch-stats`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${apiBase}/admin/review-flags?status=Open`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (workerList && Array.isArray(workerList)) setWorkers(workerList);
      if (pendingList && Array.isArray(pendingList)) setPendingCaptains(pendingList);
      if (customerList && Array.isArray(customerList)) setCustomers(customerList);
      if (data && data.analytics) setMetrics(data.analytics);
      if (bkgs) setAdminBookings(bkgs);
      if (disputesRes && disputesRes.disputes) setDisputes(disputesRes.disputes);
      if (highRiskRes && highRiskRes.bookings) setHighRiskBookings(highRiskRes.bookings);
      if (cfg) {
        setCommissionConfig(cfg);
        setCommissionEdit({ commissionPercent: cfg.commissionPercent, cashbackPercent: cfg.cashbackPercent || 0 });
      }
      if (wov) setWalletOverview(wov);
      if (sosRes && sosRes.alerts) setSosAlerts(sosRes.alerts);
      if (dispatchRes) setDispatchStats(dispatchRes);
      if (reviewFlagsRes && reviewFlagsRes.flags) setReviewFlags(reviewFlagsRes.flags);

    } catch (e) {
      console.warn('Admin load data notice:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const resolveSosAlert = async (alertId) => {
    try {
      const token = localStorage.getItem('smartfix_token');
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/admin/sos-alerts/${alertId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ notes: 'Resolved by Admin from Console' }),
      });
      if (res.ok) {
        setActionToast('🚨 SOS Alert marked as resolved.');
        setTimeout(() => setActionToast(''), 3000);
        loadData();
      }
    } catch (err) {}
  };

  const handleResolveDispute = async (id, status, decision, notes) => {
    try {
      const token = localStorage.getItem('smartfix_token');
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/admin/disputes/${id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ status, adminDecision: decision, adminNotes: notes }),
      });
      if (res.ok) {
        setActionToast('✅ Dispute resolved successfully.');
        setTimeout(() => setActionToast(''), 3000);
        loadData();
      }
    } catch (err) {}
  };

  const handleViewAiInsights = async (worker) => {
    setAiInsightsWorker(worker);
    setAiInsightsData(null);
    setAiInsightsLoading(true);
    try {
      const token = localStorage.getItem('smartfix_token');
      const res = await fetch(`${getApiBase()}/admin/workers/${worker._id || worker.id}/review-insights`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (res.ok) {
        const data = await res.json();
        setAiInsightsData(data);
      } else {
        setActionToast('Failed to load AI Insights');
        setTimeout(() => setActionToast(''), 3000);
      }
    } catch (e) {
      setActionToast('Error loading AI Insights');
      setTimeout(() => setActionToast(''), 3000);
    } finally {
      setAiInsightsLoading(false);
    }
  };

  const loadAdminBookings = async (status) => {

    const bkgs = await apiService.getAdminBookings(status);
    setAdminBookings(bkgs);
  };

  const handleSaveCommission = async () => {
    const updated = await apiService.updateCommissionConfig(commissionEdit);
    if (updated) {
      setCommissionConfig(updated);
      setActionToast('Commission configuration saved successfully!');
      setTimeout(() => setActionToast(''), 4000);
    }
  };

  useEffect(() => {
    loadData();

    // Join admin room for real-time SLA breach notifications
    if (socket) {
      socket.emit('join-admin-room');
      
      const handleSlaBreach = (payload) => {
        setSlaAlerts((prev) => [{ ...payload, id: Date.now() }, ...prev].slice(0, 5));
      };
      socket.on('sla-breach-alert', handleSlaBreach);

      const handleHighRisk = (booking) => {
        setHighRiskBookings((prev) => {
          if (prev.some(b => (b._id || b.id) === (booking._id || booking.id))) return prev;
          return [booking, ...prev];
        });
      };
      socket.on('new-high-risk-booking', handleHighRisk);

      const handleSlaRisk = (payload) => {
        setSlaRisks((prev) => {
          if (prev.some(r => r.bookingId === payload.bookingId)) return prev;
          return [payload, ...prev];
        });
      };
      socket.on('admin-sla-risk', handleSlaRisk);

      return () => {
        socket.off('sla-breach-alert', handleSlaBreach);
        socket.off('new-high-risk-booking', handleHighRisk);
        socket.off('admin-sla-risk', handleSlaRisk);
      };
    }
  }, []);

  const handleWorkerAdded = (newWorker) => {
    setWorkers((prev) => [newWorker, ...prev.filter((w) => (w._id || w.id) !== (newWorker._id || newWorker.id))]);
    setActionToast(`Worker "${newWorker.name}" added successfully!`);
    setTimeout(() => setActionToast(''), 4000);
  };

  const handleVerifyCaptain = async (cId, name, status) => {
    try {
      const aiVerdict = aiModalSession?.aiRecommendation?.verdict || 'none';
      await apiService.verifyCaptain(cId, status, '');
      await apiService.logAdminAuditDecision(cId, status === 'Verified' ? 'approved' : 'rejected', aiVerdict);

      setActionToast(`Partner ${name} status updated to '${status}' successfully!`);
      setTimeout(() => setActionToast(''), 4000);
      setAiModalWorker(null);
      loadData();
    } catch (err) {
      alert(`Error updating verification status: ${err.message}`);
    }
  };

  const handleInspectAiInterview = async (worker) => {
    console.log("Inspecting AI Interview for worker:", worker);
    setAiModalWorker(worker);
    setAiModalLoading(true);
    setAiModalSession(null);
    try {
      const session = await apiService.getWorkerInterview(worker._id || worker.id);
      console.log("Fetched AI Session:", session);
      if (!session) {
        alert("Session is null! Worker may not have completed the test, or an error occurred.");
      }
      setAiModalSession(session);
    } catch (e) {
      console.error("Error inspecting AI Interview:", e);
      alert("Error fetching session: " + e.message);
    }
    setAiModalLoading(false);
  };

  const handleToggleBlockCustomer = async (id, name) => {
    try {
      const res = await apiService.toggleBlockCustomer(id);
      if (res && res.user) {
        setActionToast(res.message);
        setCustomers((prev) =>
          prev.map((c) => ((c._id || c.id) === id ? { ...c, isBlocked: res.user.isBlocked } : c))
        );
      }
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
    setTimeout(() => setActionToast(''), 4000);
  };

  const handleDeleteWorker = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete worker "${name}"?`)) return;
    await apiService.deleteWorker(id);
    setWorkers((prev) => prev.filter((w) => (w._id || w.id) !== id));
    setActionToast(`Worker "${name}" deleted.`);
    setTimeout(() => setActionToast(''), 4000);
  };

  const handleReviewFlagAction = async (flagId, action) => {
    if (!window.confirm(`Are you sure you want to ${action} this flagged review?`)) return;
    try {
      const token = localStorage.getItem('smartfix_token');
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/admin/review-flags/${flagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, adminNotes: `Action taken by admin` })
      });
      if (res.ok) {
        setReviewFlags((prev) => prev.filter((f) => f._id !== flagId));
        setActionToast(`Review successfully ${action}ed.`);
        setTimeout(() => setActionToast(''), 4000);
      } else {
        alert('Failed to process flag action');
      }
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  };

  return (
    <div className="container admin-panel-page" style={{ padding: '32px 16px' }}>
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', color: '#0f172a', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={28} color="#2563eb" /> {t('admin_title')}
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>Manage worker KYC verification, customer accounts, and platform analytics.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setShowAddWorkerModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#2563eb', color: '#ffffff', border: '1px solid #2563eb', padding: '8px 16px', height: '40px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            <Plus size={18} /> Add New Worker
          </button>
          <button
            onClick={loadData}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 16px', height: '40px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {actionToast && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontWeight: '700' }}>
          ✅ {actionToast}
        </div>
      )}

      {/* Real-time SLA Breach Alerts */}
      {slaAlerts.length > 0 && (
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {slaAlerts.map((alert) => (
            <div
              key={alert.id}
              style={{ background: '#fff7ed', border: '2px solid #fb923c', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}
            >
              <AlertTriangle size={22} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '800', color: '#9a3412', fontSize: '0.95rem' }}>
                  🚨 SLA Breach Alert — Booking #{String(alert.bookingId || '').slice(-8).toUpperCase()}
                </div>
                <div style={{ color: '#c2410c', fontSize: '0.85rem', marginTop: '4px' }}>
                  <strong>{alert.trade}</strong> · Worker: {alert.workerName} · Customer: {alert.customerName}
                  {alert.address && <span> · 📍 {alert.address}</span>}
                </div>
                <div style={{ color: '#78350f', fontSize: '0.8rem', marginTop: '2px' }}>
                  Worker arrived after 1-hour SLA deadline. Immediate action required.
                </div>
              </div>
              <button
                onClick={() => setSlaAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ea580c', fontWeight: '700', fontSize: '1.2rem', flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* SLA Risks (Proactive Predictions) */}
      {slaRisks.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ background: '#fefce8', border: '2px solid #facc15', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(250, 204, 21, 0.1)' }}>
            <h4 style={{ color: '#a16207', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={24} /> ⚡ Likely SLA Breaches ({slaRisks.length})
            </h4>
            <p style={{ color: '#854d0e', fontSize: '0.9rem', margin: '6px 0 16px 0' }}>
              AI Prediction: These workers are likely to arrive late based on their current location and travel time.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {slaRisks.map((risk, index) => (
                <div key={`${risk.bookingId}-${index}`} style={{ background: '#ffffff', border: '1px solid #fef08a', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#1e293b' }}>
                      Booking #{String(risk.bookingId || '').slice(-8).toUpperCase()}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '4px' }}>
                      Worker: <strong>{risk.workerName}</strong> | Customer: <strong>{risk.customerName}</strong>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#ea580c', marginTop: '4px', display: 'flex', gap: '15px' }}>
                      <span>📍 Distance: {risk.distanceMeters}m</span>
                      <span>⏱️ ETA: {new Date(risk.predictedArrival).toLocaleTimeString()}</span>
                      <span style={{ fontWeight: 'bold' }}>⚠️ {risk.minutesLate} mins late</span>
                    </div>
                    {risk.explanation && (
                      <div style={{ marginTop: '8px', padding: '8px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.85rem', color: '#334155', borderLeft: '3px solid #cbd5e1' }}>
                        <strong>🤖 AI Assessment:</strong> {risk.explanation}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSlaRisks((prev) => prev.filter((r) => r.bookingId !== risk.bookingId))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ca8a04', fontWeight: '700', fontSize: '1.2rem', flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* High-Risk Cancellation/No-Show Bookings Section */}
      {highRiskBookings.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ background: '#fff1f2', border: '2px solid #e11d48', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(225, 29, 72, 0.1)' }}>
            <h4 style={{ color: '#be123c', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={24} /> ⚠️ High-Risk Pending Bookings ({highRiskBookings.length})
            </h4>
            <p style={{ color: '#881337', fontSize: '0.9rem', margin: '6px 0 16px 0' }}>
              These bookings are highly likely to be cancelled by the customer. Please review and proactively confirm to prevent SLA issues.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {highRiskBookings.map(bkg => (
                <div key={bkg._id || bkg.id} style={{ background: '#ffffff', border: '1px solid #fecdd3', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span style={{ background: '#ffe4e6', color: '#e11d48', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                      {bkg.trade?.toUpperCase()} - {bkg.status}
                    </span>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#1e293b', marginTop: '8px' }}>
                      Customer: {bkg.customer?.name} ({bkg.customer?.phone})
                    </div>
                    {bkg.worker && (
                      <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '4px' }}>
                        Assigned Worker: {bkg.worker.name}
                      </div>
                    )}
                    <div style={{ marginTop: '8px' }}>
                      <strong style={{ fontSize: '0.8rem', color: '#9f1239' }}>Risk Factors:</strong>
                      <ul style={{ fontSize: '0.8rem', color: '#be123c', margin: '4px 0 0', paddingLeft: '20px' }}>
                        {(bkg.riskFactors || []).map((factor, i) => (
                          <li key={i}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <a href={`tel:${bkg.customer?.phone}`} style={{ textDecoration: 'none' }}>
                      <button style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <Phone size={16} /> Call Customer
                      </button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Emergency SOS Alerts Section */}
      {sosAlerts && sosAlerts.filter(a => a.status === 'open').length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 12px rgba(239,68,68,0.15)' }}>
            <h4 style={{ color: '#b91c1c', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={24} className="animate-bounce" /> 🚨 URGENT EMERGENCY SOS ALERTS ({sosAlerts.filter(a => a.status === 'open').length})
            </h4>
            <p style={{ color: '#7f1d1d', fontSize: '0.9rem', margin: '6px 0 16px 0' }}>
              Immediate attention required! Active emergency alerts triggered by customers or service providers.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sosAlerts.filter(a => a.status === 'open').map(alert => (
                <div key={alert._id} style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span style={{ background: '#dc2626', color: '#ffffff', fontSize: '0.75rem', fontWeight: '800', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase', marginRight: '8px' }}>
                      {alert.triggeredBy || 'Emergency'} Triggered
                    </span>
                    <strong style={{ color: '#0f172a' }}>Booking #{alert.booking?._id || alert.booking}</strong>
                    <div style={{ color: '#334155', fontSize: '0.85rem', marginTop: '4px' }}>
                      Triggered by: <strong>{alert.user?.name || 'User'} ({alert.user?.phone || 'N/A'})</strong> • Role: <em>{alert.user?.role}</em>
                    </div>
                    {alert.notes && <div style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '2px' }}>"{alert.notes}"</div>}
                  </div>
                  <button
                    onClick={() => resolveSosAlert(alert._id)}
                    style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Mark Resolved ✅
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Verified Active Handymen</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>{workers.length} Workers</div>
          <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '4px', fontWeight: '700' }}>🟢 All Regions</div>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Pending KYC Approval</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#d97706', marginTop: '6px' }}>{pendingCaptains.length} Pending</div>
          <div style={{ fontSize: '0.8rem', color: '#d97706', marginTop: '4px', fontWeight: '700' }}>⏳ Awaiting Document Review</div>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Registered Customers</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#2563eb', marginTop: '6px' }}>{customers.length} Customers</div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Active User Accounts</div>
        </div>

        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ color: '#475569', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#8b5cf6" /> AI Smart Dispatch
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
            {dispatchStats?.avgAttemptsPerBooking || 0} avg attempts
          </div>
          <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '4px', fontWeight: '700', display: 'flex', gap: '8px' }}>
            <span>⏱️ {dispatchStats?.avgTimeToAcceptSec || 0}s to accept</span>
            <span style={{ color: '#e11d48' }}>❌ {dispatchStats?.dispatchFailureRate || 0}% fail rate</span>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', padding: '20px', borderRadius: '16px', color: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>10% Platform Commission Revenue</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#34d399', marginTop: '6px' }}>₹{Math.round((metrics.totalRevenue || 0) * 0.10)}</div>
          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>Total Gross Volume: <strong>₹{metrics.totalRevenue || 0}</strong></div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <Link
          to="/admin/analytics"
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
          <TrendingUp size={18} /> Analytics & Scorecards 📊
        </Link>

        <button
          onClick={() => setActiveTab('workers')}
          style={{
            background: activeTab === 'workers' ? '#0f172a' : '#ffffff',
            color: activeTab === 'workers' ? '#ffffff' : '#475569',
            border: '1px solid #cbd5e1',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Wrench size={18} /> Verified Workers Directory ({workers.length})
        </button>

        <button
          onClick={() => setActiveTab('pending_kyc')}
          style={{
            background: activeTab === 'pending_kyc' ? '#d97706' : '#ffffff',
            color: activeTab === 'pending_kyc' ? '#ffffff' : '#475569',
            border: '1px solid #cbd5e1',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ShieldCheck size={18} /> {t('pending_verification_queue')} ({pendingCaptains.length})
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          style={{
            background: activeTab === 'customers' ? '#0f172a' : '#ffffff',
            color: activeTab === 'customers' ? '#ffffff' : '#475569',
            border: '1px solid #cbd5e1',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={18} /> {t('customer_management')} ({customers.length})
        </button>

        <button
          onClick={() => setActiveTab('bookings')}
          style={{
            background: activeTab === 'bookings' ? '#7c3aed' : '#ffffff',
            color: activeTab === 'bookings' ? '#ffffff' : '#475569',
            border: '1px solid #cbd5e1',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BookOpen size={18} /> Bookings ({adminBookings.length})
        </button>

        <button
          onClick={() => setActiveTab('review_flags')}
          style={{
            background: activeTab === 'review_flags' ? '#e11d48' : '#ffffff',
            color: activeTab === 'review_flags' ? '#ffffff' : '#475569',
            border: '1px solid #cbd5e1',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={18} /> Review Flags ({reviewFlags?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('disputes')}
          style={{
            background: activeTab === 'disputes' ? '#e11d48' : '#ffffff',
            color: activeTab === 'disputes' ? '#ffffff' : '#475569',
            border: '1px solid #cbd5e1',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={18} /> Disputes ({disputes.length})
        </button>

        <button
          onClick={() => setActiveTab('commission')}
          style={{
            background: activeTab === 'commission' ? '#0369a1' : '#ffffff',
            color: activeTab === 'commission' ? '#ffffff' : '#475569',
            border: '1px solid #cbd5e1',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Percent size={18} /> Commission Config
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          style={{
            background: activeTab === 'wallet' ? '#166534' : '#ffffff',
            color: activeTab === 'wallet' ? '#ffffff' : '#475569',
            border: '1px solid #cbd5e1',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Wallet size={18} /> Wallet Overview
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          style={{
            background: activeTab === 'locations' ? '#4f46e5' : '#ffffff',
            color: activeTab === 'locations' ? '#ffffff' : '#475569',
            border: '1px solid #cbd5e1',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <MapPin size={18} /> Service Locations
        </button>
      </div>

      {activeTab === 'locations' && <AdminLocations />}

      {/* TAB 1: VERIFIED WORKER DIRECTORY */}
      {activeTab === 'workers' && (
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={22} color="#059669" /> Verified Worker Directory
          </h2>

          {workers.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <Users size={48} color="#94a3b8" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: '800', marginBottom: '6px' }}>No Verified Workers Found</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Approve pending KYC workers or add workers manually.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px' }}>Worker Name</th>
                    <th style={{ padding: '12px' }}>Trade / Specialty</th>
                    <th style={{ padding: '12px' }}>Location</th>
                    <th style={{ padding: '12px' }}>Phone Number</th>
                    <th style={{ padding: '12px' }}>Rate / Hour</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w) => {
                    const wId = w._id || w.id;
                    return (
                      <tr key={wId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 12px', fontWeight: '700', color: '#0f172a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.4rem' }}>{w.avatar || '👨‍🔧'}</span>
                            <div>
                              <div>{w.name}</div>
                              <small style={{ color: '#059669', fontWeight: 'bold' }}>🟢 Verified</small>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 12px', color: '#2563eb', fontWeight: '600' }}>
                          <Wrench size={13} style={{ display: 'inline', marginRight: '4px' }} /> {tTrade(w.trade)}
                        </td>
                        <td style={{ padding: '14px 12px', color: '#475569' }}>
                          <MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} /> {w.location || 'Unknown Location'}
                        </td>
                        <td style={{ padding: '14px 12px', color: '#475569' }}>
                          <Phone size={13} style={{ display: 'inline', marginRight: '4px' }} /> {w.phone}
                        </td>
                        <td style={{ padding: '14px 12px', fontWeight: '800', color: '#059669' }}>
                          ₹{w.ratePerHour}/hr
                        </td>
                        <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleViewAiInsights(w)}
                            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '6px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}
                          >
                            <Sparkles size={14} /> {t('ai_insights', 'AI Insights')}
                          </button>
                          <button
                            onClick={() => handleDeleteWorker(wId, w.name)}
                            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '6px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING KYC WORKER QUEUE */}
      {activeTab === 'pending_kyc' && (
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={22} color="#d97706" /> {t('pending_verification_queue')}
          </h2>

          {pendingCaptains.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
              <CheckCircle2 size={48} color="#166534" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <h3 style={{ fontSize: '1.1rem', color: '#166534', fontWeight: '800', marginBottom: '6px' }}>No Pending Verification Requests</h3>
              <p style={{ color: '#15803d', fontSize: '0.9rem' }}>All registered handymen are currently verified!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {pendingCaptains.map((c) => {
                const cId = c._id || c.id;
                return (
                  <div key={cId} style={{ border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: '16px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, fontWeight: '800', color: '#9a3412', fontSize: '1.1rem' }}>{c.name}</h4>
                      <span style={{ background: '#ffedd5', color: '#9a3412', fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '20px', border: '1px solid #fdba74' }}>
                        ⏳ Pending KYC
                      </span>
                    </div>

                    <div style={{ fontSize: '0.88rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                      <div><strong>Trade:</strong> {tTrade(c.trade)}</div>
                      <div><strong>Location:</strong> 📍 {c.location}</div>
                      <div><strong>Phone:</strong> 📞 {c.phone}</div>

                    </div>

                    <button
                      onClick={() => handleInspectAiInterview(c)}
                      style={{ width: '100%', marginBottom: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '8px 12px', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Bot size={16} /> Inspect AI Skill Interview 🤖
                    </button>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => {
                           // AI KYC Logic trigger
                           setAiModalWorker(c);
                           setAiModalLoading(true);
                           // Since we don't have real images in DB, we'll simulate the AI Vision call with a prompt for demo
                           fetch(`${getApiBase()}/ai/verify-kyc`, {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('smartfix_token')}` },
                             body: JSON.stringify({ image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/' }) // Fake base64 for demo if no real doc
                           }).then(res => res.json()).then(data => {
                             alert(`🤖 AI Vision Analysis Complete:\nDocument: ${data.analysis.documentType}\nClear & Readable: ${data.analysis.isClearAndReadable}\nVerdict: ${data.analysis.looksSuspicious ? 'Suspicious ⚠️' : 'Looks Valid ✅'}\nReason: ${data.analysis.suspicionReason || 'N/A'}`);
                             setAiModalLoading(false);
                           }).catch(err => {
                             alert('AI Check Failed: ' + err.message);
                             setAiModalLoading(false);
                           });
                        }}
                        style={{ width: '100%', marginBottom: '12px', background: '#f59e0b', border: '1px solid #d97706', color: '#ffffff', padding: '8px 12px', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        {aiModalLoading && aiModalWorker?._id === cId ? <RefreshCw size={16} className="spin" /> : <Camera size={16} />}
                        AI Vision Check 👁️
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handleVerifyCaptain(cId, c.name, 'Verified')}
                        style={{ flex: 1, background: '#059669', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <CheckCircle2 size={16} /> {t('approve_btn')}
                      </button>
                      <button
                        onClick={() => handleVerifyCaptain(cId, c.name, 'Rejected')}
                        style={{ flex: 1, background: '#dc2626', color: '#ffffff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <XCircle size={16} /> {t('reject_btn')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REGISTERED CUSTOMERS MANAGEMENT */}
      {activeTab === 'customers' && (
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="#2563eb" /> {t('customer_management')}
          </h2>

          {customers.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <Users size={48} color="#94a3b8" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: '800', marginBottom: '6px' }}>No Customer Accounts Registered Yet</h3>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px' }}>Customer Name</th>
                    <th style={{ padding: '12px' }}>Phone Number</th>
                    <th style={{ padding: '12px' }}>Location</th>
                    <th style={{ padding: '12px' }}>Total Bookings</th>
                    <th style={{ padding: '12px' }}>Account Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Admin Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const cId = c._id || c.id;
                    return (
                      <tr key={cId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 12px', fontWeight: '700', color: '#0f172a' }}>
                          👤 {c.name}
                        </td>
                        <td style={{ padding: '14px 12px', color: '#475569' }}>
                          📞 {c.phone}
                        </td>
                        <td style={{ padding: '14px 12px', color: '#475569' }}>
                          📍 {c.location || 'Location Not Set'}
                        </td>
                        <td style={{ padding: '14px 12px', fontWeight: '800', color: '#2563eb' }}>
                          {c.totalBookingsCount || 0} Bookings
                        </td>
                        <td style={{ padding: '14px 12px' }}>
                          {c.isBlocked ? (
                            <span style={{ background: '#fef2f2', color: '#dc2626', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', border: '1px solid #fecaca', fontSize: '0.8rem' }}>
                              🚫 Blocked / Suspended
                            </span>
                          ) : (
                            <span style={{ background: '#f0fdf4', color: '#166534', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', border: '1px solid #bbf7d0', fontSize: '0.8rem' }}>
                              🟢 Active Customer
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleToggleBlockCustomer(cId, c.name)}
                            style={{
                              background: c.isBlocked ? '#f0fdf4' : '#fef2f2',
                              border: c.isBlocked ? '1px solid #bbf7d0' : '1px solid #fecaca',
                              color: c.isBlocked ? '#166534' : '#dc2626',
                              padding: '6px 14px',
                              borderRadius: '8px',
                              fontWeight: '700',
                              fontSize: '0.82rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            {c.isBlocked ? <UserCheck size={14} /> : <UserX size={14} />}
                            {c.isBlocked ? t('unblock_btn') : t('block_btn')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ALL BOOKINGS */}
      {activeTab === 'bookings' && (
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={22} color="#7c3aed" /> Platform Bookings
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={bookingStatusFilter}
                onChange={(e) => { setBookingStatusFilter(e.target.value); loadAdminBookings(e.target.value); }}
                style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Confirmed">Confirmed</option>
                <option value="InProgress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {adminBookings.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <BookOpen size={48} color="#94a3b8" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <h3 style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: '800', marginBottom: '6px' }}>No Bookings Found</h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Platform bookings will appear here once customers start booking.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px' }}>Booking ID</th>
                    <th style={{ padding: '12px' }}>Customer</th>
                    <th style={{ padding: '12px' }}>Worker</th>
                    <th style={{ padding: '12px' }}>Trade / Sub-Service</th>
                    <th style={{ padding: '12px' }}>Amount</th>
                    <th style={{ padding: '12px' }}>Commission (10%)</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Payment</th>
                    <th style={{ padding: '12px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {adminBookings.map((b) => {
                    const bId = b._id || b.id;
                    const isSLABreach = b.slaBreached;
                    const commission10 = Math.round((b.price || 0) * 0.10);
                    return (
                      <tr
                        key={bId}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isSLABreach ? '#fff7ed' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '12px', fontFamily: 'monospace', color: '#64748b', fontSize: '0.78rem' }}>
                          {isSLABreach && <span title="SLA Breach"><AlertTriangle size={13} color="#d97706" style={{ marginRight: '4px' }} /></span>}
                          {String(bId).slice(-8).toUpperCase()}
                        </td>
                        <td style={{ padding: '12px', fontWeight: '700', color: '#0f172a' }}>
                          {b.customer?.name || b.customerName || '—'}
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{b.customer?.phone || ''}</div>
                        </td>
                        <td style={{ padding: '12px', color: '#2563eb', fontWeight: '600' }}>
                          {b.worker?.name || b.workerName || '—'}
                        </td>
                        <td style={{ padding: '12px', color: '#475569' }}>
                          {b.trade || '—'}
                          {b.subServices && b.subServices.length > 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#7c3aed' }}>{b.subServices.slice(0, 2).join(', ')}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontWeight: '800', color: '#059669' }}>₹{b.price || 0}</td>
                        <td style={{ padding: '12px', fontWeight: '700', color: '#0369a1' }}>₹{commission10}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.76rem',
                            fontWeight: '800',
                            background: b.status === 'Completed' ? '#f0fdf4' : b.status === 'Cancelled' ? '#fef2f2' : '#eff6ff',
                            color: b.status === 'Completed' ? '#166534' : b.status === 'Cancelled' ? '#dc2626' : '#1d4ed8',
                            border: `1px solid ${b.status === 'Completed' ? '#bbf7d0' : b.status === 'Cancelled' ? '#fecaca' : '#bfdbfe'}`,
                          }}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.76rem',
                            fontWeight: '800',
                            background: b.paymentStatus === 'Paid' ? '#f0fdf4' : '#fff7ed',
                            color: b.paymentStatus === 'Paid' ? '#166534' : '#92400e',
                          }}>
                            {b.paymentStatus || 'Unpaid'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: '#64748b', fontSize: '0.8rem' }}>
                          {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-IN') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: COMMISSION CONFIG */}
      {activeTab === 'commission' && (
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Percent size={22} color="#0369a1" /> Commission & Cashback Configuration
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div style={{ background: '#eff6ff', borderRadius: '16px', padding: '20px', border: '1px solid #bfdbfe' }}>
              <div style={{ color: '#1e40af', fontWeight: '800', fontSize: '0.85rem', marginBottom: '12px' }}>PLATFORM COMMISSION %</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={commissionEdit.commissionPercent}
                  onChange={(e) => setCommissionEdit((prev) => ({ ...prev, commissionPercent: Number(e.target.value) }))}
                  style={{ width: '80px', padding: '10px', borderRadius: '10px', border: '1px solid #93c5fd', fontSize: '1.1rem', fontWeight: '800', textAlign: 'center' }}
                />
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1e40af' }}>%</span>
                <span style={{ fontSize: '0.8rem', color: '#3b82f6' }}>of each booking price</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '8px', marginBottom: 0 }}>
                Current live value: <strong>{commissionConfig?.commissionPercent ?? 10}%</strong>. Changes take effect immediately.
              </p>
            </div>

            <div style={{ background: '#f0fdf4', borderRadius: '16px', padding: '20px', border: '1px solid #bbf7d0' }}>
              <div style={{ color: '#166534', fontWeight: '800', fontSize: '0.85rem', marginBottom: '12px' }}>CASHBACK / PROMO DISCOUNT %</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={commissionEdit.cashbackPercent}
                  onChange={(e) => setCommissionEdit((prev) => ({ ...prev, cashbackPercent: Number(e.target.value) }))}
                  style={{ width: '80px', padding: '10px', borderRadius: '10px', border: '1px solid #86efac', fontSize: '1.1rem', fontWeight: '800', textAlign: 'center' }}
                />
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#166534' }}>%</span>
                <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>wallet cashback on payment</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '8px', marginBottom: 0 }}>
                Set to 0 to disable cashback promotions.
              </p>
            </div>
          </div>

          <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Revenue Simulation (based on analytics)</div>
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <span>Gross Revenue: <strong style={{ color: '#059669' }}>₹{metrics.totalRevenue || 0}</strong></span>
              <span>Commission ({commissionEdit.commissionPercent}%): <strong style={{ color: '#0369a1' }}>₹{Math.round((metrics.totalRevenue || 0) * commissionEdit.commissionPercent / 100)}</strong></span>
              <span>Handyman Payout: <strong style={{ color: '#7c3aed' }}>₹{Math.round((metrics.totalRevenue || 0) * (1 - commissionEdit.commissionPercent / 100))}</strong></span>
            </div>
          </div>

          <button
            onClick={handleSaveCommission}
            style={{ background: '#0369a1', color: '#ffffff', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <CheckCircle2 size={18} /> Save Commission Configuration
          </button>
        </div>
      )}

      {/* TAB 5.5: DISPUTES */}
      {activeTab === 'disputes' && (
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={22} color="#e11d48" /> Dispute Resolution Desk
          </h2>
          {disputes.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <AlertTriangle size={48} color="#94a3b8" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <p style={{ color: '#64748b' }}>No disputes found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {disputes.map(d => (
                <div key={d._id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h5 style={{ margin: 0, fontWeight: 'bold' }}>Dispute for Booking #{d.bookingId?._id?.slice(-6) || 'Unknown'}</h5>
                    <span className={`badge ${d.status === 'Open' ? 'bg-warning text-dark' : d.status === 'Resolved' ? 'bg-success' : 'bg-secondary'}`}>
                      {d.status}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>
                    <strong>Raised By:</strong> {d.raisedBy?.name} ({d.raisedByRole}) | <strong>Reason:</strong> {d.reason}
                  </p>
                  <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>{d.description}</p>
                  
                  {d.aiSummaryFailed ? (
                    <div className="alert alert-warning py-2 small">AI Summary generation failed or is pending.</div>
                  ) : d.aiSummary ? (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                      <strong className="d-block mb-1 text-primary"><Bot size={14} className="me-1" /> AI Summary & Recommendation</strong>
                      <p className="mb-2 small">{d.aiSummary}</p>
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        <span className="badge bg-primary-subtle text-primary border">Recommendation: {d.aiRecommendation}</span>
                        <span className="badge bg-info-subtle text-info border">Confidence: {d.aiConfidence}</span>
                      </div>
                      <p className="mb-0 small text-muted"><strong>Reasoning:</strong> {d.aiReasoning}</p>
                    </div>
                  ) : (
                    <div className="alert alert-light py-2 small">Generating AI summary...</div>
                  )}

                  {d.status !== 'Resolved' && d.status !== 'Rejected' && (
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const decision = e.target.decision.value;
                        const notes = e.target.notes.value;
                        const status = e.target.status.value;
                        handleResolveDispute(d._id, status, decision, notes);
                      }}
                      style={{ background: '#fff7ed', padding: '12px', borderRadius: '8px', border: '1px solid #fed7aa' }}
                    >
                      <strong className="d-block mb-2 text-dark">Admin Resolution</strong>
                      <div className="row g-2 mb-2">
                        <div className="col-md-6">
                          <select name="decision" className="form-select form-select-sm" required>
                            <option value="">Select Decision</option>
                            <option value="full_refund">Full Refund</option>
                            <option value="partial_refund">Partial Refund</option>
                            <option value="reassign_worker">Reassign Worker</option>
                            <option value="no_action">No Action</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <select name="status" className="form-select form-select-sm" required>
                            <option value="Resolved">Mark as Resolved</option>
                            <option value="Rejected">Reject Dispute</option>
                          </select>
                        </div>
                      </div>
                      <textarea name="notes" className="form-control form-control-sm mb-2" rows="2" placeholder="Admin notes/reasoning..." required></textarea>
                      <button type="submit" className="btn btn-sm btn-success w-100 fw-bold">Submit Decision</button>
                    </form>
                  )}
                  {(d.status === 'Resolved' || d.status === 'Rejected') && (
                    <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <strong className="d-block text-success mb-1">✓ Admin Decision: {d.adminDecision}</strong>
                      <p className="small mb-0 text-muted">{d.adminNotes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: REVIEW FLAGS */}
      {activeTab === 'review_flags' && (
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={22} color="#e11d48" /> Review Flags
          </h2>

          {!reviewFlags || reviewFlags.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <AlertTriangle size={48} color="#94a3b8" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <p style={{ color: '#64748b' }}>No pending review flags.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviewFlags.map(f => (
                <div key={f._id} style={{ border: '1px solid #fecdd3', borderRadius: '12px', padding: '16px', background: '#fff1f2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <h5 style={{ margin: 0, fontWeight: 'bold', color: '#9f1239' }}>Flagged Review - Booking #{f.reviewId?._id?.slice(-6) || 'Unknown'}</h5>
                    <span className="badge bg-danger">Risk Score: {(f.riskScore * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#be123c', marginBottom: '8px' }}>
                    <strong>Customer:</strong> {f.customerId?.name} | <strong>Worker:</strong> {f.workerId?.name}
                  </div>
                  
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #fda4af', marginBottom: '12px' }}>
                    <strong style={{ display: 'block', marginBottom: '4px', color: '#881337' }}>Original Review ({f.reviewId?.rating} ⭐️):</strong>
                    <p style={{ margin: 0, fontStyle: 'italic' }}>"{f.reviewId?.review}"</p>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#9f1239' }}>Detected Signals:</strong>
                    <ul style={{ fontSize: '0.8rem', color: '#be123c', margin: '4px 0 0', paddingLeft: '20px' }}>
                      {f.signals.map((sig, i) => <li key={i}>{sig}</li>)}
                    </ul>
                  </div>

                  {f.aiAssessment && (
                    <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #fecaca' }}>
                      <strong style={{ color: '#b91c1c', fontSize: '0.85rem' }}>AI Reasoning:</strong>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#991b1b', marginTop: '4px' }}>{f.aiAssessment}</p>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                    <button 
                      onClick={() => handleReviewFlagAction(f._id, 'dismiss')}
                      style={{ flex: 1, background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Dismiss (Safe)
                    </button>
                    <button 
                      onClick={() => handleReviewFlagAction(f._id, 'remove')}
                      style={{ flex: 1, background: '#e11d48', color: '#ffffff', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      Remove Fake Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: WALLET OVERVIEW */}
      {activeTab === 'wallet' && (
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={22} color="#166534" /> Platform Wallet Overview
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, #166534, #15803d)', padding: '20px', borderRadius: '16px', color: '#ffffff' }}>
              <div style={{ color: '#bbf7d0', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Total Wallet Liability</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '8px' }}>₹{walletOverview.totalLiability?.toLocaleString('en-IN') || 0}</div>
              <div style={{ fontSize: '0.8rem', color: '#86efac', marginTop: '4px' }}>Combined balance owed to all users</div>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: '16px', padding: '20px', border: '1px solid #bbf7d0' }}>
              <div style={{ color: '#166534', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Active Wallets</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', marginTop: '8px' }}>{walletOverview.wallets?.length || 0}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>User wallets with balance</div>
            </div>
          </div>

          {walletOverview.wallets?.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <Wallet size={48} color="#94a3b8" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <p style={{ color: '#64748b' }}>No wallet data available yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px' }}>User</th>
                    <th style={{ padding: '12px' }}>Phone</th>
                    <th style={{ padding: '12px' }}>Role</th>
                    <th style={{ padding: '12px' }}>Wallet Balance</th>
                    <th style={{ padding: '12px' }}>Txn Count</th>
                  </tr>
                </thead>
                <tbody>
                  {walletOverview.wallets.map((w, idx) => (
                    <tr key={w.userId || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px', fontWeight: '700', color: '#0f172a' }}>{w.name || '—'}</td>
                      <td style={{ padding: '12px', color: '#475569' }}>{w.phone || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.76rem',
                          fontWeight: '800',
                          background: w.role === 'handyman' ? '#eff6ff' : '#f0fdf4',
                          color: w.role === 'handyman' ? '#1d4ed8' : '#166534',
                        }}>
                          {w.role === 'handyman' ? '🛠️ Handyman' : '👤 Customer'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: '800', color: w.balance > 0 ? '#059669' : '#dc2626' }}>
                        ₹{(w.balance || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px', color: '#475569' }}>{w.transactions || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Worker Modal */}
      {showAddWorkerModal && (
        <AddWorkerModal
          onClose={() => setShowAddWorkerModal(false)}
          onWorkerAdded={handleWorkerAdded}
        />
      )}

      {/* AI Skill Assessment Inspection Modal */}
      {aiModalWorker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '650px', maxHeight: '85vh', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bot size={22} color="#60a5fa" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>AI Skill Interview — {aiModalWorker.name}</h3>
              </div>
              <button onClick={() => setAiModalWorker(null)} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '1.2rem', cursor: 'pointer', fontWeight: '700' }}>×</button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {aiModalLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <Sparkles size={32} color="#2563eb" style={{ margin: '0 auto 10px auto', display: 'block' }} />
                  Loading worker AI interview transcript...
                </div>
              ) : !aiModalSession ? (
                <div style={{ padding: '30px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '14px', color: '#9a3412', fontSize: '0.9rem' }}>
                  ⚠️ No interactive AI skill interview session recorded for this worker yet. Worker can complete the live Q&A interview from their partner portal.
                </div>
              ) : (
                <>
                  {/* Advisory AI Recommendation Panel */}
                  <div style={{ background: aiModalSession.aiRecommendation?.verdict === 'pass' ? '#f0fdf4' : aiModalSession.aiRecommendation?.verdict === 'fail' ? '#fef2f2' : '#fff7ed', border: `2px solid ${aiModalSession.aiRecommendation?.verdict === 'pass' ? '#86efac' : aiModalSession.aiRecommendation?.verdict === 'fail' ? '#fca5a5' : '#fde68a'}`, borderRadius: '16px', padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🤖 AI Assessment <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>(Advisory Only — Final decision is yours)</span>
                      </div>
                      <span style={{ background: aiModalSession.aiRecommendation?.verdict === 'pass' ? '#166534' : aiModalSession.aiRecommendation?.verdict === 'fail' ? '#991b1b' : '#9a3412', color: '#ffffff', fontSize: '0.8rem', fontWeight: '800', padding: '4px 12px', borderRadius: '20px', textTransform: 'uppercase' }}>
                        {aiModalSession.aiRecommendation?.verdict || 'Borderline'} (Score: {aiModalSession.aiRecommendation?.confidenceScore || 70}%)
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.4 }}>
                      <strong>AI Summary:</strong> {aiModalSession.aiRecommendation?.summary || 'Completed 5 practical scenario questions.'}
                    </p>

                    {/* Rubric Per-Question Breakdown Table */}
                    {aiModalSession.aiRecommendation?.perQuestionScores && aiModalSession.aiRecommendation.perQuestionScores.length > 0 && (
                      <div style={{ marginTop: '12px', background: '#ffffff', borderRadius: '12px', padding: '12px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1e293b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          📊 Structured Rubric Breakdown (0-25 per criteria)
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'center' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                                <th style={{ padding: '6px 4px', textAlign: 'left' }}>Question</th>
                                <th style={{ padding: '6px 4px' }}>Specificity (25)</th>
                                <th style={{ padding: '6px 4px' }}>Safety (25)</th>
                                <th style={{ padding: '6px 4px' }}>Diagnosis (25)</th>
                                <th style={{ padding: '6px 4px' }}>Clarity (25)</th>
                                <th style={{ padding: '6px 4px' }}>Total (100)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {aiModalSession.aiRecommendation.perQuestionScores.map((q, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 4px', textAlign: 'left', fontWeight: '700', color: '#0f172a' }}>Q{q.question || idx + 1}</td>
                                  <td style={{ padding: '6px 4px', color: '#334155' }}>{q.specificity}</td>
                                  <td style={{ padding: '6px 4px', color: q.safety === 0 ? '#dc2626' : '#334155', fontWeight: q.safety === 0 ? '800' : 'normal' }}>
                                    {q.safety} {q.safety === 0 && '⚠️'}
                                  </td>
                                  <td style={{ padding: '6px 4px', color: '#334155' }}>{q.diagnosisLogic}</td>
                                  <td style={{ padding: '6px 4px', color: '#334155' }}>{q.clarity}</td>
                                  <td style={{ padding: '6px 4px', fontWeight: '800', color: q.total >= 70 ? '#059669' : q.total >= 40 ? '#d97706' : '#dc2626' }}>
                                    {q.total}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {aiModalSession.aiRecommendation?.flaggedConcerns && aiModalSession.aiRecommendation.flaggedConcerns.length > 0 && (
                      <div style={{ marginTop: '10px', fontSize: '0.82rem', color: '#991b1b', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                        <strong>Flagged Concerns:</strong>
                        <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
                          {aiModalSession.aiRecommendation.flaggedConcerns.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Transcript Display */}
                  <h4 style={{ margin: '8px 0 0 0', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>📋 Interview Transcript ({aiModalSession.questionsAsked} of 5 Questions)</h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {aiModalSession.messages?.map((m, idx) => (
                      <div key={idx} style={{ background: m.role === 'assistant' ? '#f8fafc' : '#eff6ff', border: `1px solid ${m.role === 'assistant' ? '#e2e8f0' : '#bfdbfe'}`, padding: '12px 16px', borderRadius: '12px' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.78rem', color: m.role === 'assistant' ? '#64748b' : '#1d4ed8', marginBottom: '2px' }}>
                          {m.role === 'assistant' ? '🤖 AI Question' : `👨‍🔧 ${aiModalWorker.name}'s Answer`}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.4 }}>{m.text}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => handleVerifyCaptain(aiModalWorker._id || aiModalWorker.id, aiModalWorker.name, 'Rejected')}
                style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <XCircle size={16} /> Reject Partner
              </button>
              <button
                onClick={() => handleVerifyCaptain(aiModalWorker._id || aiModalWorker.id, aiModalWorker.name, 'Verified')}
                style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={16} /> Approve Partner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Review Insights Modal */}
      {aiInsightsWorker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '600px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '24px', background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e40af', fontSize: '1.4rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={24} color="#3b82f6" /> {t('ai_review_insights', 'AI Review Insights')}
                </h3>
                <div style={{ color: '#475569', fontSize: '0.9rem', marginTop: '6px', fontWeight: '500' }}>
                  {aiInsightsWorker.name} • {aiInsightsWorker.phone}
                </div>
                <div style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.75rem', fontWeight: '800', padding: '4px 8px', borderRadius: '6px', marginTop: '12px', display: 'inline-block' }}>
                  {t('ai_generated_reference_only', 'AI-generated, for reference only')}
                </div>
              </div>
              <button
                onClick={() => setAiInsightsWorker(null)}
                style={{ background: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', width: '36px', height: '36px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <XCircle size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {aiInsightsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Bot size={48} color="#94a3b8" className="animate-pulse" style={{ margin: '0 auto 16px auto', display: 'block' }} />
                  <h4 style={{ color: '#475569', margin: 0 }}>{t('analyzing_review_data', 'Analyzing review data...')}</h4>
                </div>
              ) : aiInsightsData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Summary section */}
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={16} /> {t('ai_summary', 'AI Summary')}
                    </h4>
                    {aiInsightsData.summary?.en ? (
                      <p style={{ margin: 0, color: '#1e293b', fontSize: '0.95rem', lineHeight: 1.5, fontWeight: '500' }}>
                        {t('ai_summary_content', aiInsightsData.summary.en)}
                      </p>
                    ) : (
                      <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>
                        {t('not_enough_reviews_summary', 'Not enough reviews for a summary (need 5+). Total analyzed: {{count}}').replace('{{count}}', aiInsightsData.totalAnalyzed)}
                      </p>
                    )}
                  </div>

                  {/* Aspect scores */}
                  <div>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#334155' }}>{t('aspect_scores_out_of_5', 'Aspect Scores (out of 5)')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {['punctuality', 'behaviour', 'cleanliness', 'price_fairness'].map(asp => {
                        const score = aiInsightsData.averages[asp];
                        const displayScore = score !== null ? score.toFixed(1) : 'N/A';
                        const pct = score !== null ? (score / 5) * 100 : 0;
                        const barColor = score >= 4 ? '#10b981' : score >= 2.5 ? '#f59e0b' : '#ef4444';
                        
                        return (
                          <div key={asp}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', color: '#475569', fontWeight: '600', textTransform: 'capitalize' }}>
                              <span>{asp.replace('_', ' ')}</span>
                              <span>{displayScore}</span>
                            </div>
                            <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                              {score !== null && (
                                <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '4px' }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Suspicious reviews badge */}
                  {aiInsightsData.suspiciousCount > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <button 
                        onClick={() => {
                          setAiInsightsWorker(null);
                          setActiveTab('review_flags');
                        }}
                        style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', width: '100%', justifyContent: 'center' }}
                      >
                        <AlertTriangle size={16} />
                        {aiInsightsData.suspiciousCount > 1 
                          ? t('view_suspicious_reviews_plural', 'View {{count}} Suspicious Reviews').replace('{{count}}', aiInsightsData.suspiciousCount)
                          : t('view_suspicious_reviews', 'View {{count}} Suspicious Review').replace('{{count}}', aiInsightsData.suspiciousCount)
                        }
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#ef4444' }}>
                  {t('failed_load_data', 'Failed to load data.')}
                </div>
              )}
            </div>
            
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAiInsightsWorker(null)}
                style={{ background: '#cbd5e1', color: '#334155', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
              >
                {t('close_btn', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
