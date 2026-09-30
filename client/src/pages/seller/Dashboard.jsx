import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useAuthContext } from '../../lib/AuthContext.jsx';
import SpotlightTour from '../../components/SpotlightTour.jsx';
import { BankIcon, ShieldCheckIcon, PlusIcon, ChevronRightIcon } from '../../components/icons.jsx';
import { usePageTitle } from '../../lib/usePageTitle.js';

const TOUR_STEPS = [
  {
    selector: '[data-tour="new-link"]',
    title: 'Create a payment link',
    body: 'One link per item. Share it anywhere, such as WhatsApp or an Instagram story. Buyers never need an account.',
  },
  {
    selector: '[data-tour="links-list"]',
    title: 'Every link, live',
    body: 'Track each order here: awaiting payment, held in escrow, released or disputed. It updates on its own.',
  },
  {
    selector: '[data-tour="bank-nav"]',
    title: 'Where your money lands',
    body: 'Payments are only ever released to the bank account you verified. You can change it any time from here.',
  },
];

const POLL_MS = 15000;

export default function Dashboard() {
  usePageTitle('Account hub');
  const location = useLocation();
  const { hasBankAccount, seller } = useAuthContext();
  const [links, setLinks] = useState(null);
  const [myListings, setMyListings] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);

  // Poll so payment and fulfillment changes show up
  // without a manual refresh.
  useEffect(() => {
    let cancelled = false;
    function load(silent) {
      api
        .listLinks()
        .then((d) => !cancelled && setLinks(d.links))
        .catch((err) => !cancelled && !silent && setError(err.message));
    }
    load(false);
    const timer = setInterval(() => load(true), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    api.getSellerAnalytics().then((data) => active && setAnalytics(data)).catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    api.getMyListings()
      .then(({ listings }) => active && setMyListings(listings || []))
      .catch((err) => active && setError(err.message));
    return () => { active = false; };
  }, []);

  async function toggleListing(listing) {
    try {
      const { item } = await api.setMyListingActive(listing.listingType, listing._id, !listing.isActive);
      setMyListings((current) => current.map((entry) => entry._id === item._id ? { ...entry, isActive: item.isActive } : entry));
    } catch (err) {
      setError(err.message || 'Unable to update this listing.');
    }
  }

  const totals = (links || []).reduce((summary, entry) => {
    const counts = entry.transactionCounts || {};
    summary.held += counts.PAID_HELD || 0;
    summary.disputes += counts.DISPUTED || 0;
    summary.released += counts.RELEASED || 0;
    summary.released += counts.RESOLVED_RELEASED || 0;
    return summary;
  }, { held: 0, disputes: 0, released: 0 });

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-2xl">Account hub</h1>
          <p className="text-sm text-ink/60 mt-0.5 truncate">Welcome back, {seller?.businessName}.</p>
        </div>
        <Link
          data-tour="new-link"
          to="/dashboard/new"
          className="shrink-0 flex items-center gap-1.5 border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-paper transition-colors rounded-lg"
        >
          <PlusIcon width={14} height={14} />
          New payment link
        </Link>
      </div>

      <nav aria-label="Account actions" className="mb-7 grid grid-cols-2 gap-x-5 border-y border-line py-4 text-sm sm:grid-cols-4">
        <Link to="/marketplace/new/product" className="py-2 font-medium underline underline-offset-4">List a product</Link>
        <Link to="/dashboard/bank" className="py-2 underline underline-offset-4">Bank and payouts</Link>
        <Link to="/settings" className="py-2 underline underline-offset-4">Profile and KYC</Link>
        <Link to="/account/orders" className="py-2 underline underline-offset-4">Buyer orders</Link>
        <Link to="/account/cart" className="py-2 underline underline-offset-4">Shopping cart</Link>
        <Link to="/account/favorites" className="py-2 underline underline-offset-4">Saved listings</Link>
        <Link to="/account/offers" className="py-2 underline underline-offset-4">Service offers and chat</Link>
        <Link to="/account/price-offers" className="py-2 underline underline-offset-4">Product price offers</Link>
        <Link to="/account/credits" className="py-2 underline underline-offset-4">Promotion credits</Link>
      </nav>

      {location.state?.listingSubmitted && <p role="status" className="mb-5 border border-seal/30 bg-seal-soft/40 px-4 py-3 text-sm text-ink/70">Your listing was submitted for admin review. It will appear in the marketplace after approval.</p>}

      <section aria-label="Sales overview" className="mb-7 grid grid-cols-2 gap-y-4 border-y border-line py-4 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-line">
        <Metric label="Live listings" value={myListings?.filter((item) => item.isActive && item.isVerified).length ?? '—'} />
        <Metric label="Orders" value={analytics?.totalOrders ?? '—'} />
        <Metric label="Paid orders" value={analytics?.paidOrders ?? '—'} />
        <Metric label="Gross paid" value={analytics ? `₦${(analytics.grossPaidKobo / 100).toLocaleString()}` : '—'} />
        <Metric label="Estimated payout" value={analytics ? `₦${(analytics.estimatedSellerPayoutKobo / 100).toLocaleString()}` : '—'} />
        <Metric label="Open disputes" value={analytics?.disputedOrders ?? totals.disputes} />
      </section>

      {analytics && <section className="mb-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="border-b border-line pb-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-ink/50">Recent sales</p><h2 className="mt-1 font-display text-xl">Paid volume · 7 days</h2></div><span className="text-xs text-ink/50">{analytics.directSales} direct course/service sales</span></div>
          <div className="mt-5 grid h-32 grid-cols-7 items-end gap-2" role="img" aria-label="Daily gross paid in the last seven days">
            {analytics.lastSevenDays.map((day) => {
              const max = Math.max(1, ...analytics.lastSevenDays.map((entry) => entry.amountKobo));
              const height = day.amountKobo ? Math.max(8, Math.round(day.amountKobo / max * 100)) : 3;
              return <div key={day.date} className="flex h-full flex-col items-center justify-end gap-2"><div title={`₦${(day.amountKobo / 100).toLocaleString()}`} className="w-full max-w-10 rounded-t-sm bg-forest-700/80 dark:bg-seal/80" style={{ height: `${height}%` }} /><span className="text-[9px] text-ink/45">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</span></div>;
            })}
          </div>
        </div>
        <div className="border-b border-line pb-5">
          <p className="text-xs uppercase tracking-wider text-ink/50">Listing performance</p><h2 className="mt-1 font-display text-xl">Top listings by paid volume</h2>
          {analytics.topListings.length ? <ul className="mt-3 divide-y divide-line">{analytics.topListings.map((entry) => <li key={entry.linkId} className="flex items-center justify-between gap-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium">{entry.title}</p><p className="text-xs text-ink/50">{entry.orders} orders · {entry.listingType}</p></div><span className="shrink-0 font-mono text-xs">₦{(entry.grossPaidKobo / 100).toLocaleString()}</span></li>)}</ul> : <p className="mt-3 text-sm text-ink/55">Paid listing activity will appear here.</p>}
        </div>
      </section>}

      <div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div><p className="text-xs uppercase tracking-wider text-ink/50">Identity review</p><p className="mt-1 text-sm">KYC status: <span className={`font-medium ${seller?.kycStatus === 'verified' ? 'text-released' : seller?.kycStatus === 'rejected' ? 'text-dispute' : 'text-seal'}`}>{seller?.kycStatus || 'pending'}</span></p></div>
        <Link to="/settings" className="text-sm underline underline-offset-4">Update identity details</Link>
      </div>

      {seller?.promoCreditsKobo > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-seal/30 bg-seal-soft/40 px-4 py-3">
          <div><p className="text-xs uppercase tracking-wider text-ink/50">Promotion credits</p><p className="mt-1 font-semibold">₦{(seller.promoCreditsKobo / 100).toLocaleString()}</p></div>
          <p className="max-w-md text-xs text-ink/60">Earned from eligible non-refundable product no-show resolutions.</p>
        </div>
      )}

      {!hasBankAccount && (
        <div
          data-tour="bank-nav"
          className="certificate p-4 mb-6 bg-seal-soft border-seal/40 flex items-start gap-3 animate-fade-in-up"
        >
          <BankIcon className="text-seal shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Add a verified bank account to start selling</p>
            <p className="text-ink/60 mt-0.5">
              You cannot create a payment link or get paid until we know where your money goes.
            </p>
            <Link
              to="/dashboard/bank?next=/dashboard"
              className="inline-block mt-2 text-sm font-medium underline underline-offset-2"
            >
              Add bank details
            </Link>
          </div>
        </div>
      )}

      {error && (
        <p className="text-dispute text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <section className="mb-8" aria-labelledby="my-listings-heading">
        <div className="flex items-baseline justify-between gap-3"><h2 id="my-listings-heading" className="font-display text-lg">My marketplace listings</h2><Link to="/marketplace/new/product" className="text-sm underline underline-offset-4">List another</Link></div>
        {myListings?.length === 0 && <p className="mt-3 border-y border-line py-4 text-sm text-ink/55">Your products, courses, and services will appear here.</p>}
        <ul className="mt-2 divide-y divide-line">{myListings?.map((item) => <li key={`${item.listingType}:${item._id}`} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-ink/55">{item.listingType} · {item.isVerified ? item.isActive ? 'Live' : 'Paused' : 'Pending admin review'}</p></div><div className="flex items-center gap-3">{item.isVerified && <Link to={`/marketplace/${item.listingType}/${item._id}`} className="text-xs underline underline-offset-4">View</Link>}<button type="button" disabled={!item.isVerified} onClick={() => toggleListing(item)} className="text-xs underline underline-offset-4 disabled:opacity-40">{item.isActive ? 'Pause' : 'Reactivate'}</button></div></li>)}</ul>
      </section>

      {!links && !error && (
        <ul className="space-y-3" aria-busy="true" aria-label="Loading your links">
          {[0, 1, 2].map((i) => (
            <li key={i} className="skeleton h-[68px]" />
          ))}
        </ul>
      )}

      {/* The tour highlights this whole container, so the empty state is a
          full-size target rather than a zero-height list. */}
      <div data-tour="links-list">
        {links?.length === 0 && (
          <div className="certificate p-6 text-center animate-fade-in-up">
            <ShieldCheckIcon className="mx-auto text-ink/30 mb-2" width={28} height={28} />
            <p className="text-ink/60">
              No links yet. Create one to get paid safely by someone who has never met you.
            </p>
          </div>
        )}

        {links?.length > 0 && (
          <ul className="space-y-3">
            {links.map(({ link, transactionCounts }, i) => (
              <li
                key={link._id}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                className="animate-fade-in-up"
              >
                {/* The whole card is the tap target, not just the name. */}
                <Link
                  to={`/dashboard/links/${link._id}`}
                  className="group certificate p-4 flex items-center justify-between gap-4 hover:border-ink/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate group-hover:underline">{link.itemName}</p>
                    <p className="text-sm text-ink/60 font-mono">
                      ₦{(link.priceKobo / 100).toLocaleString()}
                      {!link.active && <span className="ml-2 text-ink/40 font-sans">· inactive</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TransactionCountsSummary counts={transactionCounts} />
                    <ChevronRightIcon
                      className="text-ink/25 group-hover:text-ink/50 transition-colors shrink-0"
                      width={16}
                      height={16}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SpotlightTour storageKey="escrit_seller_tour" steps={TOUR_STEPS} active={links !== null} />
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="px-3 first:pl-0"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-ink/55">{label}</p></div>;
}

// A link can have many orders in different states at once. This shows the
// at-a-glance summary; the per-order breakdown lives on the link page.
function TransactionCountsSummary({ counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) {
    return <span className="text-xs text-ink/40 whitespace-nowrap">No orders yet</span>;
  }

  const resolved = (counts.RESOLVED_RELEASED || 0) + (counts.RESOLVED_REFUNDED || 0) + (counts.RESOLVED_CREDITED || 0);
  const parts = [
    counts.PAID_HELD > 0 && { label: 'held', n: counts.PAID_HELD, cls: 'text-seal' },
    counts.DISPUTED > 0 && { label: 'disputed', n: counts.DISPUTED, cls: 'text-dispute' },
    counts.CREATED > 0 && { label: 'awaiting', n: counts.CREATED, cls: 'text-ink/50' },
    counts.RELEASED > 0 && { label: 'released', n: counts.RELEASED, cls: 'text-released' },
    resolved > 0 && { label: 'resolved', n: resolved, cls: 'text-ink/50' },
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 justify-end text-xs font-medium whitespace-nowrap shrink-0">
      {parts.map((p) => (
        <span key={p.label} className={p.cls}>
          {p.n} {p.label}
        </span>
      ))}
    </div>
  );
}
