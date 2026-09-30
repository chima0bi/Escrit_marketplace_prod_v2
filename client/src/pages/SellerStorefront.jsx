import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { usePageTitle } from '../lib/usePageTitle.js';

export default function SellerStorefront() {
  const { sellerId } = useParams();
  const [store, setStore] = useState(null);
  const [error, setError] = useState('');
  usePageTitle(store?.seller?.businessName || 'Seller storefront');

  useEffect(() => {
    let active = true;
    api.getPublicSeller(sellerId)
      .then((data) => active && setStore(data))
      .catch((err) => active && setError(err.message || 'Seller not found.'));
    return () => { active = false; };
  }, [sellerId]);

  if (error) return <p role="alert" className="text-sm text-dispute">{error}</p>;
  if (!store) return <p className="py-10 text-sm text-ink/55">Loading seller storefront…</p>;

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/marketplace" className="text-sm text-ink/55 underline underline-offset-4">Marketplace</Link>
      <header className="mt-5 flex flex-wrap items-center gap-5 border-y border-line py-7">
        {store.seller.profilePictureUrl && <img src={store.seller.profilePictureUrl} alt="" className="h-20 w-20 rounded-full object-cover" />}
        <div>
          <p className="text-xs uppercase tracking-wider text-ink/50">Seller storefront</p>
          <h1 className="mt-1 font-display text-3xl">{store.seller.businessName}</h1>
          <p className="mt-2 text-sm text-ink/60">{store.seller.averageRating ? `★ ${Number(store.seller.averageRating).toFixed(1)}` : 'New seller'} · {store.seller.reviewCount || 0} buyer reviews</p>
          {store.seller.bio && <p className="mt-2 max-w-2xl text-sm text-ink/65">{store.seller.bio}</p>}
          <p className="mt-2 text-xs text-ink/45">On Escrit since {new Date(store.seller.createdAt).toLocaleDateString()}</p>
        </div>
      </header>
      <div className="mt-8 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl">Listings</h2>
        <span className="text-sm text-ink/50">{store.listings.length} active</span>
      </div>
      {store.listings.length === 0 ? <p className="border-y border-line py-8 text-sm text-ink/55">This seller has no active listings yet.</p> : (
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {store.listings.map((item) => (
            <Link key={`${item.listingType}:${item._id}`} to={`/marketplace/${item.listingType}/${item._id}`} className="overflow-hidden rounded-lg border border-line bg-paper hover:border-ink/40">
              <img src={item.images?.[0] || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="p-3"><p className="text-xs uppercase text-ink/45">{item.listingType}</p><p className="mt-1 truncate text-sm font-medium">{item.title}</p><p className="mt-2 font-semibold">{item.listingType === 'service' && !item.basePrice ? 'Get a quote' : item.buyerPriceKobo == null ? 'Price unavailable' : `₦${Number(item.buyerPriceKobo / 100).toLocaleString()}`}</p></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
