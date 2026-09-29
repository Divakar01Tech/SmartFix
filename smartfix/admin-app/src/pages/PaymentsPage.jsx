import { useState, useEffect } from 'react';
import { getAllPayments } from '../services/adminAPI';
import { CreditCard, Loader, CheckCircle, Clock } from 'lucide-react';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllPayments().then(r => { setPayments(r.data.payments || []); setLoading(false); });
  }, []);

  const totalRevenue = payments.filter(p => p.status === 'Paid').reduce((s, p) => s + (p.amount || 0), 0);
  const commissionTotal = payments.reduce((s, p) => s + (p.commissionAmount || 0), 0);
  const cashbackTotal = payments.reduce((s, p) => s + (p.customerCashback || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Payments</h1>
      </div>

      <div className="grid-3 mb-24">
        {[
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, color: 'var(--success)' },
          { label: 'Commission Earned', value: `₹${commissionTotal.toLocaleString()}`, color: 'var(--primary-light)' },
          { label: 'Cashback Issued', value: `₹${cashbackTotal.toLocaleString()}`, color: 'var(--warning)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card">
            <div className="card-body">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><h3>Payment Records</h3><span className="text-muted text-sm">{payments.length} records</span></div>
        {loading ? (
          <div className="empty-state"><Loader size={32} className="spin-icon" color="var(--primary)" /></div>
        ) : payments.length === 0 ? (
          <div className="empty-state"><CreditCard size={36} /><p>No payment records</p></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Amount</th>
                  <th>Commission</th>
                  <th>Provider Payout</th>
                  <th>Cashback</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p._id || i}>
                    <td className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>{p.booking?.toString().slice(-6) || '—'}</td>
                    <td className="font-mono" style={{ color: 'var(--success)', fontWeight: 700 }}>₹{p.amount}</td>
                    <td className="font-mono" style={{ color: 'var(--primary-light)' }}>₹{p.commissionAmount || 0}</td>
                    <td className="font-mono">₹{p.providerPayout || 0}</td>
                    <td className="font-mono" style={{ color: 'var(--warning)' }}>₹{p.customerCashback || 0}</td>
                    <td>
                      <span className={`badge ${p.status === 'Paid' ? 'badge-paid' : 'badge-pending'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{p.method || 'Razorpay'}</td>
                    <td className="text-muted text-sm">{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
