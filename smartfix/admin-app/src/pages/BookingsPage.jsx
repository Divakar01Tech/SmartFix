import { useState, useEffect } from 'react';
import { getAllBookings } from '../services/adminAPI';
import { ClipboardList, Search, MapPin, Loader } from 'lucide-react';

const STATUS_COLORS = {
  Pending: 'badge-pending', Accepted: 'badge-accepted', Completed: 'badge-completed',
  Paid: 'badge-paid', Cancelled: 'badge-cancelled', EnRoute: 'badge-accepted',
  WorkInProgress: 'badge-active', Arrived: 'badge-active',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    getAllBookings().then(r => { setBookings(r.data.bookings || []); setLoading(false); });
  }, []);

  const filtered = bookings.filter(b => {
    const matchSearch = !search || b.trade?.toLowerCase().includes(search.toLowerCase()) || b.address?.includes(search) || b.customer?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Bookings</h1>
          <p className="text-muted text-sm">{bookings.length} total bookings</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <h3>All Bookings</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input type="text" className="form-input" placeholder="Search..." value={search}
                onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '34px', minWidth: '200px' }} />
            </div>
            <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: '140px' }}>
              <option value="">All Statuses</option>
              {['Pending','Accepted','EnRoute','Arrived','WorkInProgress','Completed','Paid','Cancelled'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><Loader size={32} className="spin-icon" color="var(--primary)" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><ClipboardList size={36} /><p>No bookings found</p></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Service</th>
                  <th>Customer</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>SLA</th>
                  <th>Price</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const id = b._id || b.id;
                  return (
                    <tr key={id}>
                      <td className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>{id.toString().slice(-6)}</td>
                      <td style={{ fontWeight: 600 }}>{b.trade}</td>
                      <td style={{ fontSize: '0.85rem' }}>{b.customer?.name || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{b.worker?.name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}</td>
                      <td><span className={`badge ${STATUS_COLORS[b.status] || 'badge-pending'}`}>{b.status}</span></td>
                      <td>
                        {b.slaBreached ? (
                          <span style={{ color: 'var(--danger)', fontSize: '0.78rem', fontWeight: 700 }}>BREACHED</span>
                        ) : b.slaDeadline ? (
                          <span style={{ color: 'var(--success)', fontSize: '0.78rem' }}>OK</span>
                        ) : '—'}
                      </td>
                      <td className="font-mono" style={{ color: 'var(--success)' }}>₹{b.price}</td>
                      <td className="text-muted text-sm">{b.date}</td>
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
