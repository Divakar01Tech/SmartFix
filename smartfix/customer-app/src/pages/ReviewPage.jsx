import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingAPI } from '../services/api';
import { Star, Send, CheckCircle } from 'lucide-react';
import './ReviewPage.css';

export default function ReviewPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) { setError('Please select a rating'); return; }
    setSubmitting(true);
    try {
      await bookingAPI.rate(bookingId, { rating, review });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return (
    <div className="page page-sm text-center review-success">
      <div className="success-icon"><CheckCircle size={56} /></div>
      <h1>Thank You!</h1>
      <p>Your review helps other customers find great professionals.</p>
      <button className="btn btn-primary btn-lg mt-24" onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </button>
    </div>
  );

  return (
    <div className="page page-sm review-page">
      <h1 className="mb-8">Rate Your Experience</h1>
      <p className="text-muted mb-24">How was the service? Your feedback matters.</p>

      <div className="card">
        <div className="card-body">
          <div className="stars-row">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n} type="button"
                className={`star-btn ${n <= (hover || rating) ? 'filled' : ''}`}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
              >
                <Star size={40} fill={n <= (hover || rating) ? '#F59E0B' : 'none'} color="#F59E0B" />
              </button>
            ))}
          </div>
          <div className="rating-label">
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent! ⭐'}
          </div>

          <form onSubmit={handleSubmit} className="mt-24">
            <div className="form-group">
              <label className="form-label">Write a Review (Optional)</label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Tell others about your experience..."
                value={review}
                onChange={e => setReview(e.target.value)}
                style={{ resize: 'none' }}
              />
            </div>
            {error && <div className="error-box mb-16">{error}</div>}
            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? 'Submitting...' : <><Send size={16} /> Submit Review</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
