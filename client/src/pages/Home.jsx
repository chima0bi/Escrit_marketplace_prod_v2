import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import EscrowDemo from '../components/EscrowDemo.jsx';
import FeaturedCarousel from '../components/FeaturedCarousel.jsx';
import MarketplaceSearchHub from '../components/MarketplaceSearchHub.jsx';
import MarketplaceDemoReel from '../components/MarketplaceDemoReel.jsx';
import Reveal from '../components/Reveal.jsx';
import { ArrowRightIcon, CheckIcon } from '../components/icons.jsx';

const BUYER_PROTECTIONS = [
  { title: 'Held, not handed over', body: 'Your payment waits in escrow until you confirm the item arrived.' },
  { title: 'A seller you can verify', body: 'The bank-verified name is shown before you pay.' },
  { title: 'A freeze button', body: 'Raise a dispute and the release stops straight away.' },
  { title: 'Order history in one place', body: 'Your account keeps receipts, delivery updates, conversations, and dispute decisions together.' },
];

const SELLER_PROTECTIONS = [
  { title: 'Verified payouts', body: 'Money only ever goes to the bank account you verified.' },
  { title: 'Clear delivery milestones', body: 'Record tracking details or meeting completion before the buyer confirms release.' },
  { title: 'One link, many orders', body: 'Every purchase is tracked on its own, live in your dashboard.' },
  { title: 'Clear decisions', body: 'Disputes end with a written outcome that you and the buyer can both see.' },
];

const UNDER_THE_HOOD = [
  {
    term: 'Payment confirmation',
    detail:
      'A payment counts only after provider verification confirms its status, reference, currency, and amount. Signed webhooks are verified and repeat events are harmless.',
  },
  {
    term: 'Escrow state machine',
    detail:
      'An order goes from awaiting payment to held, through seller-confirmed fulfillment, then to release or dispute resolution.',
  },
  {
    term: 'Bank verification',
    detail:
      'The configured provider resolves each account number to its registered holder. Buyers see the verified name and never the account number.',
  },
  {
    term: 'Delivery-confirmed release',
    detail:
      'There is no timer starting at payment. Sellers provide shipment tracking or mark a service milestone, then buyers confirm completion or raise a dispute.',
  },
  {
    term: 'Photo uploads',
    detail:
      'Photos go from the seller’s phone straight to Cloudinary with a short-lived signed request. The API secret never leaves the server.',
  },
  {
    term: 'Stack',
    detail:
      'React, Vite and Tailwind on Vercel. Node, Express and MongoDB on Render. Paystack by default, Cloudinary for images, and Brevo for email.',
  },
];

const PRIMARY_BUTTON =
  'flex items-center justify-center gap-2 bg-ink text-paper px-6 py-3.5 font-medium rounded-lg hover:bg-ink/90 transition-colors';
const SECONDARY_BUTTON =
  'flex items-center justify-center gap-2 border border-line-strong px-6 py-3.5 font-medium rounded-lg hover:border-ink transition-colors';

function Section({ id, children }) {
  return (
    <Reveal as="section" id={id} className="border-t border-line scroll-mt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">{children}</div>
    </Reveal>
  );
}

function Heading({ children, lead }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-3xl sm:text-4xl leading-tight tracking-tight">{children}</h2>
      {lead && <p className="mt-4 text-lg text-ink/70">{lead}</p>}
    </div>
  );
}

