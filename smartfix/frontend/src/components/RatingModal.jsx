import { useState } from 'react';
import { X, Star } from 'lucide-react';
import './RatingModal.css';

const RatingModal = ({ booking, onClose, onSubmit }) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      onSubmit(booking._id || booking.id, rating, review);
      setSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <div className="rating-modal-overlay">
      <div className="rating-modal-card">
        <button className="close-modal-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="rating-header">
          <h2>Rate & Review Handyman</h2>
          <p>Share your feedback for {booking?.workerName || booking?.trade || 'Handyman'}</p>
        </div>

        <form onSubmit={handleSubmit} className="rating-form">
          <div className="star-picker">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                className="star-btn"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  size={32}
                  fill={(hoverRating || rating) >= star ? '#f59e0b' : 'transparent'}
                  color={(hoverRating || rating) >= star ? '#f59e0b' : '#cbd5e1'}
                />
              </button>
            ))}
          </div>

          <div className="rating-label">
            {rating === 5 && '🌟 Excellent! Exceeded expectations'}
            {rating === 4 && '👍 Great job! Very satisfied'}
            {rating === 3 && '👌 Good, standard quality'}
            {rating === 2 && '😐 Below average service'}
            {rating === 1 && '👎 Poor experience'}
          </div>

          <textarea
            className="review-textarea"
            placeholder="Write a brief review about their punctuality, work quality, and behavior..."
            rows={4}
            value={review}
            onChange={(e) => setReview(e.target.value)}
          />

          <button type="submit" className="submit-rating-btn" disabled={submitting}>
            {submitting ? 'Submitting Review...' : 'Submit Rating & Review'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default RatingModal;
