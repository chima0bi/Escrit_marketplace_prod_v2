// Small fetch wrapper: every call shares the same auth header, JSON
// handling and error shape. The access token lives in memory only; the
// refresh token is an httpOnly cookie managed by the browser.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function getRealtimeUrl() {
  return import.meta.env.VITE_API_URL || window.location.origin;
}

// Empty in development (Vite proxies /api to the local server). In
// production, set VITE_API_URL to the API's full URL.
const API_BASE = import.meta.env.VITE_API_URL || '';

// Access tokens are short-lived, so an authed call can hit a 401 at any
// time. One refresh is shared by all concurrent 401s to avoid a burst of
// /auth/refresh requests.
let refreshPromise = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Session expired');
        accessToken = data.accessToken;
        return accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request(path, { method = 'GET', body, auth = false } = {}, isRetry = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    credentials: 'include', // sends the refresh cookie
    body: body ? JSON.stringify(body) : undefined,
  });

  // Retry once after refreshing, but never for the refresh call itself.
  if (res.status === 401 && auth && !isRetry && path !== '/auth/refresh') {
    try {
      await refreshAccessToken();
      return request(path, { method, body, auth }, true);
    } catch {
      accessToken = null;
      throw new Error('Your session expired. Please log in again.');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function notifyCartChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('escrit:cart-updated'));
}

