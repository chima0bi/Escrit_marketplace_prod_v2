import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function ReviewSection({ listingType, listingId, authStatus }) {
  const [reviews, setReviews] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadReviews() {
    const response = await api.getListingReviews(listingType, listingId);
    setReviews(response.reviews || []);
  }

  useEffect(() => {
    let active = true;
    api.getListingReviews(listingType, listingId)
      .then((response) => active && setReviews(response.reviews || []))
      .catch((err) => active && setError(err.message || 'Unable to load reviews.'));
    if (authStatus === 'authed') {
      api.getReviewEligibility(listingType, listingId)
        .then((value) => active && setEligibility(value))
        .catch(() => active && setEligibility({ eligible: false }));
    } else {
      setEligibility(null);
    }
    return () => { active = false; };
  }, [listingType, listingId, authStatus]);

  async function submitReview(event) {
    event.preventDefault();
    if (!eligibility?.transactionId) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createListingReview(listingType, listingId, {
        transactionId: eligibility.transactionId,
        rating: Number(rating),
        comment,
      });
      setComment('');
      setEligibility({ eligible: false });
      await loadReviews();
    } catch (err) {
      setError(err.message || 'Unable to submit your review.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-10 border-t border-line pt-7" aria-labelledby="listing-reviews-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="listing-reviews-heading" className="font-display text-2xl">Buyer reviews</h2>
        <p className="text-sm text-ink/55">{reviews?.length ?? '…'} verified review{reviews?.length === 1 ? '' : 's'}</p>
      </div>

      {authStatus === 'authed' && eligibility?.eligible && (
        <form onSubmit={submitReview} className="mt-5 space-y-3 border-y border-line py-5">
          <h3 className="text-sm font-semibold">Review this completed order</h3>
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <label className="text-sm text-ink/65">Rating
              <select value={rating} onChange={(event) => setRating(event.target.value)} className="mt-1 w-full border border-line bg-input px-3 py-2">
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} of 5</option>)}
              </select>
            </label>
            <label className="text-sm text-ink/65">Your experience
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={2} className="mt-1 w-full border border-line bg-input px-3 py-2" placeholder="Share helpful details for other buyers" />
            </label>
          </div>
          <button disabled={submitting} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit verified review'}
          </button>
        </form>
      )}

      {authStatus !== 'authed' && <p className="mt-4 text-sm text-ink/55"><Link to={`/login?intent=buyer&next=${encodeURIComponent(window.location.pathname)}`} className="underline underline-offset-4">Sign in</Link> to review after a completed purchase.</p>}
      {authStatus === 'authed' && eligibility && !eligibility.eligible && <p className="mt-4 text-sm text-ink/55">Reviews are available to buyers after a completed order.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-dispute">{error}</p>}
      {reviews?.length === 0 && <p className="mt-5 border-y border-line py-5 text-sm text-ink/55">No reviews yet. Completed buyers can leave the first one.</p>}
      {reviews?.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {reviews.map((review) => (
            <li key={review._id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{review.buyerId?.businessName || 'Escrit buyer'} <span className="ml-2 text-ink/60">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></p>
                <time className="text-xs text-ink/45" dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString()}</time>
              </div>
              {review.comment && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink/65">{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}