function ProtectionCard({ title, lead, items }) {
  return (
    <div className="certificate p-6">
      <h3 className="font-display text-xl">{title}</h3>
      <p className="text-ink/60 mt-1">{lead}</p>
      <ul className="mt-5 space-y-4">
        {items.map((item) => (
          <li key={item.title} className="flex gap-3">
            <CheckIcon width={18} height={18} className="text-released shrink-0 mt-1" />
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-ink/60 mt-0.5">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  const { status } = useAuthContext();
  const { hash, key } = useLocation();
  const isAuthed = status === 'authed';
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    let active = true;
    api.getMarketplaceOverview().then((data) => {
      if (active) setOverview(data);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Scroll to a section when arriving via /#how, /#safeguards and so on.
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [hash, key]);

  return (
    <div>
      {/* Hero */}
      <section className="market-hero overflow-hidden text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[1fr_0.88fr] lg:items-center lg:gap-14 lg:py-20">
          <div className="animate-fade-in-up">
            <p className="eyebrow !text-ochre">THE ESCRIT MARKETPLACE</p>
            <h1 className="mt-3 max-w-2xl font-display text-3xl leading-[1.08] sm:mt-4 sm:text-5xl lg:text-6xl">
              Everything you need to build, learn, and scale.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:mt-5 sm:text-lg sm:leading-7">
              Find the tools, people, and practical knowledge that move your next idea forward. Search once across products, expert services, and micro-courses.
            </p>

            <div className="mt-5 flex flex-col gap-2.5 xs:flex-row sm:mt-7 sm:gap-3">
              {isAuthed ? (
                <>
                  <Link to="/marketplace" className={`${PRIMARY_BUTTON} !bg-ochre !px-4 !py-2.5 !text-forest-950 hover:!bg-ochre/90 sm:!px-6 sm:!py-3.5`}>
                    Browse marketplace <ArrowRightIcon />
                  </Link>
                  <Link to="/marketplace/new/product" className={`${SECONDARY_BUTTON} !border-white/30 !px-4 !py-2.5 !text-white hover:!border-white sm:!px-6 sm:!py-3.5`}>
                    List an item
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/marketplace" className={`${PRIMARY_BUTTON} !bg-ochre !px-4 !py-2.5 !text-forest-950 hover:!bg-ochre/90 sm:!px-6 sm:!py-3.5`}>
                    Browse marketplace <ArrowRightIcon />
                  </Link>
                  <Link to="/register" className={`${SECONDARY_BUTTON} !border-white/30 !px-4 !py-2.5 !text-white hover:!border-white sm:!px-6 sm:!py-3.5`}>
                    Start selling
                  </Link>
                </>
              )}
            </div>

            <ul className="mt-7 hidden flex-wrap gap-x-5 gap-y-2 text-xs text-white/70 sm:flex sm:text-sm">
              {[
                'Products, courses, services',
                'Verified reviews and sellers',
                'Escrow on eligible checkouts',
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckIcon width={15} height={15} className="text-ochre" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

            <div className="certificate !border-white/15 !bg-white/10 p-6 text-white backdrop-blur-sm animate-fade-in-up [animation-delay:120ms]">
              <p className="eyebrow !text-ochre">ONE GOAL, THREE WAYS FORWARD</p>
              <h2 className="mt-3 font-display text-3xl leading-tight">Build a solution, not a shopping list.</h2>
              <p className="mt-3 text-sm leading-6 text-white/70">Pair a product with an expert and a short lesson, then keep the whole journey in one place.</p>
              <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs text-white/80"><span className="rounded-md border border-white/15 p-3">Goods</span><span className="rounded-md border border-white/15 p-3">Experts</span><span className="rounded-md border border-white/15 p-3">Learning</span></div>
            </div>
        </div>
      </section>

      <Reveal as="section" className="border-b border-line bg-surface/80">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-6 sm:grid-cols-3 sm:px-6">
          {[
            { title: 'Shop and compare', body: 'Clear listings, prices, and seller storefronts.' },
            { title: 'Pay with confidence', body: 'Eligible payments stay protected in escrow.' },
            { title: 'Keep every deal together', body: 'Orders, reviews, and service conversations in one account.' },
          ].map((item) => <div key={item.title} className="border-l-2 border-ochre pl-4"><h2 className="text-sm font-semibold">{item.title}</h2><p className="mt-1 text-sm text-ink/60">{item.body}</p></div>)}
        </div>
      </Reveal>

      <Reveal><MarketplaceSearchHub /></Reveal>

      <Reveal as="section" className="border-b border-line bg-surface/70">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><p className="eyebrow">SOLUTION BUNDLES</p><h2 className="mt-2 font-display text-3xl sm:text-4xl">Start with an outcome</h2></div>
            <p className="max-w-md text-sm leading-6 text-ink/60">A practical stack for the goal in front of you: something to use, someone to help, and something short to learn.</p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              ['Start a podcast', 'Microphone + recording session + audio basics', 'Explore podcasting'],
              ['Launch your shop', 'Packaging kit + brand review + bookkeeping basics', 'Build your shop'],
              ['Take better photos', 'Phone tripod + product shoot + lighting lesson', 'Improve your photos'],
            ].map(([title, body, action]) => <Link key={title} to="/marketplace" className="group rounded-lg border border-line bg-paper p-5 transition-transform hover:-translate-y-1 hover:border-forest-700/40">
              <h3 className="font-display text-xl">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/60">{body}</p><span className="mt-5 inline-flex text-sm font-semibold text-forest-700 underline underline-offset-4 dark:text-seal">{action} <ArrowRightIcon width={15} height={15} className="ml-1 transition-transform group-hover:translate-x-1" /></span>
            </Link>)}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5 text-xs text-ink/55"><span className="font-semibold uppercase tracking-wider text-ink/70">Live on Escrit</span><span>Amaka enrolled in Product Photography</span><span>David booked a bookkeeping review</span><span>Chioma saved a camera setup</span></div>
        </div>
      </Reveal>

      <Reveal><MarketplaceDemoReel /></Reveal>

      <section className="bg-paper">
        <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">DISCOVER ESCRIT</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl">Browse a marketplace built for real decisions</h2>
            </div>
            <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700 underline underline-offset-4 dark:text-seal">
              Explore all listings <ArrowRightIcon />
            </Link>
          </div>
          {[
            { key: 'product', title: 'Featured products', items: overview?.products || [] },
            { key: 'service', title: 'Featured services', items: overview?.services || [] },
            { key: 'course', title: 'Featured courses', items: overview?.courses || [] },
          ].map(({ key, title, items }, index) => (
            <Reveal key={key} delay={index * 80}><FeaturedCarousel type={key} title={title} items={items} empty={!items.length} compact /></Reveal>
          ))}
        </div>
      </section>

      {/* Trust signals */}
      <Section id="why-escrit">
        <Heading lead="A useful marketplace makes the next decision easier, whether you are buying, booking, or learning.">Everything you expect from a marketplace, in one place</Heading>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Find quickly', 'Search across products, expert services, and practical courses with category filters that stay out of your way.'],
            ['Choose confidently', 'Compare clear prices, seller profiles, ratings, availability, and real listing details before you commit.'],
            ['Keep it together', 'Save favorites, manage products in one cart, and keep service conversations and orders in one account.'],
            ['Get support', 'Eligible payments are held until the agreed outcome, with delivery evidence and a visible dispute path.'],
          ].map(([title, body]) => <div key={title} className="border-t-2 border-ochre pt-4"><h3 className="font-display text-xl">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/65">{body}</p></div>)}
        </div>
      </Section>

      {/* Simple marketplace journey */}
      <Section id="how">
        <Heading lead="From the first search to the moment the work is complete, Escrit keeps the important details visible.">A simple path from idea to outcome</Heading>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ['01', 'Discover', 'Search by goal, browse trusted categories, or start with a solution bundle built from goods, services, and learning.'],
            ['02', 'Decide', 'Review the seller, price, availability, delivery terms, and buyer feedback. Save it, add it to your cart, or start a service conversation.'],
            ['03', 'Move forward', 'Buy with escrow where it applies, book directly for services, and follow the order or course access from your account.'],
          ].map(([number, title, body]) => <div key={number} className="certificate p-5 sm:p-6"><span className="font-mono text-sm text-ochre">{number}</span><h3 className="mt-5 font-display text-2xl">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/65">{body}</p></div>)}
        </div>
      </Section>

      {/* Trust and escrow demonstration */}
      <Section id="safeguards">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div><Heading lead="Escrow is the layer that makes buying from an independent seller feel considered, not risky.">Built to be fair to both sides</Heading><p className="mt-5 max-w-lg text-ink/65">The marketplace keeps seller identity, payment status, delivery evidence, and support in the same journey. Try the demo to see how a protected product order moves.</p><div className="mt-7 grid gap-5 sm:grid-cols-2"><ProtectionCard title="For buyers" lead="You stay in control." items={BUYER_PROTECTIONS.slice(0, 3)} /><ProtectionCard title="For sellers" lead="You get a clear path to payout." items={SELLER_PROTECTIONS.slice(0, 3)} /></div></div>
          <EscrowDemo />
        </div>
      </Section>

      {/* Verified buyer evidence */}
      <Section id="community">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <Heading lead="The strongest marketplace signal is useful feedback from people who completed a purchase.">What the Escrit community is saying</Heading>
          <Link to="/marketplace" className="inline-flex items-center gap-2 text-sm font-semibold text-forest-700 underline underline-offset-4 dark:text-seal">Read more listings <ArrowRightIcon /></Link>
        </div>
        {overview?.reviews?.length ? (
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {overview.reviews.slice(0, 3).map((review) => <article key={review._id} className="certificate p-5"><div className="flex items-center justify-between gap-3"><span className="text-ochre">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><span className="text-[10px] uppercase tracking-wider text-ink/45">Verified purchase</span></div><p className="mt-4 text-sm leading-6 text-ink/70">“{review.comment}”</p><p className="mt-5 text-xs font-semibold">{review.buyerId?.businessName || 'Escrit buyer'} <span className="font-normal text-ink/45">· {review.listingType}</span></p></article>)}
          </div>
        ) : (
          <div className="mt-10 grid gap-4 md:grid-cols-3"><div className="certificate p-5"><p className="text-2xl font-display">Verified reviews</p><p className="mt-2 text-sm leading-6 text-ink/60">Reviews come from completed Escrit orders, so buyers can see context rather than anonymous praise.</p></div><div className="certificate p-5"><p className="text-2xl font-display">One seller reputation</p><p className="mt-2 text-sm leading-6 text-ink/60">Products, services, and courses contribute to a creator’s visible marketplace profile.</p></div><div className="certificate p-5"><p className="text-2xl font-display">Live activity</p><p className="mt-2 text-sm leading-6 text-ink/60">The community ticker above reflects the kinds of buying, booking, and learning activity Escrit is built to support.</p></div></div>
        )}
      </Section>

      {/* Technical detail */}
      <Section id="stack">
        <Heading lead="Payments are verified by the configured provider; fulfillment and escrow follow one set of rules.">
          Under the hood
        </Heading>
        <dl className="mt-10 divide-y divide-line border-y border-line">
          {UNDER_THE_HOOD.map(({ term, detail }) => (
            <div key={term} className="grid gap-1 py-5 sm:grid-cols-[13rem_1fr] sm:gap-8">
              <dt className="font-medium">{term}</dt>
              <dd className="text-ink/65 max-w-2xl">{detail}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Closing call to action */}
      <Section>
        <div className="certificate p-8 sm:p-12 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl sm:text-4xl leading-tight tracking-tight">
              Sell in a marketplace that feels trustworthy from discovery to payout.
            </h2>
            <p className="mt-3 text-lg text-ink/70">
              Verify your bank account, publish listings, and let escrow do the trust work between discovery and payout.
            </p>
          </div>
          <div className="flex flex-col xs:flex-row md:flex-col lg:flex-row gap-3 shrink-0">
            {isAuthed ? (
              <Link to="/dashboard" className={PRIMARY_BUTTON}>
                Go to your dashboard <ArrowRightIcon />
              </Link>
            ) : (
              <>
                <Link to="/register" className={PRIMARY_BUTTON}>
                  Create your account <ArrowRightIcon />
                </Link>
                <Link to="/login" className={SECONDARY_BUTTON}>
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
        <p className="mt-6 text-sm text-ink/55">
          Buyers create an account to save listings, manage a cart, and keep every escrow-protected order together.
        </p>
      </Section>
    </div>
  );
}
