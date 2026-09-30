import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../../components/StatusBadge.jsx';
import LifecycleStepper from '../../components/LifecycleStepper.jsx';
import { api } from '../../lib/api.js';
import { usePageTitle } from '../../lib/usePageTitle.js';

// Plain-language answer to "what happens next?" for each order state.
function nextStep(order) {
  const fulfillment = order.fulfillmentStatus;
  switch (order.status) {
    case 'CREATED': return 'Waiting for your payment to be confirmed.';
    case 'PAID_HELD':
      if (fulfillment === 'DELIVERED' || fulfillment === 'SERVICE_COMPLETE') return 'The seller marked this done. Confirm it, or raise a dispute if something is wrong.';
      if (fulfillment === 'IN_TRANSIT') return 'On its way. Your money stays held until you confirm delivery.';
      return 'Your money is safe. The seller has been asked to deliver.';
    case 'RELEASED': return 'Complete. The seller has been paid.';
    case 'DISPUTED': return 'Payout is frozen while the team reviews your dispute.';
    case 'RESOLVED_REFUNDED': return 'Resolved. Your payment was refunded.';
    case 'RESOLVED_RELEASED': return 'Resolved. The seller was paid after review.';
    case 'RESOLVED_CREDITED': return 'Resolved after review.';
    default: return '';
  }
}

export default function BuyerOrders() {
  usePageTitle('My orders');
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getBuyerOrders()
      .then(({ orders: buyerOrders }) => active && setOrders(buyerOrders || []))
      .catch((err) => active && setError(err.message || 'Unable to load your orders.'));
    return () => { active = false; };
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="border-b border-line pb-5">
        <p className="text-xs font-medium uppercase tracking-wider text-ink/50">Your account</p>
        <h1 className="mt-2 font-display text-3xl">My orders</h1>
      </div>
      {error && <p role="alert" className="mt-5 text-sm text-dispute">{error}</p>}
      {!orders && !error && <ul aria-busy="true" aria-label="Loading orders" className="divide-y divide-line border-y border-line">{[0, 1, 2].map((n) => <li key={n} className="flex items-center gap-4 py-5"><div className="h-16 w-16 animate-pulse rounded-md bg-line/40" /><div className="flex-1 space-y-2"><div className="h-3 w-24 animate-pulse rounded bg-line/40" /><div className="h-4 w-2/3 animate-pulse rounded bg-line/40" /></div></li>)}</ul>}
      {orders?.length === 0 && <div className="py-16 text-center"><h2 className="font-display text-xl">No orders yet</h2><p className="mt-2 text-sm text-ink/55">Your purchases will appear here, including products, courses, and services.</p><Link to="/marketplace" className="mt-4 inline-block text-sm underline underline-offset-4">Browse marketplace</Link></div>}
      {orders?.length > 0 && <ul className="divide-y divide-line border-y border-line">{orders.map((order) => {
        const item = order.linkId;
        const needsNoShowResponse = order.fulfillmentStatus === 'BUYER_NO_SHOW' && item.fulfillmentType === 'service' && !order.buyerNoShowReason && order.status === 'PAID_HELD';
        return (
          <li key={order._id} className="py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {item.itemPhotoUrl && <img src={item.itemPhotoUrl} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />}
              <div className="min-w-0">
                <p className="text-xs uppercase text-ink/45">{item.fulfillmentType}</p>
                <h2 className="truncate font-medium">{item.itemName}</h2>
                <p className="mt-1 text-xs text-ink/50">Ordered {new Date(order.createdAt).toLocaleDateString()}</p>
                {needsNoShowResponse && <p className="mt-2 text-xs font-medium text-dispute">Action needed: explain the missed service appointment by {order.noShowResponseDueAt ? new Date(order.noShowResponseDueAt).toLocaleDateString() : 'the deadline'}.</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={order.status} />
              <Link to={`/r/${item._id}/t/${order._id}`} className="text-sm font-medium underline underline-offset-4">View order</Link>
            </div>
            </div>
            <div className="mt-4 max-w-md"><LifecycleStepper status={order.status} /></div>
            {nextStep(order) && <p className="mt-3 text-xs leading-5 text-ink/60"><span className="font-medium text-ink/75">What happens next:</span> {nextStep(order)}</p>}
          </li>
        );
      })}</ul>}
    </div>
  );
}