export const api = {
  // Auth
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  refresh: () => request('/auth/refresh', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me', { auth: true }),
  googleConfig: () => request('/auth/google/config'),
  googleLogin: (idToken) => request('/auth/google', { method: 'POST', body: { idToken } }),
  resendOtp: () => request('/auth/resend-otp', { method: 'POST', auth: true }),
  verifyOtp: (code) => request('/auth/verify-otp', { method: 'POST', body: { code }, auth: true }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: payload }),

  // Seller: payout account
  listBanks: () => request('/seller/banks', { auth: true }),
  saveBankAccount: (payload) => request('/seller/bank-account', { method: 'POST', body: payload, auth: true }),
  updateSellerProfile: (payload) => request('/seller/profile', { method: 'PATCH', body: payload, auth: true }),

  // Seller: payment links
  createLink: (payload) => request('/links', { method: 'POST', body: payload, auth: true }),
  listLinks: () => request('/links', { auth: true }),
  getLink: (id) => request(`/links/${id}`, { auth: true }),
  setLinkActive: (id, active) => request(`/links/${id}`, { method: 'PATCH', body: { active }, auth: true }),
  updateFulfillment: (linkId, txId, payload) => request(`/links/${linkId}/transactions/${txId}/fulfillment`, { method: 'PATCH', body: payload, auth: true }),
  submitSellerEvidence: (linkId, txId, payload) => request(`/links/${linkId}/transactions/${txId}/evidence`, { method: 'POST', body: payload, auth: true }),
  getUploadSignature: () => request('/links/upload-signature', { method: 'POST', auth: true }),

  // Marketplace listings
  getMarketplace: (type = 'product') => request(`/marketplace/${type}`),
  getCategories: (type) => request(`/marketplace/categories/${type}`),
  getMarketplaceOverview: () => request('/marketplace/overview'),
  getMarketplaceListing: (type, id) => request(`/marketplace/${type}/${id}`),
  directCheckout: (type, id, payload = {}) => request(`/marketplace/${type}/${id}/checkout`, { method: 'POST', body: payload, auth: true }),
  getListingReviews: (type, id) => request(`/marketplace/${type}/${id}/reviews`),
  getReviewEligibility: (type, id) => request(`/marketplace/me/review-eligibility/${type}/${id}`, { auth: true }),
  createListingReview: (type, id, payload) => request(`/marketplace/${type}/${id}/reviews`, { method: 'POST', body: payload, auth: true }),
  listServiceOffers: () => request('/service-offers', { auth: true }),
  createServiceOffer: (payload) => request('/service-offers', { method: 'POST', body: payload, auth: true }),
  getOfferMessages: (id) => request(`/service-offers/${id}/messages`, { auth: true }),
  sendOfferMessage: (id, body) => request(`/service-offers/${id}/messages`, { method: 'POST', body: { body }, auth: true }),
  counterServiceOffer: (id, payload) => request(`/service-offers/${id}/counter`, { method: 'POST', body: payload, auth: true }),
  acceptServiceOffer: (id) => request(`/service-offers/${id}/accept`, { method: 'POST', body: {}, auth: true }),
  rejectServiceOffer: (id) => request(`/service-offers/${id}/reject`, { method: 'POST', body: {}, auth: true }),
  listProductOffers: () => request('/product-offers', { auth: true }),
  createProductOffer: (payload) => request('/product-offers', { method: 'POST', body: payload, auth: true }),
  respondProductOffer: (id, decision) => request(`/product-offers/${id}/respond`, { method: 'POST', body: { decision }, auth: true }),
  getPublicSeller: (id) => request(`/marketplace/seller/${id}`),
  previewListingPrice: (amount, discount) => {
    const params = new URLSearchParams({ amount: String(amount) });
    if (discount) {
      params.set('discountPercent', String(discount.percent));
      params.set('startsAt', discount.startsAt);
      params.set('endsAt', discount.endsAt);
    }
    return request(`/marketplace/price-preview?${params}`, { auth: true });
  },
  createMarketplaceListing: (type, payload) => request(`/marketplace/${type}`, { method: 'POST', body: payload, auth: true }),
  getCart: () => request('/marketplace/me/cart', { auth: true }),
  getBuyerOrders: () => request('/marketplace/me/orders', { auth: true }),
  getSellerAnalytics: () => request('/marketplace/me/analytics', { auth: true }),
  getPlatformCredits: () => request('/marketplace/me/credits', { auth: true }),
  spendPlatformCredits: (payload) => request('/marketplace/me/credits/spend', { method: 'POST', body: payload, auth: true }),
  getMyListings: () => request('/marketplace/me/listings', { auth: true }),
  setMyListingActive: (type, id, active) => request(`/marketplace/me/listings/${type}/${id}`, { method: 'PATCH', body: { active }, auth: true }),
  addCartItem: async (listingType, listingId) => { const result = await request('/marketplace/me/cart', { method: 'POST', body: { listingType, listingId }, auth: true }); notifyCartChanged(); return result; },
  checkoutCart: () => request('/marketplace/me/cart/checkout', { method: 'POST', body: {}, auth: true }),
  setCartQuantity: async (listingType, listingId, quantity) => { const result = await request(`/marketplace/me/cart/${listingType}/${listingId}`, { method: 'PATCH', body: { quantity }, auth: true }); notifyCartChanged(); return result; },
  removeCartItem: async (listingType, listingId) => { const result = await request(`/marketplace/me/cart/${listingType}/${listingId}`, { method: 'DELETE', auth: true }); notifyCartChanged(); return result; },
  getFavorites: () => request('/marketplace/me/favorites', { auth: true }),
  addFavorite: (listingType, listingId) => request('/marketplace/me/favorites', { method: 'POST', body: { listingType, listingId }, auth: true }),
  removeFavorite: (listingType, listingId) => request(`/marketplace/me/favorites/${listingType}/${listingId}`, { method: 'DELETE', auth: true }),

  // Buyer: a link is the shared product page; each checkout is its own order.
  getPublicLink: (linkId) => request(`/r/${linkId}`),
  checkout: (linkId, payload = {}) => request(`/r/${linkId}/checkout`, { method: 'POST', body: payload, auth: true }),
  getPublicTransaction: (linkId, txId) => request(`/r/${linkId}/t/${txId}`, { auth: true }),
  confirmReceipt: (linkId, txId) => request(`/r/${linkId}/t/${txId}/confirm-receipt`, { method: 'POST', auth: true }),
  raiseDispute: (linkId, txId, payload) => request(`/r/${linkId}/t/${txId}/dispute`, { method: 'POST', body: payload, auth: true }),
  reportServiceNoShow: (linkId, txId, payload) => request(`/r/${linkId}/t/${txId}/no-show-reason`, { method: 'POST', body: payload, auth: true }),
  submitBuyerEvidence: (linkId, txId, payload) => request(`/r/${linkId}/t/${txId}/evidence`, { method: 'POST', body: payload, auth: true }),
  resolveProductNoShow: (linkId, txId, outcome) => request(`/links/${linkId}/transactions/${txId}/no-show-resolution`, { method: 'POST', body: { outcome }, auth: true }),

  // Admin
  listDisputes: () => request('/admin/disputes', { auth: true }),
  listAdminComplaints: () => request('/admin/complaints', { auth: true }),
  resolveDispute: (id, payload) => request(`/admin/disputes/${id}/resolve`, { method: 'POST', body: payload, auth: true }),
  listAdminKyc: () => request('/admin/kyc', { auth: true }),
  reviewKyc: (id, payload) => request(`/admin/kyc/${id}/review`, { method: 'POST', body: payload, auth: true }),
  listUnverifiedListings: () => request('/admin/listings', { auth: true }),
  listCategoryRequests: () => request('/admin/categories', { auth: true }),
  listApprovedCategories: (type) => request(`/admin/categories/${type}/approved`, { auth: true }),
  reviewCategoryRequest: (type, id, payload) => request(`/admin/categories/${type}/${id}/review`, { method: 'POST', body: payload, auth: true }),
  reviewListing: (type, id, payload) => request(`/admin/listings/${type}/${id}/review`, { method: 'POST', body: payload, auth: true }),
  listAdminUsers: () => request('/admin/users', { auth: true }),
  setUserRole: (id, role) => request(`/admin/users/${id}/role`, { method: 'PATCH', body: { role }, auth: true }),
  getPublicConfig: () => request('/public-config'),
  getPlatformSettings: () => request('/admin/settings', { auth: true }),
  updatePlatformSettings: (payload) => request('/admin/settings', { method: 'PATCH', body: payload, auth: true }),
  removeDemoData: () => request('/admin/demo-data', { method: 'DELETE', auth: true }),
};
