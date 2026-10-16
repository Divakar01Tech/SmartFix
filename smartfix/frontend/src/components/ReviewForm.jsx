import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import { Star, MessageSquare, CheckCircle2, AlertCircle, Send } from 'lucide-react';

export default function ReviewForm({ booking, onReviewSubmitted }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const bookingId = booking?._id || booking?.id;
  const isPaid = booking?.status === 'paid' || booking?.paymentStatus === 'Paid' || booking?.status === 'reviewed';
  const isAlreadyReviewed = booking?.status === 'reviewed' || !!booking?.rating;

  if (isAlreadyReviewed) {
    return (
      <div className="card border-0 shadow-sm rounded-4 p-4 text-center bg-light">
        <CheckCircle2 size={36} className="text-success mx-auto mb-2" />
        <h4 className="h6 fw-bold text-dark mb-1">{t('review_submitted_title', 'Review Submitted')}</h4>
        <div className="d-flex justify-content-center gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={18}
              className={s <= (booking?.rating || rating) ? 'text-warning fill-warning' : 'text-muted'}
              style={{ fill: s <= (booking?.rating || rating) ? '#eab308' : 'none' }}
            />
          ))}
        </div>
        <p className="text-muted small mb-0">
          "{booking?.review || booking?.comment || comment || t('thank_you_for_feedback', 'Thank you for your valuable feedback!')}"
        </p>
      </div>
    );
  }

  if (!isPaid) {
    return (
      <div className="alert alert-light border small text-muted d-flex align-items-center gap-2">
        <AlertCircle size={18} className="text-warning flex-shrink-0" />
        <span>{t('review_locked_unpaid', 'Reviews unlock only after the job is marked completed and payment is processed.')}</span>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const updatedBooking = await apiService.rateBooking(bookingId, rating, comment.trim());
      setSuccess(true);
      if (onReviewSubmitted) onReviewSubmitted(updatedBooking);
    } catch (err) {
      setErrorMsg(err.message || t('review_submit_failed', 'Failed to submit review'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white border">
      <div className="d-flex align-items-center gap-2 mb-3">
        <Star size={20} className="text-warning fill-warning" style={{ fill: '#eab308' }} />
        <h3 className="h6 fw-bold text-dark mb-0">
          {t('rate_your_service', 'Rate Your Service Experience')}
        </h3>
      </div>

      <p className="text-muted small mb-3">
        {t('review_prompt_sub', 'Your rating helps maintain high quality standards for Tamil Nadu service professionals.')}
      </p>

      {errorMsg && (
        <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {success ? (
        <div className="alert alert-success py-3 text-center rounded-3">
          <CheckCircle2 size={24} className="mx-auto mb-1 text-success d-block" />
          <strong className="d-block">{t('rating_recorded_title', 'Thank you for your feedback!')}</strong>
          <span className="small text-muted">{t('rating_recorded_sub', 'Status updated to "Reviewed".')}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Star Selection */}
          <div className="d-flex align-items-center justify-content-center gap-2 mb-3 py-2 bg-light rounded-3">
            {[1, 2, 3, 4, 5].map((starVal) => {
              const active = (hoverRating || rating) >= starVal;
              return (
                <button
                  key={starVal}
                  type="button"
                  className="btn btn-link p-1 text-decoration-none transition-transform"
                  onMouseEnter={() => setHoverRating(starVal)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(starVal)}
                  style={{ transform: active ? 'scale(1.15)' : 'scale(1)' }}
                >
                  <Star
                    size={28}
                    className={active ? 'text-warning fill-warning' : 'text-secondary opacity-40'}
                    style={{ fill: active ? '#eab308' : 'none' }}
                  />
                </button>
              );
            })}
            <span className="ms-2 fw-bold text-dark fs-5">{hoverRating || rating} / 5</span>
          </div>

          {/* Feedback comment */}
          <div className="mb-3">
            <label className="form-label small fw-semibold text-muted">
              {t('written_feedback_label', 'Your Comments & Experience (Optional)')}
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder={t('review_placeholder', 'E.g. Professional conduct, quick resolution, arrived on time with necessary tools.')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-2 rounded-3 fw-semibold d-flex align-items-center justify-content-center gap-2"
            disabled={submitting}
          >
            {submitting ? (
              <span className="spinner-border spinner-border-sm" role="status" />
            ) : (
              <>
                <Send size={16} />
                <span>{t('submit_review_btn', 'Submit Review')}</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
