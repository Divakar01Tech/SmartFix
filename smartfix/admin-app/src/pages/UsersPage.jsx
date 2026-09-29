import { useState, useEffect } from 'react';
import { getUsers } from '../services/adminAPI';
import { Users, Search, Loader, User, Wrench, Shield, ShieldCheck, Clock, XCircle } from 'lucide-react';

const ROLE_BADGE = { customer: 'badge-customer', handyman: 'badge-handyman', admin: 'badge-admin' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getUsers().then(r => { setUsers(r.data.users || []); setLoading(false); });
  }, []);

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search) ||
    u.role?.toLowerCase().includes(search.toLowerCase()) ||
    u.aadhaarNumber?.includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users & Accounts</h1>
          <p className="text-muted text-sm">{users.length} registered platform accounts</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>User Records</h3>
          <div className="search-wrap">
            <Search size={15} className="search-icon" />
            <input type="text" className="form-input search-input" placeholder="Search by name, phone, Aadhaar..."
              value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: '260px', paddingLeft: '36px' }} />
          </div>
        </div>
        {loading ? (
          <div className="empty-state"><Loader size={32} className="spin-icon" color="var(--primary)" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><Users size={36} /><p>No users found</p></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Trade / Details</th>
                  <th>Aadhaar Number</th>
                  <th>KYC Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const id = u._id || u.id;
                  return (
                    <tr key={id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary-light)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyCenter: 'center', fontSize: '0.875rem', flexShrink: 0, textAlign: 'center', lineHeight: '34px' }}>
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>{(id || '').toString().slice(-6)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-sm">{u.phone}</td>
                      <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-customer'}`}>{u.role}</span></td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {u.role === 'handyman' ? `${u.trade || 'Handyman'} (₹${u.ratePerHour || 350}/hr)` : u.location || 'Customer'}
                      </td>
                      <td className="font-mono text-sm">
                        {u.role === 'handyman' ? (u.aadhaarNumber || 'Not submitted') : '—'}
                      </td>
                      <td>
                        {u.role === 'handyman' ? (
                          <span className={`badge badge-${u.verificationStatus?.toLowerCase() || 'pending'}`}>
                            {u.verificationStatus || 'Pending'}
                          </span>
                        ) : (
                          <span className="badge badge-active">Active</span>
                        )}
                      </td>
                      <td className="text-muted text-sm">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}</td>
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
