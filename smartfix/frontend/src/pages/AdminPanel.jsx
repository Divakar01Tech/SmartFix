import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { apiService, getApiBase } from '../services/api';
import AddWorkerModal from '../components/AddWorkerModal';
import AdminLocations from '../components/AdminLocations';

import { useLanguage } from '../context/LanguageContext';
import socket from '../services/socket';
import { ShieldCheck, CheckCircle2, XCircle, TrendingUp, Users, DollarSign, Activity, Wrench, RefreshCw, Plus, Trash2, MapPin, Phone, UserX, UserCheck, Search, Award, FileText, BookOpen, Wallet, Percent, ChevronDown, AlertTriangle, Bot, Sparkles, MessageSquare, Camera, Eye, ExternalLink, CreditCard, Download } from 'lucide-react';
import './AdminPanel.css';

const AdminPanel = ({ initialTab }) => {
  const location = useLocation();
  const { t, tTrade } = useLanguage();

  const getTabFromPath = () => {
    if (initialTab) return initialTab;
    const p = location.pathname;
    if (p.includes('/kyc')) return 'pending_kyc';
    if (p.includes('/bookings')) return 'bookings';
    if (p.includes('/settings')) return 'commission';
    if (p.includes('/wallet')) return 'wallet';
    if (p.includes('/payments')) return 'payments';
    return 'workers';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else {
      const p = location.pathname;
      if (p.includes('/kyc')) setActiveTab('pending_kyc');
      else if (p.includes('/bookings')) setActiveTab('bookings');
      else if (p.includes('/settings')) setActiveTab('commission');
      else if (p.includes('/wallet')) setActiveTab('wallet');
      else if (p.includes('/payments')) setActiveTab('payments');
    }
  }, [initialTab, location.pathname]);
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
  const [adminPayments, setAdminPayments] = useState([]);
  const [paymentStats, setPaymentStats] = useState({
    totalVolume: 0,
    totalCommission: 0,
    totalProviderPayout: 0,
    totalBonusCredited: 0,
    totalWalletLiability: 0,
    count: 0,
    paidCount: 0,
  });
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionToast, setActionToast] = useState('');
  const [slaAlerts, setSlaAlerts] = useState([]);
  const [slaRisks, setSlaRisks] = useState([]);
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);

  // Customer Inactivity and Deletion state
  const [inactiveCustomerCount, setInactiveCustomerCount] = useState(0);
  const [customerFilter, setCustomerFilter] = useState('all'); // 'all' | 'inactive'
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCleaningInactive, setIsCleaningInactive] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState(null);

  // Worker Rejection with Reason Modal state
  const [rejectionModalWorker, setRejectionModalWorker] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [rejectionSubmitting, setRejectionSubmitting] = useState(false);

  // Worker Control & Feedback Directives Modal state
  const [workerControlModal, setWorkerControlModal] = useState(null);
  const [workerFeedbackMessage, setWorkerFeedbackMessage] = useState('');
  const [workerFeedbackType, setWorkerFeedbackType] = useState('instruction');
  const [workerControlAction, setWorkerControlAction] = useState('none');
  const [workerFeedbacksList, setWorkerFeedbacksList] = useState([]);
  const [workerFeedbackLoading, setWorkerFeedbackLoading] = useState(false);
  const [workerFeedbackSubmitting, setWorkerFeedbackSubmitting] = useState(false);

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
  const [kycDocModal, setKycDocModal] = useState(null);
  const [aiVisionWorkerId, setAiVisionWorkerId] = useState(null);
  const [aiVisionResultModal, setAiVisionResultModal] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('hm_admin_token') || localStorage.getItem('smartfix_token');
      const headers = { 'Authorization': token ? `Bearer ${token}` : '' };
      const apiBase = getApiBase();

      const [
        workerList,
        pendingList,
        customerRes,
        data,
        bkgs,
        cfg,
        wov,
        sosRes,
        disputesRes,
        highRiskRes,
        dispatchRes,
        reviewFlagsRes,
        paymentsRes
      ] = await Promise.all([
        apiService.getWorkers().catch(() => []),
        apiService.getPendingCaptains('Pending').catch(() => []),
        apiService.getAdminCustomersData().catch(() => ({ customers: [], inactiveOneMonthCount: 0 })),
        apiService.getAdminAnalytics().catch(() => null),
        apiService.getAdminBookings().catch(() => []),
        apiService.getCommissionConfig().catch(() => null),
        apiService.getWalletOverview().catch(() => null),
        fetch(`${apiBase}/admin/sos-alerts`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${apiBase}/admin/disputes`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${apiBase}/admin/bookings/high-risk`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${apiBase}/admin/dispatch-stats`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${apiBase}/admin/review-flags?status=Open`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        apiService.getAdminPayments().catch(() => null),
      ]);

      if (workerList && Array.isArray(workerList)) setWorkers(workerList);
      if (pendingList && Array.isArray(pendingList)) setPendingCaptains(pendingList);
      if (customerRes) {
        if (Array.isArray(customerRes)) {
          setCustomers(customerRes);
        } else if (customerRes.customers) {
          setCustomers(customerRes.customers);
          setInactiveCustomerCount(customerRes.inactiveOneMonthCount || 0);
        }
      }
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
      if (paymentsRes && paymentsRes.payments) {
        setAdminPayments(paymentsRes.payments);
        if (paymentsRes.stats) setPaymentStats(paymentsRes.stats);
      }

    } catch (e) {
      console.warn('Admin load data notice:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const resolveSosAlert = async (alertId) => {
    try {
      const token = localStorage.getItem('hm_admin_token') || localStorage.getItem('smartfix_token');
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
      const token = localStorage.getItem('hm_admin_token') || localStorage.getItem('smartfix_token');
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
      const token = localStorage.getItem('hm_admin_token') || localStorage.getItem('smartfix_token');
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

  const handleApproveWorker = async (cId, name) => {
    try {
      const aiVerdict = aiModalSession?.aiRecommendation?.verdict || 'none';
      await apiService.verifyCaptain(cId, 'Verified', '');
      await apiService.logAdminAuditDecision(cId, 'approved', aiVerdict).catch(() => null);

      setActionToast(`🎉 Partner ${name} approved! Assigned unique Worker ID & email notification sent.`);
      setTimeout(() => setActionToast(''), 4500);
      setAiModalWorker(null);
      loadData();
    } catch (err) {
      alert(`Error approving partner: ${err.message}`);
    }
  };

  const handleOpenRejectModal = (worker) => {
    setRejectionModalWorker(worker);
    setRejectionReasonInput('');
  };

  const handleSubmitRejection = async () => {
    if (!rejectionReasonInput.trim()) {
      alert('Please provide a mandatory reason for rejecting this application (e.g. document unreadable, certification criteria unmet).');
      return;
    }
    setRejectionSubmitting(true);
    try {
      const cId = rejectionModalWorker._id || rejectionModalWorker.id;
      const name = rejectionModalWorker.name;
      const aiVerdict = aiModalSession?.aiRecommendation?.verdict || 'none';
      await apiService.verifyCaptain(cId, 'Rejected', rejectionReasonInput.trim());
      await apiService.logAdminAuditDecision(cId, 'rejected', aiVerdict).catch(() => null);

      setActionToast(`Partner application for ${name} rejected with reason sent to email.`);
      setTimeout(() => setActionToast(''), 4500);
      setRejectionModalWorker(null);
      setAiModalWorker(null);
      loadData();
    } catch (err) {
      alert(`Error rejecting partner: ${err.message}`);
    } finally {
      setRejectionSubmitting(false);
    }
  };

  const handleVerifyCaptain = async (cId, name, status) => {
    if (status === 'Rejected') {
      const workerObj = pendingCaptains.find(p => (p._id || p.id) === cId) || { _id: cId, name };
      handleOpenRejectModal(workerObj);
      return;
    }
    await handleApproveWorker(cId, name);
  };

  const handleCleanupInactiveCustomers = async () => {
    if (!window.confirm(`⚠️ CONFIRM CUSTOMER PURGE:\n\nAre you sure you want to permanently delete all ${inactiveCustomerCount} customer accounts that have had NO usage or bookings for over 1 month (30 days)?\n\nThis will remove dormant accounts and free platform resources. This action cannot be undone.`)) {
      return;
    }
    setIsCleaningInactive(true);
    try {
      const res = await apiService.cleanupInactiveCustomers();
      setActionToast(`🧹 Cleaned up ${res.count || 0} customer accounts inactive for > 1 month.`);
      setTimeout(() => setActionToast(''), 4500);
      loadData();
    } catch (err) {
      alert(`Cleanup failed: ${err.message}`);
    } finally {
      setIsCleaningInactive(false);
    }
  };

  const handleDeleteCustomer = async (cId, name) => {
    if (!window.confirm(`Permanently delete customer account for "${name}"?\n\nThis customer account will be completely removed. This cannot be undone.`)) {
      return;
    }
    setDeletingCustomerId(cId);
    try {
      await apiService.deleteCustomer(cId);
      setActionToast(`Customer account "${name}" permanently deleted.`);
      setTimeout(() => setActionToast(''), 4000);
      loadData();
    } catch (err) {
      alert(`Failed to delete customer: ${err.message}`);
    } finally {
      setDeletingCustomerId(null);
    }
  };

  const handleOpenWorkerControl = async (worker) => {
    setWorkerControlModal(worker);
    setWorkerFeedbackMessage('');
    setWorkerFeedbackType('instruction');
    setWorkerControlAction('none');
    setWorkerFeedbackLoading(true);
    try {
      const res = await apiService.getWorkerFeedback(worker._id || worker.id);
      setWorkerFeedbacksList(res.feedbacks || []);
    } catch (err) {
      setWorkerFeedbacksList(worker.adminFeedbacks || []);
    } finally {
      setWorkerFeedbackLoading(false);
    }
  };

  const handleSubmitWorkerFeedback = async () => {
    if (!workerFeedbackMessage.trim()) {
      alert('Please enter a feedback message or directive for the worker.');
      return;
    }
    setWorkerFeedbackSubmitting(true);
    try {
      const wId = workerControlModal._id || workerControlModal.id;
      await apiService.sendWorkerFeedback(wId, {
        message: workerFeedbackMessage.trim(),
        feedbackType: workerFeedbackType,
        action: workerControlAction,
      });
      setActionToast(`Directive & action sent to ${workerControlModal.name}. Email delivered!`);
      setTimeout(() => setActionToast(''), 4500);
      setWorkerControlModal(null);
      loadData();
    } catch (err) {
      alert(`Error submitting feedback: ${err.message}`);
    } finally {
      setWorkerFeedbackSubmitting(false);
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
      const token = localStorage.getItem('hm_admin_token') || localStorage.getItem('smartfix_token');
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
        <div 
          onClick={() => setActiveTab('workers')}
          style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: activeTab === 'workers' ? '2px solid #0f172a' : '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Click to view Verified Workers Directory"
        >
          <div style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Verified Active Handymen</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>{workers.length} Workers</div>
          <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '4px', fontWeight: '700' }}>🟢 All Regions</div>
        </div>

        <div 
          onClick={() => setActiveTab('pending_kyc')}
          style={{ background: activeTab === 'pending_kyc' ? '#fffbeb' : '#ffffff', padding: '20px', borderRadius: '16px', border: activeTab === 'pending_kyc' ? '2px solid #d97706' : '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Click to view Pending KYC Verification Queue"
        >
          <div style={{ color: '#64748b', fontSize: '0.82rem', fontWeight: '700', textTransform: 'uppercase' }}>Pending KYC Approval</div>
          <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#d97706', marginTop: '6px' }}>{pendingCaptains.length} Pending</div>
          <div style={{ fontSize: '0.8rem', color: '#d97706', marginTop: '4px', fontWeight: '700' }}>⏳ Awaiting Document Review</div>
        </div>

        <div 
          onClick={() => setActiveTab('customers')}
          style={{ background: activeTab === 'customers' ? '#eff6ff' : '#ffffff', padding: '20px', borderRadius: '16px', border: activeTab === 'customers' ? '2px solid #2563eb' : '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.2s ease' }}
          title="Click to view Customer Accounts"
        >
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
          onClick={() => setActiveTab('payments')}
          style={{
            background: activeTab === 'payments' ? '#2563eb' : '#ffffff',
            color: activeTab === 'payments' ? '#ffffff' : '#475569',
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
          <CreditCard size={18} /> Payments & Revenue ({adminPayments.length})
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
                            {w.avatar && (w.avatar.startsWith('http://') || w.avatar.startsWith('https://') || w.avatar.startsWith('/')) ? (
                              <img src={w.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <span style={{ fontSize: '1.4rem' }}>{w.avatar || '👨‍🔧'}</span>
                            )}
                            <div>
                              <div>{w.name} {w.workerId && <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>{w.workerId}</span>}</div>
                              {w.isBlocked ? (
                                <small style={{ color: '#dc2626', fontWeight: 'bold' }}>🛑 Blocked</small>
                              ) : (w.isSuspended || w.verificationStatus === 'suspended') ? (
                                <small style={{ color: '#d97706', fontWeight: 'bold' }}>⏸️ Suspended</small>
                              ) : (
                                <small style={{ color: '#059669', fontWeight: 'bold' }}>🟢 Verified</small>
                              )}
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
                            onClick={() => handleOpenWorkerControl(w)}
                            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '6px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}
                            title="Direct feedback, warnings, praise & admin control"
                          >
                            <MessageSquare size={14} /> Control & Feedback
                          </button>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={22} color="#d97706" /> {t('pending_verification_queue')}
            </h2>
            <span style={{ fontSize: '0.85rem', background: '#fef3c7', color: '#92400e', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', border: '1px solid #fde68a' }}>
              ⏳ {pendingCaptains.length} Workers Awaiting Verification
            </span>
          </div>

          {pendingCaptains.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
              <CheckCircle2 size={48} color="#166534" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <h3 style={{ fontSize: '1.1rem', color: '#166534', fontWeight: '800', marginBottom: '6px' }}>No Pending Verification Requests</h3>
              <p style={{ color: '#15803d', fontSize: '0.9rem' }}>All registered handymen and workers are currently verified!</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
              {pendingCaptains.map((c) => {
                const cId = c._id || c.id;
                const token = localStorage.getItem('hm_admin_token') || localStorage.getItem('smartfix_token') || '';
                const apiBase = getApiBase();
                const aadhaarDisplay = c.kyc?.aadhaarLast4 ? `XXXX-XXXX-${c.kyc.aadhaarLast4}` : (c.aadhaarNumber || 'Not specified');
                const secondIdTypeDisplay = c.kyc?.secondIdType || c.idProofType || 'Second ID / DL';
                const secondIdLast4Display = c.kyc?.secondIdLast4 ? `XXXX-${c.kyc.secondIdLast4}` : (c.idProofNumber || '');
                const hasAadhaarFront = !!(c.kyc?.aadhaarFrontPath || c.aadhaarDocUrl);
                const hasAadhaarBack = !!(c.kyc?.aadhaarBackPath);
                const hasSecondId = !!(c.kyc?.secondIdPath || c.idProofDocUrl);

                return (
                  <div key={cId} style={{ border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 14px rgba(217, 119, 6, 0.08)' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h4 style={{ margin: 0, fontWeight: '800', color: '#9a3412', fontSize: '1.2rem' }}>{c.name}</h4>
                        <span style={{ background: '#ffedd5', color: '#9a3412', fontSize: '0.78rem', fontWeight: '800', padding: '4px 12px', borderRadius: '20px', border: '1px solid #fdba74' }}>
                          ⏳ Pending KYC
                        </span>
                      </div>

                      <div style={{ fontSize: '0.88rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                        <div><strong>Trade:</strong> {tTrade(c.trade || (c.categories && c.categories[0]) || 'General Maintenance')}</div>
                        <div><strong>Location:</strong> 📍 {c.location || (c.district ? `${c.district}, ${c.state || 'Tamil Nadu'}` : 'Not Specified')}</div>
                        <div><strong>Phone:</strong> 📞 {c.phone}</div>
                        {c.email && <div><strong>Email:</strong> ✉️ {c.email}</div>}
                      </div>

                      {/* Submitted Documents Box */}
                      <div style={{ background: '#ffffff', borderRadius: '12px', padding: '14px', border: '1px solid #fed7aa', marginBottom: '16px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#9a3412', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          🪪 Submitted Identity &amp; Documents
                        </div>
                        <div style={{ fontSize: '0.83rem', color: '#334155', marginBottom: '6px' }}>
                          <strong>Aadhaar Number:</strong> {aadhaarDisplay}
                        </div>
                        <div style={{ fontSize: '0.83rem', color: '#334155', marginBottom: '10px' }}>
                          <strong>{secondIdTypeDisplay}:</strong> {secondIdLast4Display || 'Submitted'}
                        </div>

                        {/* Document View Buttons */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {hasAadhaarFront && (
                            <button
                              type="button"
                              onClick={() => setKycDocModal({
                                workerName: c.name,
                                docTitle: 'Aadhaar Card (Front)',
                                docUrl: `${apiBase}/admin/workers/${cId}/kyc/aadhaarFront?token=${token}`
                              })}
                              style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <Eye size={14} /> Aadhaar Front
                            </button>
                          )}
                          {hasAadhaarBack && (
                            <button
                              type="button"
                              onClick={() => setKycDocModal({
                                workerName: c.name,
                                docTitle: 'Aadhaar Card (Back)',
                                docUrl: `${apiBase}/admin/workers/${cId}/kyc/aadhaarBack?token=${token}`
                              })}
                              style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <Eye size={14} /> Aadhaar Back
                            </button>
                          )}
                          {hasSecondId && (
                            <button
                              type="button"
                              onClick={() => setKycDocModal({
                                workerName: c.name,
                                docTitle: secondIdTypeDisplay,
                                docUrl: `${apiBase}/admin/workers/${cId}/kyc/secondId?token=${token}`
                              })}
                              style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <Eye size={14} /> {secondIdTypeDisplay}
                            </button>
                          )}
                          {!hasAadhaarFront && !hasAadhaarBack && !hasSecondId && (
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                              ⚠️ No uploaded file attachments found
                            </div>
                          )}
                        </div>
                      </div>

                      {/* AI Skill Assessment Review */}
                      <button
                        onClick={() => handleInspectAiInterview(c)}
                        style={{ width: '100%', marginBottom: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '9px 12px', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        <Bot size={16} /> Inspect AI Skill Interview 🤖
                      </button>

                      {/* AI Vision Verification */}
                      <button
                        onClick={async () => {
                          setAiVisionWorkerId(cId);
                          try {
                            const res = await fetch(`${apiBase}/ai/verify-kyc`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                              body: JSON.stringify({ workerId: cId, docKey: 'aadhaarFront' })
                            });
                            const data = await res.json();
                            if (data.analysis) {
                              setAiVisionResultModal({ worker: c, analysis: data.analysis });
                            } else {
                              alert(data.message || 'AI KYC verification completed with no structured response.');
                            }
                          } catch (err) {
                            alert('AI Check Failed: ' + err.message);
                          } finally {
                            setAiVisionWorkerId(null);
                          }
                        }}
                        disabled={aiVisionWorkerId === cId}
                        style={{ width: '100%', marginBottom: '16px', background: '#f59e0b', border: '1px solid #d97706', color: '#ffffff', padding: '9px 12px', borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        {aiVisionWorkerId === cId ? <RefreshCw size={16} className="spin" /> : <Camera size={16} />}
                        AI Document Vision Check 👁️
                      </button>
                    </div>

                    {/* Action Buttons: Approve / Reject */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                      <button
                        onClick={() => handleVerifyCaptain(cId, c.name, 'Verified')}
                        style={{ flex: 1, background: '#059669', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.92rem', boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)' }}
                      >
                        <CheckCircle2 size={18} /> {t('approve_btn')}
                      </button>
                      <button
                        onClick={() => handleVerifyCaptain(cId, c.name, 'Rejected')}
                        style={{ flex: 1, background: '#dc2626', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.92rem', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.2)' }}
                      >
                        <XCircle size={18} /> {t('reject_btn')}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={22} color="#2563eb" /> {t('customer_management')} & Inactivity Lifecycle
            </h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '20px', fontWeight: '700' }}>
                Total: {customers.length}
              </span>
              <span style={{ fontSize: '0.82rem', background: '#dcfce7', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontWeight: '700' }}>
                Active: {Math.max(0, customers.length - inactiveCustomerCount)}
              </span>
              <span style={{ fontSize: '0.82rem', background: inactiveCustomerCount > 0 ? '#fee2e2' : '#f1f5f9', color: inactiveCustomerCount > 0 ? '#991b1b' : '#64748b', padding: '6px 12px', borderRadius: '20px', fontWeight: '700' }}>
                Inactive (&gt; 1 Month): {inactiveCustomerCount}
              </span>
            </div>
          </div>

          {/* Inactive Accounts Notice & Purge Banner */}
          {inactiveCustomerCount > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '16px', padding: '18px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 300px' }}>
                <AlertTriangle size={26} color="#d97706" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '800', color: '#92400e', fontSize: '0.98rem' }}>
                    {inactiveCustomerCount} Dormant Customer Accounts Without Usage for &gt; 1 Month
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#b45309', marginTop: '2px' }}>
                    These accounts have been registered for at least 30 days and have zero bookings or service usage in the last month.
                  </div>
                </div>
              </div>
              <button
                onClick={handleCleanupInactiveCustomers}
                disabled={isCleaningInactive}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '0.86rem',
                  cursor: isCleaningInactive ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(220,38,38,0.25)',
                }}
              >
                <Trash2 size={16} />
                {isCleaningInactive ? 'Cleaning Up Accounts...' : `Clean Up Inactive Accounts (${inactiveCustomerCount})`}
              </button>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setCustomerFilter('all')}
                style={{
                  background: customerFilter === 'all' ? '#0f172a' : '#f8fafc',
                  color: customerFilter === 'all' ? '#ffffff' : '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                All Accounts ({customers.length})
              </button>
              <button
                onClick={() => setCustomerFilter('inactive')}
                style={{
                  background: customerFilter === 'inactive' ? '#dc2626' : '#f8fafc',
                  color: customerFilter === 'inactive' ? '#ffffff' : '#475569',
                  border: '1px solid #cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                ⚠️ Inactive (&gt; 1 Month) ({inactiveCustomerCount})
              </button>
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

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
                    <th style={{ padding: '12px' }}>Customer Profile</th>
                    <th style={{ padding: '12px' }}>Email & Contact</th>
                    <th style={{ padding: '12px' }}>Location</th>
                    <th style={{ padding: '12px' }}>Total Bookings</th>
                    <th style={{ padding: '12px' }}>Usage / Inactivity</th>
                    <th style={{ padding: '12px' }}>Account Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Admin Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .filter((c) => {
                      if (customerFilter === 'inactive' && !c.isInactiveOneMonth) return false;
                      if (customerSearchQuery) {
                        const q = customerSearchQuery.toLowerCase();
                        const matchName = c.name?.toLowerCase().includes(q) || c.fullName?.toLowerCase().includes(q);
                        const matchEmail = c.email?.toLowerCase().includes(q);
                        const matchPhone = c.phone?.toLowerCase().includes(q);
                        const matchLoc = c.location?.toLowerCase().includes(q);
                        if (!matchName && !matchEmail && !matchPhone && !matchLoc) return false;
                      }
                      return true;
                    })
                    .map((c) => {
                      const cId = c._id || c.id;
                      return (
                        <tr key={cId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 12px', fontWeight: '700', color: '#0f172a' }}>
                            <div>👤 {c.name || c.fullName}</div>
                            {c.customerId && (
                              <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                {c.customerId}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 12px', color: '#475569' }}>
                            <div style={{ fontSize: '0.85rem' }}>✉️ {c.email || 'No Email'}</div>
                            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>📞 {c.phone}</div>
                          </td>
                          <td style={{ padding: '14px 12px', color: '#475569' }}>
                            📍 {c.location || 'Sivagangai'}
                          </td>
                          <td style={{ padding: '14px 12px', fontWeight: '800', color: '#2563eb' }}>
                            {c.totalBookingsCount || 0} Bookings
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            {c.isInactiveOneMonth ? (
                              <span style={{ background: '#fef2f2', color: '#dc2626', fontWeight: '800', padding: '4px 8px', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '0.78rem' }}>
                                ⚠️ Inactive ({c.daysInactive || 30}+ days)
                              </span>
                            ) : (
                              <span style={{ background: '#f0fdf4', color: '#166534', fontWeight: '800', padding: '4px 8px', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.78rem' }}>
                                🟢 Active ({c.daysInactive || 0}d ago)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            {c.isBlocked ? (
                              <span style={{ background: '#fef2f2', color: '#dc2626', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', border: '1px solid #fecaca', fontSize: '0.8rem' }}>
                                🚫 Blocked
                              </span>
                            ) : (
                              <span style={{ background: '#f0fdf4', color: '#166534', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', border: '1px solid #bbf7d0', fontSize: '0.8rem' }}>
                                🟢 Active
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                onClick={() => handleToggleBlockCustomer(cId, c.name)}
                                style={{
                                  background: c.isBlocked ? '#f0fdf4' : '#f8fafc',
                                  border: c.isBlocked ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                                  color: c.isBlocked ? '#166534' : '#475569',
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  fontWeight: '700',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {c.isBlocked ? <UserCheck size={14} /> : <UserX size={14} />}
                                {c.isBlocked ? t('unblock_btn') : t('block_btn')}
                              </button>
                              <button
                                onClick={() => handleDeleteCustomer(cId, c.name)}
                                disabled={deletingCustomerId === cId}
                                title="Delete Customer Account"
                                style={{
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  fontWeight: '700',
                                  fontSize: '0.8rem',
                                  cursor: deletingCustomerId === cId ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Trash2 size={14} />
                                {deletingCustomerId === cId ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
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

      {/* TAB: PAYMENTS & FINANCIAL SETTLEMENT */}
      {activeTab === 'payments' && (
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={22} color="#2563eb" /> Razorpay Payments, Commission & Wallet Liability
              </h2>
              <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                Real-time financial reconciliation, commission earnings, and customer cashback credits.
              </p>
            </div>
            <button
              onClick={loadData}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Ledger
            </button>
          </div>

          {/* 5 Financial Summary Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', padding: '18px', borderRadius: '16px', color: '#ffffff' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase' }}>Total Volume</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '6px' }}>₹{(paymentStats.totalVolume || 0).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '4px' }}>{paymentStats.paidCount || 0} Paid of {paymentStats.count || 0} Orders</div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', padding: '18px', borderRadius: '16px', color: '#ffffff' }}>
              <div style={{ color: '#bfdbfe', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase' }}>Platform Commission</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '6px' }}>₹{(paymentStats.totalCommission || 0).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.78rem', color: '#93c5fd', marginTop: '4px' }}>Net Platform Retained Cut</div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #065f46, #059669)', padding: '18px', borderRadius: '16px', color: '#ffffff' }}>
              <div style={{ color: '#a7f3d0', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase' }}>Worker Payouts</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', marginTop: '6px' }}>₹{(paymentStats.totalProviderPayout || 0).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.78rem', color: '#6ee7b7', marginTop: '4px' }}>Credited to Provider Wallets</div>
            </div>

            <div style={{ background: '#fffbeb', borderRadius: '16px', padding: '18px', border: '1px solid #fde68a' }}>
              <div style={{ color: '#b45309', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase' }}>Customer Rewards</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#d97706', marginTop: '6px' }}>₹{(paymentStats.totalBonusCredited || 0).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.78rem', color: '#92400e', marginTop: '4px' }}>5% Cashback Credited</div>
            </div>

            <div style={{ background: '#f0fdf4', borderRadius: '16px', padding: '18px', border: '1px solid #bbf7d0' }}>
              <div style={{ color: '#166534', fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase' }}>Wallet Liability</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#15803d', marginTop: '6px' }}>₹{(paymentStats.totalWalletLiability || 0).toLocaleString('en-IN')}</div>
              <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '4px' }}>Total Active Balances</div>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexGrow: 1, minWidth: '240px' }}>
              <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by Booking ID, Customer, Worker, Order ID..."
                value={paymentSearchQuery}
                onChange={(e) => setPaymentSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.88rem' }}
              />
            </div>

            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              style={{ padding: '9px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.88rem', background: '#ffffff', color: '#334155', fontWeight: '600' }}
            >
              <option value="all">All Payment Statuses ({adminPayments.length})</option>
              <option value="paid">Paid ({adminPayments.filter(p => p.status === 'paid').length})</option>
              <option value="created">Created / Pending ({adminPayments.filter(p => p.status === 'created').length})</option>
              <option value="failed">Failed ({adminPayments.filter(p => p.status === 'failed').length})</option>
            </select>
          </div>

          {/* Payments Table */}
          {adminPayments.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <CreditCard size={48} color="#94a3b8" style={{ margin: '0 auto 12px auto', display: 'block' }} />
              <p style={{ color: '#64748b', margin: 0 }}>No payment transactions found in system.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px' }}>Order / Txn ID</th>
                    <th style={{ padding: '12px' }}>Booking</th>
                    <th style={{ padding: '12px' }}>Customer</th>
                    <th style={{ padding: '12px' }}>Worker</th>
                    <th style={{ padding: '12px' }}>Price</th>
                    <th style={{ padding: '12px' }}>Wallet</th>
                    <th style={{ padding: '12px' }}>Razorpay</th>
                    <th style={{ padding: '12px' }}>Commission</th>
                    <th style={{ padding: '12px' }}>Worker Share</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {adminPayments
                    .filter((p) => {
                      if (paymentStatusFilter !== 'all' && p.status !== paymentStatusFilter) return false;
                      if (!paymentSearchQuery.trim()) return true;
                      const q = paymentSearchQuery.toLowerCase();
                      const bId = String(p.booking?._id || p.booking?.id || p.booking || '').toLowerCase();
                      const cName = String(p.customer?.name || '').toLowerCase();
                      const wName = String(p.provider?.name || '').toLowerCase();
                      const ordId = String(p.razorpayOrderId || '').toLowerCase();
                      const payId = String(p.razorpayPaymentId || '').toLowerCase();
                      return bId.includes(q) || cName.includes(q) || wName.includes(q) || ordId.includes(q) || payId.includes(q);
                    })
                    .map((p, idx) => {
                      const bId = p.booking?._id || p.booking?.id || p.booking;
                      const isPaid = p.status === 'paid';
                      const dateStr = p.paidAt || p.createdAt ? new Date(p.paidAt || p.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : '—';

                      return (
                        <tr key={p._id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0f172a', fontSize: '0.8rem' }}>
                              {p.razorpayOrderId || '—'}
                            </div>
                            {p.razorpayPaymentId && (
                              <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748b' }}>
                                {p.razorpayPaymentId}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <strong style={{ color: '#2563eb' }}>#{String(bId).slice(-6)}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.booking?.trade || 'Service'}</div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{p.customer?.name || 'Customer'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.customer?.phone || p.customer?.email}</div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{p.provider?.name || 'Worker'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.provider?.trade}</div>
                          </td>
                          <td style={{ padding: '12px', fontWeight: '700', color: '#0f172a' }}>₹{p.amountTotal}</td>
                          <td style={{ padding: '12px' }}>
                            {p.walletUsed > 0 ? (
                              <span style={{ color: '#16a34a', fontWeight: '700' }}>-₹{p.walletUsed}</span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>₹0</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', fontWeight: '800', color: '#2563eb' }}>₹{p.amountPaid}</td>
                          <td style={{ padding: '12px', fontWeight: '700', color: '#d97706' }}>₹{p.commission || 0}</td>
                          <td style={{ padding: '12px', fontWeight: '700', color: '#059669' }}>₹{p.workerPayout || 0}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '800',
                              background: isPaid ? '#dcfce7' : p.status === 'failed' ? '#fee2e2' : '#fef3c7',
                              color: isPaid ? '#15803d' : p.status === 'failed' ? '#b91c1c' : '#b45309',
                            }}>
                              {isPaid ? '✓ Paid' : p.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px', color: '#64748b', fontSize: '0.8rem' }}>{dateStr}</td>
                        </tr>
                      );
                    })}
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

      {/* KYC Document Full Preview Modal */}
      {kycDocModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '750px', maxHeight: '90vh', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>
                  📄 {kycDocModal.docTitle} — {kycDocModal.workerName}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Verified Document Inspection</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <a
                  href={kycDocModal.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: '#334155', color: '#f8fafc', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', textDecoration: 'none', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <ExternalLink size={14} /> Full View
                </a>
                <button
                  onClick={() => setKycDocModal(null)}
                  style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '1.4rem', cursor: 'pointer', fontWeight: '700' }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f8fafc' }}>
              <img
                src={kycDocModal.docUrl}
                alt={kycDocModal.docTitle}
                style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', border: '1px solid #cbd5e1' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                }}
              />
              <div style={{ display: 'none', padding: '30px', textAlign: 'center', color: '#64748b' }}>
                <p style={{ margin: 0, fontWeight: '700', color: '#dc2626' }}>Could not render preview directly.</p>
                <a href={kycDocModal.docUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: '700', marginTop: '8px', display: 'inline-block' }}>
                  Click here to download or open document file
                </a>
              </div>
            </div>

            <div style={{ padding: '14px 24px', background: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setKycDocModal(null)}
                style={{ background: '#0f172a', color: '#ffffff', border: 'none', padding: '8px 20px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
              >
                Done Inspecting
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Vision Verification Results Modal */}
      {aiVisionResultModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '580px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: '#ffffff', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} color="#f59e0b" /> AI Document Vision Inspection
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                  Partner: <strong>{aiVisionResultModal.worker.name}</strong>
                </span>
              </div>
              <button
                onClick={() => setAiVisionResultModal(null)}
                style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '1.4rem', cursor: 'pointer', fontWeight: '700' }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: aiVisionResultModal.analysis?.looksSuspicious ? '#fef2f2' : '#f0fdf4',
                border: `2px solid ${aiVisionResultModal.analysis?.looksSuspicious ? '#fca5a5' : '#86efac'}`,
                borderRadius: '16px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '800', fontSize: '1rem', color: aiVisionResultModal.analysis?.looksSuspicious ? '#991b1b' : '#166534' }}>
                    {aiVisionResultModal.analysis?.looksSuspicious ? '⚠️ Document Flagged as Suspicious' : '✅ Document Appears Authentic & Valid'}
                  </span>
                  <span style={{ background: aiVisionResultModal.analysis?.looksSuspicious ? '#dc2626' : '#16a34a', color: '#ffffff', fontWeight: '800', fontSize: '0.78rem', padding: '4px 10px', borderRadius: '20px' }}>
                    Confidence: {aiVisionResultModal.analysis?.confidenceScore || 0}%
                  </span>
                </div>
                {aiVisionResultModal.analysis?.suspicionReason && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#991b1b' }}>
                    <strong>Reason:</strong> {aiVisionResultModal.analysis.suspicionReason}
                  </p>
                )}
              </div>

              <div style={{ background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Detected Document Type:</span>
                  <span style={{ fontWeight: '800', color: '#0f172a' }}>{aiVisionResultModal.analysis?.documentType || 'Unknown'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Name Extracted on ID:</span>
                  <span style={{ fontWeight: '800', color: '#0f172a' }}>{aiVisionResultModal.analysis?.nameFound || 'Not detected'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Text Readability:</span>
                  <span style={{ fontWeight: '800', color: aiVisionResultModal.analysis?.isClearAndReadable ? '#166534' : '#dc2626' }}>
                    {aiVisionResultModal.analysis?.isClearAndReadable ? 'Clear & Legible ✅' : 'Blurry / Unreadable ❌'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '10px 14px', borderRadius: '10px' }}>
                💡 <em>Note: AI vision assessment is provided as an administrative aid. Final approval or rejection authority rests with the human administrator.</em>
              </div>
            </div>

            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setAiVisionResultModal(null)}
                style={{ background: '#0f172a', color: '#ffffff', border: 'none', padding: '10px 22px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
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
                onClick={() => handleOpenRejectModal(aiModalWorker)}
                style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <XCircle size={16} /> Reject Partner
              </button>
              <button
                onClick={() => handleApproveWorker(aiModalWorker._id || aiModalWorker.id, aiModalWorker.name)}
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

      {/* Mandatory Reason Worker Rejection Modal */}
      {rejectionModalWorker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '520px', borderRadius: '22px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', borderBottom: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#991b1b', fontSize: '1.2rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={22} color="#dc2626" /> Reject Worker Application
              </h3>
              <button onClick={() => setRejectionModalWorker(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <XCircle size={20} />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.92rem', color: '#334155', lineHeight: 1.5 }}>
                You are rejecting the partner application for <strong>{rejectionModalWorker.name}</strong>. Please provide a mandatory reason explaining what documents or criteria need correction.
              </p>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Quick Reason Templates:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    'Aadhaar / KYC photo is blurry or unreadable.',
                    'Trade experience does not meet platform criteria.',
                    'AI skill assessment score below required threshold.',
                    'Name on government ID does not match registration.',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRejectionReasonInput(preset)}
                      style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', color: '#334155' }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                Feedback / Rejection Reason (Mandatory):
              </label>
              <textarea
                rows={4}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Specify why the application cannot be approved and what the worker must fix..."
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }}
              />

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginTop: '12px', fontSize: '0.8rem', color: '#64748b' }}>
                ℹ️ An automated email containing this feedback will be dispatched to <strong>{rejectionModalWorker.email || 'the applicant'}</strong>.
              </div>
            </div>
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setRejectionModalWorker(null)}
                style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', padding: '9px 18px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRejection}
                disabled={rejectionSubmitting}
                style={{ background: '#dc2626', border: 'none', color: '#ffffff', padding: '9px 18px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <XCircle size={16} /> {rejectionSubmitting ? 'Submitting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Worker Administration & Directives Control Modal */}
      {workerControlModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '640px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={22} color="#38bdf8" /> Worker Administration &amp; Directive Console
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
                  Issue direct instructions, commendations, warnings, or disciplinary actions
                </div>
              </div>
              <button onClick={() => setWorkerControlModal(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#cbd5e1' }}>
                <XCircle size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Worker Profile Card */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#0f172a' }}>{workerControlModal.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                    🛠️ {workerControlModal.trade || 'General'} • 📞 {workerControlModal.phone} • ✉️ {workerControlModal.email || 'N/A'}
                  </div>
                  {workerControlModal.workerId && (
                    <div style={{ fontSize: '0.8rem', color: '#0284c7', fontWeight: '700', marginTop: '4px' }}>
                      Worker ID: {workerControlModal.workerId}
                    </div>
                  )}
                </div>
                <div>
                  {workerControlModal.isBlocked ? (
                    <span style={{ background: '#fef2f2', color: '#dc2626', fontWeight: '800', padding: '6px 12px', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '0.82rem' }}>
                      🛑 Blocked
                    </span>
                  ) : (workerControlModal.isSuspended || workerControlModal.verificationStatus === 'suspended') ? (
                    <span style={{ background: '#fffbeb', color: '#d97706', fontWeight: '800', padding: '6px 12px', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '0.82rem' }}>
                      ⏸️ Suspended
                    </span>
                  ) : (
                    <span style={{ background: '#f0fdf4', color: '#166534', fontWeight: '800', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.82rem' }}>
                      🟢 Active &amp; Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Feedback History Log */}
              <div>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} color="#475569" /> Logged Administrative Directives ({workerFeedbacksList.length})
                </h4>
                {workerFeedbackLoading ? (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>Loading feedback history...</div>
                ) : workerFeedbacksList.length === 0 ? (
                  <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '14px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No prior administrative directives or warnings recorded for this partner.
                  </div>
                ) : (
                  <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {workerFeedbacksList.map((fb, idx) => (
                      <div key={fb.feedbackId || idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: fb.feedbackType === 'praise' ? '#dcfce7' : fb.feedbackType === 'warning' ? '#fef3c7' : fb.feedbackType === 'disciplinary' ? '#fee2e2' : '#e0e7ff',
                            color: fb.feedbackType === 'praise' ? '#166534' : fb.feedbackType === 'warning' ? '#92400e' : fb.feedbackType === 'disciplinary' ? '#991b1b' : '#3730a3',
                          }}>
                            {fb.feedbackType}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {new Date(fb.createdAt).toLocaleDateString()} {new Date(fb.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0', fontSize: '0.88rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>{fb.message}</p>
                        {fb.actionTaken && fb.actionTaken !== 'none' && (
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                            Action Applied: {fb.actionTaken}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Issue New Directive Form */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>
                  Issue New Directive / Administrative Feedback
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Directive Type:</label>
                    <select
                      value={workerFeedbackType}
                      onChange={(e) => setWorkerFeedbackType(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: '600' }}
                    >
                      <option value="instruction">📋 Instruction / Advisory</option>
                      <option value="praise">🌟 Commendation / Praise</option>
                      <option value="warning">⚠️ Official Warning</option>
                      <option value="disciplinary">🚨 Disciplinary Notice</option>
                      <option value="correction">🛠️ Quality Correction</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Account Status Action:</label>
                    <select
                      value={workerControlAction}
                      onChange={(e) => setWorkerControlAction(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: '600' }}
                    >
                      <option value="none">🔘 None (Advisory Only)</option>
                      <option value="warning_issued">⚠️ Record Written Warning</option>
                      <option value="suspended">⏸️ Suspend Account (Offline)</option>
                      <option value="reinstated">🟢 Reinstate Account (Active)</option>
                      <option value="blocked">🚫 Block Account Access</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>Feedback / Directive Content:</label>
                  <textarea
                    rows={4}
                    value={workerFeedbackMessage}
                    onChange={(e) => setWorkerFeedbackMessage(e.target.value)}
                    placeholder="Type operational feedback, instructions, warning notes, or commendation..."
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }}
                  />
                </div>

                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  ⚡ Live event emitted to provider app and official email directive dispatched immediately.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setWorkerControlModal(null)}
                style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', padding: '10px 18px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={handleSubmitWorkerFeedback}
                disabled={workerFeedbackSubmitting}
                style={{
                  background: workerControlAction === 'suspended' || workerControlAction === 'blocked' ? '#dc2626' : workerFeedbackType === 'praise' ? '#16a34a' : '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <MessageSquare size={16} /> {workerFeedbackSubmitting ? 'Transmitting Directive...' : 'Send Directive & Apply Action'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
