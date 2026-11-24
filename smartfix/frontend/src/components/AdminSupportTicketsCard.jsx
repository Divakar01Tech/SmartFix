import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { LifeBuoy, CheckCircle2, Clock, AlertTriangle, RefreshCw, MessageSquare, ChevronRight, Filter } from 'lucide-react';

export default function AdminSupportTicketsCard() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [adminNoteInput, setAdminNoteInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.getAdminSupportTickets(statusFilter);
      setTickets(data.tickets || []);
    } catch (err) {
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  const handleUpdateStatus = async (ticketId, newStatus) => {
    setSaving(true);
    try {
      const updated = await apiService.updateAdminSupportTicket(ticketId, newStatus, adminNoteInput);
      setTickets((prev) => prev.map((t) => (t._id === ticketId ? { ...t, ...updated } : t)));
      if (selectedTicket?._id === ticketId) {
        setSelectedTicket((prev) => ({ ...prev, ...updated }));
      }
      alert('Ticket updated successfully');
    } catch (err) {
      alert(err.message || 'Failed to update ticket');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'open':
        return <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 8px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: '700' }}>OPEN</span>;
      case 'in_progress':
        return <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: '700' }}>IN PROGRESS</span>;
      case 'closed':
        return <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: '700' }}>CLOSED</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div style={{ background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LifeBuoy size={22} color="#2563eb" /> Customer & Worker Support Tickets
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Issues escalated from the AI Support Assistant requiring administrative resolution.
          </p>
        </div>
        <button
          onClick={fetchTickets}
          disabled={loading}
          style={{
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '8px 14px',
            fontSize: '0.82rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['', 'open', 'in_progress', 'closed'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: '700',
              border: '1px solid #cbd5e1',
              background: statusFilter === st ? '#2563eb' : '#f8fafc',
              color: statusFilter === st ? '#ffffff' : '#475569',
              cursor: 'pointer',
            }}
          >
            {st === '' ? 'All Tickets' : st.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading support tickets...</div>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
          No support tickets found in this view.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedTicket ? '1fr 1fr' : '1fr', gap: '20px' }}>
          {/* Ticket Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '10px' }}>User</th>
                  <th style={{ padding: '10px' }}>Role</th>
                  <th style={{ padding: '10px' }}>Category</th>
                  <th style={{ padding: '10px' }}>Summary</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t._id}
                    onClick={() => {
                      setSelectedTicket(t);
                      setAdminNoteInput(t.adminNotes || '');
                    }}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      background: selectedTicket?._id === t._id ? '#eff6ff' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px', fontWeight: '600', color: '#0f172a' }}>
                      {t.userId?.name || 'Anonymous User'}
                    </td>
                    <td style={{ padding: '10px', textTransform: 'capitalize' }}>{t.role}</td>
                    <td style={{ padding: '10px', textTransform: 'capitalize' }}>{t.category}</td>
                    <td style={{ padding: '10px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.issueSummary}
                    </td>
                    <td style={{ padding: '10px' }}>{getStatusBadge(t.status)}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: '#2563eb', fontWeight: '600' }}>View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ticket Detail Drawer */}
          {selectedTicket && (
            <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: '#0f172a' }}>
                  Ticket #{selectedTicket._id.slice(-6).toUpperCase()}
                </h3>
                {getStatusBadge(selectedTicket.status)}
              </div>

              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>User Details</div>
                <div style={{ fontWeight: '600' }}>
                  {selectedTicket.userId?.name} ({selectedTicket.userId?.email || 'No email'}) • {selectedTicket.userId?.phone || 'No phone'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Issue Summary</div>
                <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                  {selectedTicket.issueSummary}
                </div>
              </div>

              {/* Conversation Messages */}
              {selectedTicket.conversationId?.messages && (
                <div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginBottom: '6px' }}>AI Support Chat Excerpt</div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', background: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {selectedTicket.conversationId.messages.map((m, mIdx) => (
                      <div key={mIdx} style={{ fontSize: '0.78rem' }}>
                        <strong style={{ color: m.role === 'user' ? '#2563eb' : '#059669' }}>
                          {m.role === 'user' ? 'User: ' : 'AI: '}
                        </strong>
                        <span>{m.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Note Input */}
              <div>
                <label style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                  Admin Notes / Resolution Remarks
                </label>
                <textarea
                  value={adminNoteInput}
                  onChange={(e) => setAdminNoteInput(e.target.value)}
                  rows={2}
                  placeholder="Record call outcome, policy rationale, or settlement notes..."
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                <button
                  onClick={() => handleUpdateStatus(selectedTicket._id, 'in_progress')}
                  disabled={saving}
                  style={{ flex: 1, background: '#f59e0b', color: '#ffffff', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Mark In Progress
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedTicket._id, 'closed')}
                  disabled={saving}
                  style={{ flex: 1, background: '#059669', color: '#ffffff', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Resolve & Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
