import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext.jsx';
import {
  LockIcon,
  BankIcon,
  LinkIcon,
  CompassIcon,
  LogoutIcon,
  AlertIcon,
  ShieldCheckIcon,
  MenuIcon,
  PlusIcon,
  CartIcon,
  HeartIcon,
  UserIcon,
} from './icons.jsx';
import { resetTours, SELLER_TOUR_KEYS } from './SpotlightTour.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import AmbientBackground from './AmbientBackground.jsx';
import MobileMenu from './MobileMenu.jsx';
import PaymentModeRibbon from './PaymentModeRibbon.jsx';
import { api } from '../lib/api.js';

// Icon-over-label item for the signed-in desktop nav. `tourId` lets a
// walkthrough step point at this item.
function NavItem({ to, onClick, icon, label, active, badge, title, tourId }) {
  const Comp = to ? Link : 'button';
  return (
    <Comp
      to={to}
      onClick={(event) => {
        onClick?.(event);
        event.currentTarget.closest('details')?.removeAttribute('open');
      }}
      title={title}
      type={to ? undefined : 'button'}
      data-tour={tourId}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-3.5 py-2 min-w-[3.25rem] transition-colors ${
        active ? 'bg-ink text-paper shadow-card' : 'text-ink/55 hover:text-ink hover:bg-line/40'
      }`}
    >
      <span className="relative flex items-center justify-center w-5 h-5">
        {icon}
        {typeof badge === 'number' ? (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>
        ) : badge && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-dispute animate-pulse-soft-dispute" title={badge} />
        )}
      </span>
      <span className="text-[11px] font-medium leading-none whitespace-nowrap">{label}</span>
    </Comp>
  );
}

const TEXT_LINK = 'text-sm font-medium text-ink/70 hover:text-ink transition-colors px-2 py-2';

export default function Layout({ children }) {
  const { status, seller, hasBankAccount, logout } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const menuButtonRef = useRef(null);

  const isHome = location.pathname === '/';
  const isAccountPage = location.pathname === '/login' || location.pathname === '/register';
  const isBuyerSide = location.pathname.startsWith('/r/');
  const isAuthed = status === 'authed';
  const isChecking = status === 'checking';
  const showEmailBanner = isAuthed && !isBuyerSide && seller && seller.emailVerified === false;

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Any navigation closes the menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  const refreshCartCount = useCallback(() => {
    if (!isAuthed) {
      setCartCount(0);
      return;
    }
    api.getCart()
      .then(({ items = [] }) => setCartCount(items.reduce((sum, entry) => sum + Number(entry.quantity || 1), 0)))
      .catch(() => setCartCount(0));
  }, [isAuthed]);

  useEffect(() => {
    refreshCartCount();
    window.addEventListener('escrit:cart-updated', refreshCartCount);
    return () => window.removeEventListener('escrit:cart-updated', refreshCartCount);
  }, [refreshCartCount, location.pathname]);

  async function onLogout() {
    await logout();
    navigate('/');
  }

  // Restarts the walkthrough from its first page. Clearing every stage's
  // "seen" flag lets it play from the top rather than resume mid-flow.
  function onReplayTour() {
    resetTours(SELLER_TOUR_KEYS);
    const restartPath = hasBankAccount ? '/dashboard' : '/dashboard/bank';
    if (location.pathname === restartPath) window.location.reload();
    else navigate(restartPath);
  }

  const sellerItems = [
    { key: 'home', to: '/', label: 'Home', Icon: CompassIcon, active: location.pathname === '/' },
    { key: 'list-product', to: '/marketplace/new/product', label: 'List product', Icon: PlusIcon, primary: true },
    { key: 'marketplace', to: '/marketplace', label: 'Marketplace', Icon: CompassIcon, primary: true, active: location.pathname === '/marketplace' },
    { key: 'cart', to: '/account/cart', label: 'Cart', Icon: CartIcon, primary: true, active: location.pathname === '/account/cart', badge: cartCount },
    {
      key: 'bank',
      to: '/dashboard/bank',
      label: 'Bank',
      Icon: BankIcon,
      primary: true,
      active: location.pathname === '/dashboard/bank',
      badge: hasBankAccount ? null : 'No bank account on file',
      tourId: 'bank-nav',
    },
    { key: 'dashboard', to: '/dashboard', label: 'Dashboard & links', Icon: LinkIcon, active: location.pathname.startsWith('/dashboard') && location.pathname !== '/dashboard/bank' },
    { key: 'favorites', to: '/account/favorites', label: 'Saved listings', Icon: HeartIcon, active: location.pathname === '/account/favorites' },
    { key: 'orders', to: '/account/orders', label: 'My orders', Icon: LinkIcon, active: location.pathname === '/account/orders' },
    { key: 'offers', to: '/account/offers', label: 'Service offers & chat', Icon: LinkIcon, active: location.pathname.startsWith('/account/offers') },
    { key: 'price-offers', to: '/account/price-offers', label: 'Product price offers', Icon: LinkIcon, active: location.pathname === '/account/price-offers' },
    { key: 'credits', to: '/account/credits', label: 'Promotion credits', Icon: LinkIcon, active: location.pathname === '/account/credits' },
    { key: 'profile', to: '/settings', label: 'Profile settings', Icon: ShieldCheckIcon, active: location.pathname === '/settings' },
    { key: 'how', to: '/#how', label: 'How it works', Icon: CompassIcon },
    { key: 'safeguards', to: '/#safeguards', label: 'Safeguards', Icon: ShieldCheckIcon },
    { key: 'tour', onClick: onReplayTour, label: 'Tour', Icon: CompassIcon, title: 'Replay the walkthrough' },
    ...(seller?.isAdmin
      ? [
          {
            key: 'disputes',
            to: '/admin/disputes',
            label: 'Disputes',
            Icon: AlertIcon,
            active: location.pathname === '/admin/disputes',
            title: 'Admin: dispute resolution',
          },
          { key: 'complaints', to: '/admin/complaints', label: 'Buyer complaints', Icon: AlertIcon, active: location.pathname === '/admin/complaints' },
          { key: 'kyc-review', to: '/admin/kyc', label: 'KYC review', Icon: ShieldCheckIcon, active: location.pathname === '/admin/kyc' },
          { key: 'listing-review', to: '/admin/listings', label: 'Listing review', Icon: CompassIcon, active: location.pathname === '/admin/listings' },
          { key: 'category-review', to: '/admin/categories', label: 'Category requests', Icon: CompassIcon, active: location.pathname === '/admin/categories' },
          { key: 'platform-settings', to: '/admin/settings', label: 'Platform settings', Icon: LinkIcon, active: location.pathname === '/admin/settings' },
          ...(seller?.isOwner ? [{ key: 'roles', to: '/admin/users', label: 'Manage admin roles', Icon: ShieldCheckIcon, active: location.pathname === '/admin/users' }] : []),
        ]
      : []),
    { key: 'logout', onClick: onLogout, label: 'Log out', Icon: LogoutIcon },
  ];

  const learnItems = [
    { key: 'home', to: '/', label: 'Home', Icon: CompassIcon },
    { key: 'marketplace', to: '/marketplace', label: 'Marketplace', Icon: CompassIcon },
    { key: 'how', to: '/#how', label: 'How it works', Icon: CompassIcon },
    { key: 'safeguards', to: '/#safeguards', label: 'Safeguards', Icon: ShieldCheckIcon },
  ];

  let menuItems;
  if (isBuyerSide) {
    menuItems = [
      { key: 'how', to: '/#how', label: 'How Escrit protects you', Icon: ShieldCheckIcon },
      isAuthed
        ? { key: 'dash', to: '/dashboard', label: 'Go to dashboard', variant: 'primary' }
        : { key: 'sell', to: '/register', label: 'Sell with Escrit', variant: 'secondary' },
    ];
  } else if (isAuthed) {
    menuItems = sellerItems;
  } else {
    menuItems = [
      { key: 'how', to: '/#how', label: 'How it works', Icon: CompassIcon },
      { key: 'safeguards', to: '/#safeguards', label: 'Safeguards', Icon: ShieldCheckIcon },
      { key: 'login', to: '/login', label: 'Log in', variant: 'secondary' },
      { key: 'register', to: '/register', label: 'Create account', variant: 'primary' },
    ];
  }

  const brand = (
    <Link to={isAuthed ? '/marketplace' : '/'} className="flex items-center gap-2.5 shrink-0">
      <img src="/logo-icon.png" alt="" width={28} height={28} className="w-7 h-7" />
      <span className="font-display text-xl">Escrit</span>
      {!isAuthed && (
        <span className="hidden lg:flex items-center gap-1.5 text-[11px] text-forest-800 dark:text-seal border border-line px-2.5 py-1 rounded-full">
          <LockIcon width={11} height={11} /> marketplace · escrow protected
        </span>
      )}
      {isAuthed && seller && !isBuyerSide && (
        <span className="hidden md:inline text-ink/40 text-sm truncate max-w-[9rem] border-l border-line pl-3 ml-0.5">
          {seller.businessName}
        </span>
      )}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col relative">
      <AmbientBackground />
      <PaymentModeRibbon />

      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {brand}

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthed && !isBuyerSide && (
              <nav className="flex items-center gap-1.5" aria-label="Main">
                {sellerItems.filter((item) => item.primary).map(({ key, to, onClick, Icon, label, active, badge, title, tourId }) => (
                  <NavItem
                    key={key}
                    to={to}
                    onClick={onClick}
                    icon={<Icon width={18} height={18} />}
                    label={label}
                    active={active}
                    badge={badge}
                    title={title}
                    tourId={tourId}
                  />
                ))}
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-ink/65 hover:bg-line/40 hover:text-ink">
                    <MenuIcon width={18} height={18} /> More
                  </summary>
                  <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[min(70vh,32rem)] min-w-56 flex-col gap-1 overflow-y-auto overscroll-contain rounded-xl border border-line bg-paper p-2 shadow-card">
                    {sellerItems.filter((item) => !item.primary).map(({ key, to, onClick, Icon, label, active, badge, title, tourId }) => (
                      <NavItem
                        key={key}
                        to={to}
                        onClick={onClick}
                        icon={<Icon width={18} height={18} />}
                        label={label}
                        active={active}
                        badge={badge}
                        title={title}
                        tourId={tourId}
                      />
                    ))}
                  </div>
                </details>
              </nav>
            )}

            {!isAuthed && !isChecking && !isBuyerSide && (
              <nav className="flex items-center gap-1" aria-label="Main">
                <Link to="/marketplace" className={TEXT_LINK}>Marketplace</Link>
                <NavItem to="/account/cart" icon={<CartIcon width={18} height={18} />} label="Cart" badge={0} title="Shopping cart" />
                <details className="relative">
                  <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-ink/65 hover:bg-line/40 hover:text-ink"><MenuIcon width={17} height={17} /> More</summary>
                  <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[min(70vh,32rem)] min-w-56 flex-col gap-1 overflow-y-auto overscroll-contain rounded-lg border border-line bg-paper p-2 shadow-card">
                    {learnItems.map(({ key, to, label, Icon }) => <NavItem key={key} to={to} icon={<Icon width={17} height={17} />} label={label} />)}
                  </div>
                </details>
                <Link to="/login" className={`${TEXT_LINK} ml-2`}>Log in</Link>
                <Link
                  to="/register"
                  className="ml-1 bg-ink text-paper text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors"
                >
                  Get started
                </Link>
              </nav>
            )}

            <ThemeToggle />
          </div>

          {!isChecking && !isAuthed && <Link to="/account/cart" aria-label="Shopping cart, 0 items" className="relative flex items-center gap-1 text-sm text-ink/70 md:hidden"><CartIcon width={20} height={20} /><span>Cart</span><span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">0</span></Link>}
          {!isChecking && isAuthed && isBuyerSide && <Link to="/account/cart" aria-label={`Shopping cart, ${cartCount} items`} className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink/70 hover:bg-line/40"><CartIcon width={20} height={20} />{cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{cartCount > 99 ? '99+' : cartCount}</span>}</Link>}

          {/* Small screens: everything lives in the full-screen menu. */}
          {!isChecking && (!isAuthed || isBuyerSide) && (
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="md:hidden flex items-center justify-center w-11 h-11 -mr-2 rounded-xl text-ink hover:bg-line/40 transition-colors"
            >
              <MenuIcon />
            </button>
          )}
        </div>

        {showEmailBanner && (
          <div
            className="mx-auto mt-2.5 flex max-w-7xl items-center gap-2 rounded-md border border-seal/30 bg-seal-soft px-3 py-1.5 text-xs text-seal"
          >
            <span className="flex-1">Verify your email to keep full access to your account.</span>
            <Link
              to={`/verify-email?next=${encodeURIComponent(location.pathname)}`}
              className="font-medium underline underline-offset-2 shrink-0"
            >
              Verify now
            </Link>
          </div>
        )}
      </header>

      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        items={menuItems}
        brand={brand}
        heading={isAuthed && !isBuyerSide ? seller?.businessName : null}
      />

      {/* Keyed by path so each navigation replays the page transition. */}
      <main
        key={location.pathname}
        className={`relative z-10 flex-1 w-full animate-page-in ${
          isHome ? '' : `px-4 sm:px-6 py-8 mx-auto ${location.pathname === '/marketplace' || location.pathname === '/dashboard' || isAccountPage ? 'max-w-6xl' : 'max-w-2xl'}`
        } ${isAuthed && !isBuyerSide ? 'pb-24 md:pb-8' : ''}`}
      >
        {children}
      </main>

      {isAuthed && !isBuyerSide && (
        <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 overflow-x-auto border-t border-line bg-paper/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="mx-auto flex min-w-[20rem] max-w-lg items-end justify-around py-2">
            <BottomNavItem to="/marketplace" label="Market" icon={<CompassIcon width={20} height={20} />} />
            <BottomNavItem to="/account/cart" label="Cart" icon={<CartIcon width={20} height={20} />} badge={cartCount} />
            <BottomNavItem to="/marketplace/new/product" label="Sell" icon={<PlusIcon width={23} height={23} />} featured />
            <BottomNavItem to="/account/offers" label="Chat" icon={<LinkIcon width={20} height={20} />} />
            <BottomNavButton buttonRef={menuButtonRef} onClick={() => setMenuOpen(true)} label="Profile" icon={<UserIcon width={20} height={20} />} expanded={menuOpen} />
          </div>
        </nav>
      )}

      <footer className="site-footer relative z-10 mt-16 border-t border-forest-700/30 bg-forest-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-14 md:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
          <div className="max-w-sm">
            <Link to="/marketplace" className="inline-flex items-center gap-2.5 font-display text-xl font-bold text-white">
              <img src="/logo-icon.png" alt="" width={28} height={28} className="h-7 w-7" /> Escrit
            </Link>
            <p className="mt-4 text-sm leading-6 text-white/65">A marketplace for products, courses, and services, with escrow protection built into eligible payments.</p>
            <p className="mt-5 inline-flex items-center gap-2 text-xs text-white/75"><LockIcon width={13} height={13} className="text-ochre" /> Funds stay held until fulfillment is confirmed.</p>
          </div>
          <FooterColumn title="Marketplace" links={[
            ['Products', '/marketplace?type=product'], ['Courses', '/marketplace?type=course'], ['Services', '/marketplace?type=service'],
            ...(isAuthed ? [['Saved listings', '/account/favorites']] : []),
          ]} />
          <FooterColumn title="For sellers" links={isAuthed ? [
            ['List an item', '/marketplace/new/product'], ['Seller account hub', '/dashboard'], ['Payout details', '/dashboard/bank'], ['Promotion credits', '/account/credits'],
          ] : [['Start selling', '/register']]} />
          <FooterColumn title="Trust and support" links={[
            ['How it works', '/#how'], ['Safeguards', '/#safeguards'], ...(isAuthed ? [['Profile and identity', '/settings']] : [['Log in', '/login']]),
          ]} />
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-white/45 sm:px-6">
            <span>© {new Date().getFullYear()} Escrit Marketplace</span>
            <span>Built for StacStart Borderless Bytes</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, links }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm text-white/60">
        {links.map(([label, to]) => (
          <li key={label}><Link to={to} className="transition-colors hover:text-ochre">{label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}

function BottomNavItem({ to, label, icon, featured, badge }) {
  return (
    <Link to={to} title={label} aria-label={label} className={`flex min-w-14 flex-col items-center justify-center gap-1 text-ink/60 ${featured ? '-translate-y-1 text-ink' : ''}`}>
      <span className={`relative flex items-center justify-center rounded-full ${featured ? 'h-12 w-12 border border-ink bg-ink text-paper shadow-card' : 'h-9 w-9'}`}>
        {icon}
        {typeof badge === 'number' && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-dispute px-1 text-[9px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>}
      </span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}

function BottomNavButton({ buttonRef, onClick, label, icon, expanded }) {
  return (
    <button ref={buttonRef} type="button" onClick={onClick} title={label} aria-label={label} aria-expanded={expanded} aria-controls="mobile-menu" className="flex min-w-14 flex-col items-center justify-center gap-1 text-ink/60">
      <span className="flex h-9 w-9 items-center justify-center">{icon}</span>
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
