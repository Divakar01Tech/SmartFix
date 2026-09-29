import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingAPI } from '../services/api';
import { MapPin, Clock, Star, Navigation, Loader } from 'lucide-react';

const STATUS_COLOR = { Completed: 'completed', Paid: 'paid', Reviewed: 'reviewed', Cancelled: 'cancelled' };

export default function BookingHistoryPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    bookingAPI.getMyBookings()
      .then(r => setBookings((r.data.bookings || []).filter(b => ['Completed','Paid','Reviewed','Cancelled'].includes(b.status))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="page flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <Loader size={32} className="spin-icon" color="var(--primary)" />
    </div>
  );

  return (
    <div className="page">
      <h1 className="mb-8">Job History</h1>
      <p className="text-muted mb-24">{bookings.length} completed jobs</p>

      {bookings.length === 0 ? (
        <div className="empty-state">
          <Clock size={40} color="var(--text-muted)" />
          <p>No completed jobs yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {bookings.map(b => {
            const id = b._id || b.id;
            return (
              <div key={id} className="card">
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{b.trade}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        <MapPin size={13} /> {b.address}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span><Clock size={12} /> {b.date}</span>
                        {b.rating && <span><Star size={12} fill="#F59E0B" color="#F59E0B" /> {b.rating}/5</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <span className={`badge badge-${STATUS_COLOR[b.status] || 'completed'}`}>{b.status}</span>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>
                        ₹{b.workerTotalPayout || Math.round(b.price * 0.9)}
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/job/${id}`)}>
                        <Navigation size={13} /> View
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
