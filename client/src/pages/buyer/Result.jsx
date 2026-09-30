import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import LifecycleStepper from '../../components/LifecycleStepper.jsx';
import { CheckCircleIcon } from '../../components/icons.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';

const POLL_MS = 3000;
const GIVE_UP_AFTER_MS = 45000;

// The payment provider redirects here after checkout. The redirect alone is not proof
// of payment, so this page polls the API until the order is confirmed as
// held, and says so plainly if confirmation takes longer than expected.
export default function Result() {
  usePageTitle('Payment result');
  const { linkId, txId } = useParams();
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const pollRef = useRef(null);
  const startedAt = useRef(Date.now());

  function fetchOnce() {
    api
      .getPublicTransaction(linkId, txId)
      .then((d) => setTransaction(d.transaction))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    fetchOnce();
    pollRef.current = setInterval(() => {
      if (Date.now() - startedAt.current > GIVE_UP_AFTER_MS) {
        setTimedOut(true);
        clearInterval(pollRef.current);
        return;
      }
      fetchOnce();
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId, txId]);

  useEffect(() => {
    if (transaction && transaction.status !== 'CREATED' && pollRef.current) {
      clearInterval(pollRef.current); // confirmed, stop polling
    }
  }, [transaction]);

  const isHeld = transaction?.status === 'PAID_HELD';
  const isDirectPaid = transaction?.status === 'DIRECT_PAID';
  const isDirectComplete = transaction?.status === 'DIRECT_COMPLETED';
  const isConfirmed = isHeld || isDirectPaid || isDirectComplete || ['RELEASED', 'RESOLVED_RELEASED', 'RESOLVED_REFUNDED', 'RESOLVED_CREDITED'].includes(transaction?.status);

  return (
    <div className="text-center py-12 animate-fade-in-up">
      {isConfirmed ? (
        <CheckCircleIcon className="mx-auto text-released mb-3" width={40} height={40} />
      ) : (
        !timedOut && (
          <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-line border-t-seal animate-spin" />
        )
      )}

      <h1 className="font-display text-2xl mb-4">
        {isDirectComplete
          ? 'Direct service payment confirmed and service completed'
          : isDirectPaid
          ? 'Direct payment confirmed'
          : isHeld
          ? 'Payment received and held in escrow'
          : timedOut
          ? 'Still waiting on confirmation'
          : 'Confirming your payment…'}
      </h1>

      {error && <p className="text-dispute text-sm mb-3" role="alert">{error}</p>}

      {transaction && (
        <>
          <div className="flex justify-center mb-4">
            <StatusBadge status={transaction.status} />
          </div>
          <div className="max-w-xs mx-auto mb-4">
            <LifecycleStepper status={transaction.status} />
          </div>
        </>
      )}

      {timedOut && !isConfirmed && (
        <p className="text-sm text-ink/60 max-w-sm mx-auto mb-4">
          Your payment may still be processing. If you were charged, this page updates as soon as
          confirmation arrives. You can also check back in a minute.
        </p>
      )}

      <p className="mt-6">
        <Link to={`/r/${linkId}/t/${txId}`} className="underline text-sm">Back to your order</Link>
      </p>
    </div>
  );
}
