import { Router } from 'express';
import Joi from 'joi';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Course } from '../models/Course.js';
import { Service } from '../models/Service.js';
import { Review } from '../models/Review.js';
import { Link } from '../models/Link.js';
import { ProductCategory, CourseCategory, ServiceCategory } from '../models/ListingCategory.js';
import { AppError } from '../middleware/errorHandler.js';
import { Transaction, TX_STATUS } from '../models/Transaction.js';
import { generateReference } from '../utils/reference.js';
import { initializeTransaction, quoteCollectionFee, getPaymentProviderName } from '../services/paymentProvider.js';
import { env } from '../config/env.js';
import { ensureCheckoutPrice } from '../services/pricing.js';
import { getPlatformSettings } from '../services/platformSettings.js';
import { PlatformCreditEntry } from '../models/PlatformCreditEntry.js';

export const marketplaceRouter = Router();

const TYPE_CONFIG = {
  product: { Model: Product, Category: ProductCategory },
  course: { Model: Course, Category: CourseCategory },
  service: { Model: Service, Category: ServiceCategory },
};

async function loadListing(listingType, listingId) {
  const config = TYPE_CONFIG[listingType];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const item = await config.Model.findOne({ _id: listingId, isActive: true, isVerified: true }).populate('seller', 'businessName profilePictureUrl isDemoSeed');
  if (!item) throw new AppError(404, 'Listing is no longer available');
  return item;
}

async function populateSavedItems(entries) {
  const listings = await Promise.all(entries.map(async (entry) => {
    try {
      const listing = await loadListing(entry.listingType, entry.listingId);
      return { entry, listing };
    } catch {
      return null;
    }
  }));
  const validListings = listings.filter(Boolean);
  const links = await Link.find({ _id: { $in: validListings.map(({ listing }) => listing.escrowLinkId).filter(Boolean) } });
  await Promise.all(links.map(ensureCheckoutPrice));
  const priceByLinkId = new Map(links.map((link) => [String(link._id), link.checkoutPriceKobo]));

  return validListings.map(({ entry, listing }) => ({
    listingType: entry.listingType,
    listing: {
      ...listing.toObject(),
      buyerPriceKobo: priceByLinkId.get(String(listing.escrowLinkId)) ?? null,
    },
    quantity: entry.quantity || 1,
  }));
}

const listingReferenceSchema = Joi.object({
  listingType: Joi.string().valid('product', 'course', 'service').required(),
  listingId: Joi.string().hex().length(24).required(),
});
const cartQuantitySchema = Joi.object({ quantity: Joi.number().integer().min(1).max(100).required() });
const pricePreviewSchema = Joi.object({
  amount: Joi.number().min(100).max(100000000).required(),
  discountPercent: Joi.number().integer().min(1).max(90).optional(),
  startsAt: Joi.date().iso().optional(),
  endsAt: Joi.date().iso().optional(),
}).custom((value, helpers) => {
  if (value.discountPercent != null && (!value.startsAt || !value.endsAt || value.endsAt <= value.startsAt)) return helpers.error('any.invalid');
  return value;
});

marketplaceRouter.get('/price-preview', requireAuth, asyncHandler(async (req, res) => {
  const { error, value } = pricePreviewSchema.validate(req.query);
  if (error) throw new AppError(400, 'Enter a valid listing price to preview checkout');
  const basePriceKobo = Math.round(value.amount * 100);
  const now = new Date();
  const discountApplied = value.discountPercent != null && value.startsAt <= now && value.endsAt >= now;
  const effectivePriceKobo = discountApplied ? Math.max(10000, Math.round(basePriceKobo * (100 - value.discountPercent) / 100)) : basePriceKobo;
  const processingFeeKobo = await quoteCollectionFee(effectivePriceKobo);
  const { commissionPercent } = await getPlatformSettings();
  const commissionKobo = Math.floor(effectivePriceKobo * commissionPercent / 100);
  res.json({
    buyerPriceKobo: effectivePriceKobo + processingFeeKobo,
    sellerPayoutKobo: effectivePriceKobo - commissionKobo,
    discountApplied,
  });
}));

marketplaceRouter.get('/categories/:type', asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.params.type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const categories = await config.Category.find({ isActive: true, approvalStatus: 'approved' }).sort({ name: 1 }).select('name slug');
  res.json({ categories });
}));

marketplaceRouter.get('/me/cart', requireAuth, asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  const nonCartItems = buyer.cartItems.filter((entry) => entry.listingType === 'service');
  if (nonCartItems.length) {
    for (const entry of nonCartItems) {
      if (!buyer.favoriteListings.some((favorite) => favorite.listingType === entry.listingType && String(favorite.listingId) === String(entry.listingId))) {
        buyer.favoriteListings.push({ listingType: entry.listingType, listingId: entry.listingId });
      }
    }
    buyer.cartItems = buyer.cartItems.filter((entry) => entry.listingType === 'product');
    await buyer.save();
  }
  const items = await populateSavedItems(buyer.cartItems);
  const totalKobo = items.reduce((sum, entry) => sum + Number(entry.listing.buyerPriceKobo || 0) * entry.quantity, 0);
  res.json({ items, subtotalKobo: totalKobo, totalKobo, feeQuoteAvailable: items.every((entry) => entry.listing.buyerPriceKobo != null) });
}));

marketplaceRouter.get('/me/orders', requireAuth, asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ buyerUserId: req.sellerId }).sort({ createdAt: -1 }).populate('linkId');
  res.json({ orders: transactions.filter((transaction) => transaction.linkId) });
}));

marketplaceRouter.get('/me/analytics', requireAuth, asyncHandler(async (req, res) => {
  const links = await Link.find({ sellerId: req.sellerId }).select('_id itemName listingType');
  const linkIds = links.map((link) => link._id);
  const transactions = await Transaction.find({ linkId: { $in: linkIds } }).sort({ createdAt: -1 });
  const linkById = new Map(links.map((link) => [String(link._id), link]));
  const paidStatuses = new Set([TX_STATUS.PAID_HELD, TX_STATUS.RELEASED, TX_STATUS.DISPUTED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.RESOLVED_REFUNDED, TX_STATUS.RESOLVED_CREDITED, TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED]);
  const { commissionPercent } = await getPlatformSettings();
  const paid = transactions.filter((transaction) => paidStatuses.has(transaction.status));
  const grossPaidKobo = paid.reduce((sum, transaction) => sum + (transaction.buyerPriceKoboSnapshot || transaction.checkoutTotalKobo || 0) * (transaction.checkoutQuantity || 1), 0);
  const estimatedSellerPayoutKobo = paid.reduce((sum, transaction) => {
    const base = (transaction.sellerPayoutBaseKobo || 0) * (transaction.checkoutQuantity || 1);
    return sum + base - Math.floor(base * commissionPercent / 100);
  }, 0);
  const lastSevenDays = Array.from({ length: 7 }, (_, offset) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - offset));
    const key = day.toISOString().slice(0, 10);
    const amountKobo = paid.filter((transaction) => transaction.paidAt && new Date(transaction.paidAt).toISOString().slice(0, 10) === key)
      .reduce((sum, transaction) => sum + (transaction.buyerPriceKoboSnapshot || transaction.checkoutTotalKobo || 0) * (transaction.checkoutQuantity || 1), 0);
    return { date: key, amountKobo };
  });
  const topListings = [...transactions.reduce((map, transaction) => {
    const link = linkById.get(String(transaction.linkId));
    if (!link) return map;
    const row = map.get(String(link._id)) || { linkId: String(link._id), title: link.itemName, listingType: link.listingType, orders: 0, grossPaidKobo: 0 };
    row.orders += 1;
    if (paidStatuses.has(transaction.status)) row.grossPaidKobo += (transaction.buyerPriceKoboSnapshot || transaction.checkoutTotalKobo || 0) * (transaction.checkoutQuantity || 1);
    map.set(String(link._id), row);
    return map;
  }, new Map()).values()].sort((left, right) => right.grossPaidKobo - left.grossPaidKobo).slice(0, 5);

  res.json({
    totalOrders: transactions.length,
    paidOrders: paid.length,
    grossPaidKobo,
    estimatedSellerPayoutKobo,
    heldOrders: transactions.filter((transaction) => transaction.status === TX_STATUS.PAID_HELD).length,
    disputedOrders: transactions.filter((transaction) => transaction.status === TX_STATUS.DISPUTED).length,
    directSales: transactions.filter((transaction) => [TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED].includes(transaction.status)).length,
    lastSevenDays,
    topListings,
  });
}));

marketplaceRouter.get('/me/credits', requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId).select('promoCreditsKobo');
  const entries = await PlatformCreditEntry.find({ userId: req.sellerId }).sort({ createdAt: -1 }).limit(50);
  res.json({ balanceKobo: user?.promoCreditsKobo || 0, entries });
}));

const creditSpendSchema = Joi.object({
  listingType: Joi.string().valid('product', 'course', 'service').required(),
  listingId: Joi.string().hex().length(24).required(),
  perk: Joi.string().valid('promote', 'feature').required(),
});

marketplaceRouter.post('/me/credits/spend', requireAuth, validate(creditSpendSchema), asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.body.listingType];
  const listing = await config.Model.findOne({ _id: req.body.listingId, seller: req.sellerId, isVerified: true });
  if (!listing) throw new AppError(404, 'Verified listing not found');
  const costs = { promote: 500000, feature: 1000000 };
  const amountKobo = costs[req.body.perk];
  const user = await User.findOneAndUpdate(
    { _id: req.sellerId, promoCreditsKobo: { $gte: amountKobo } },
    { $inc: { promoCreditsKobo: -amountKobo } },
    { new: true }
  );
  if (!user) throw new AppError(409, 'You do not have enough promotion credits for this perk');

  if (req.body.perk === 'feature') {
    listing.isFeatured = true;
  } else {
    listing.promotionUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  await listing.save();
  await PlatformCreditEntry.create({
    userId: req.sellerId,
    type: 'spent',
    amountKobo: -amountKobo,
    reason: req.body.perk === 'feature' ? 'Featured listing promotion' : 'Listing promotion placement',
    listingId: listing._id,
    listingType: req.body.listingType,
  });
  res.json({ balanceKobo: user.promoCreditsKobo, listing });
}));

marketplaceRouter.get('/me/listings', requireAuth, asyncHandler(async (req, res) => {
  const groups = await Promise.all(Object.entries(TYPE_CONFIG).map(async ([listingType, { Model }]) => {
    const items = await Model.find({ seller: req.sellerId }).sort({ updatedAt: -1 });
    return items.map((item) => ({ ...item.toObject(), listingType }));
  }));
  res.json({ listings: groups.flat() });
}));

const listingActiveSchema = Joi.object({ active: Joi.boolean().required() });
marketplaceRouter.patch('/me/listings/:type/:id', requireAuth, validate(listingActiveSchema), asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.params.type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const item = await config.Model.findOneAndUpdate(
    { _id: req.params.id, seller: req.sellerId },
    { isActive: req.body.active },
    { new: true }
  );
  if (!item) throw new AppError(404, 'Listing not found');
  res.json({ item });
}));

marketplaceRouter.post('/me/cart/checkout', requireAuth, asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  if (!buyer.fullName || !buyer.nin) throw new AppError(403, 'Complete your identity details in Profile settings before checkout');
  const items = await populateSavedItems(buyer.cartItems);
  if (!items.length) throw new AppError(409, 'Your cart is empty');
  if (items.some((entry) => entry.listingType !== 'product')) {
    throw new AppError(409, 'Services use direct booking. Products and courses are checked out from the cart.');
  }

  const checkoutLines = items.map(({ listingType, listing, quantity }) => ({
    listingType,
    listing,
    quantity: listingType === 'product' ? quantity : 1,
    linkId: listing.escrowLinkId,
  }));
  if (checkoutLines.some((line) => !line.linkId)) throw new AppError(409, 'A cart listing is missing its escrow checkout');

  for (const line of checkoutLines) {
    if (line.listingType === 'product' && line.quantity > line.listing.stock) {
      throw new AppError(409, `${line.listing.title} no longer has enough stock`);
    }
  }

  const links = await Link.find({ _id: { $in: checkoutLines.map((line) => line.linkId) }, active: true });
  const linkById = new Map(links.map((link) => [String(link._id), link]));
  if (links.length !== checkoutLines.length) throw new AppError(409, 'A cart listing is no longer available for checkout');
  if (await User.exists({ _id: { $in: links.map((link) => link.sellerId) }, isDemoSeed: true })) {
    throw new AppError(409, 'Demo listings are for browsing only and cannot accept real payment.');
  }

  await Promise.all(links.map(ensureCheckoutPrice));
  const chargeTotalKobo = checkoutLines.reduce((sum, line) => {
    const link = linkById.get(String(line.linkId));
    if (link.checkoutPriceKobo == null) throw new AppError(503, 'The all-inclusive checkout price is temporarily unavailable');
    return sum + link.checkoutPriceKobo * line.quantity;
  }, 0);
  const reference = generateReference('escrit-cart');
  const firstLine = checkoutLines[0];
  const paymentProvider = await getPaymentProviderName();
  const transactions = await Transaction.create(checkoutLines.map((line) => ({
    linkId: line.linkId,
    paymentProvider,
    paymentReference: reference,
    checkoutTotalKobo: chargeTotalKobo,
    buyerPriceKoboSnapshot: linkById.get(String(line.linkId)).checkoutPriceKobo,
    sellerPayoutBaseKobo: linkById.get(String(line.linkId)).checkoutBasePriceKobo ?? linkById.get(String(line.linkId)).priceKobo,
    buyerUserId: buyer._id,
    buyerEmail: buyer.email,
    checkoutQuantity: line.quantity,
  })));

  try {
    const payment = await initializeTransaction({
      email: buyer.email,
      amountKobo: chargeTotalKobo,
      reference,
      callbackUrl: `${env.clientOrigins[0]}/r/${firstLine.linkId}/t/${transactions[0].id}/result`,
      metadata: { transactionIds: transactions.map((transaction) => transaction.id), buyerId: buyer.id },
    });
    await Promise.all(transactions.map(async (transaction) => {
      transaction.paymentProviderTransactionId = payment.id ? String(payment.id) : null;
      await transaction.save();
    }));
    res.json({ authorizationUrl: payment.authorization_url, reference, transactionId: transactions[0].id, totalKobo: chargeTotalKobo });
  } catch (error) {
    await Transaction.deleteMany({ _id: { $in: transactions.map((transaction) => transaction._id) } });
    throw error;
  }
}));

marketplaceRouter.post('/me/cart', requireAuth, validate(listingReferenceSchema), asyncHandler(async (req, res) => {
  const { listingType, listingId } = req.body;
  if (listingType === 'service') throw new AppError(409, 'Services use direct booking. Products and courses can be added to the cart.');
  const listing = await loadListing(listingType, listingId);
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  const existing = buyer.cartItems.find((entry) => entry.listingType === listingType && String(entry.listingId) === listingId);
  const quantity = listingType === 'course' ? 1 : (existing?.quantity || 0) + 1;
  if (listingType === 'product' && quantity > listing.stock) throw new AppError(409, 'That quantity is no longer in stock');
  if (existing) existing.quantity = quantity;
  else buyer.cartItems.push({ listingType, listingId, quantity: 1 });
  await buyer.save();
  res.json({ items: await populateSavedItems(buyer.cartItems) });
}));

marketplaceRouter.patch('/me/cart/:listingType/:listingId', requireAuth, validate(cartQuantitySchema), asyncHandler(async (req, res) => {
  const { listingType, listingId } = req.params;
  if (listingType !== 'product') throw new AppError(409, 'Course quantities cannot be changed and services use direct booking');
  const { quantity } = req.body;
  const listing = await loadListing(listingType, listingId);
  if (listingType === 'product' && quantity > listing.stock) throw new AppError(409, 'That quantity is no longer in stock');
  const buyer = await User.findById(req.sellerId);
  const existing = buyer?.cartItems.find((entry) => entry.listingType === listingType && String(entry.listingId) === listingId);
  if (!existing) throw new AppError(404, 'Cart item not found');
  existing.quantity = quantity;
  await buyer.save();
  res.json({ items: await populateSavedItems(buyer.cartItems) });
}));

marketplaceRouter.delete('/me/cart/:listingType/:listingId', requireAuth, asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  buyer.cartItems = buyer.cartItems.filter((entry) => !(entry.listingType === req.params.listingType && String(entry.listingId) === req.params.listingId));
  await buyer.save();
  res.json({ items: await populateSavedItems(buyer.cartItems) });
}));

marketplaceRouter.get('/me/favorites', requireAuth, asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  res.json({ items: await populateSavedItems(buyer.favoriteListings) });
}));

marketplaceRouter.post('/me/favorites', requireAuth, validate(listingReferenceSchema), asyncHandler(async (req, res) => {
  const { listingType, listingId } = req.body;
  await loadListing(listingType, listingId);
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  const exists = buyer.favoriteListings.some((entry) => entry.listingType === listingType && String(entry.listingId) === listingId);
  if (!exists) buyer.favoriteListings.push({ listingType, listingId });
  await buyer.save();
  res.json({ items: await populateSavedItems(buyer.favoriteListings) });
}));

marketplaceRouter.delete('/me/favorites/:listingType/:listingId', requireAuth, asyncHandler(async (req, res) => {
  const buyer = await User.findById(req.sellerId);
  if (!buyer) throw new AppError(404, 'Account not found');
  buyer.favoriteListings = buyer.favoriteListings.filter((entry) => !(entry.listingType === req.params.listingType && String(entry.listingId) === req.params.listingId));
  await buyer.save();
  res.json({ items: await populateSavedItems(buyer.favoriteListings) });
}));

const scheduledDiscountSchema = Joi.object({
  percent: Joi.number().integer().min(1).max(90).required(),
  startsAt: Joi.date().iso().required(),
  endsAt: Joi.date().iso().required(),
}).custom((discount, helpers) => new Date(discount.endsAt) > new Date(discount.startsAt) ? discount : helpers.error('any.invalid'));

const createListingSchema = Joi.object({
  title: Joi.string().min(3).max(120).required(),
  description: Joi.string().max(2000).allow('').optional(),
  category: Joi.string().max(80).default('General'),
  images: Joi.array().items(Joi.string().uri().allow('')).default([]),
  price: Joi.number().min(0).default(0),
  stock: Joi.number().min(0).default(1),
  condition: Joi.string().valid('new', 'used', 'refurbished').default('new'),
  negotiable: Joi.boolean().default(false),
  refundable: Joi.boolean().default(false),
  deliveryOptions: Joi.array().items(Joi.object({
    method: Joi.string().valid('pickup', 'seller_delivery').required(),
    fee: Joi.number().min(0).default(0),
    details: Joi.string().max(240).allow('').default(''),
  })).unique('method').max(2).default([{ method: 'pickup', fee: 0 }]),
  deliveryFormat: Joi.string().valid('self-paced', 'live').default('self-paced'),
  curriculum: Joi.array().items(Joi.object({
    title: Joi.string().trim().min(1).max(120).required(),
    description: Joi.string().max(1000).allow('').default(''),
    videoUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow('').default(''),
  })).max(40).default([]),
  scheduledDiscount: scheduledDiscountSchema.allow(null).default(null),
  refundable: Joi.boolean().default(false),
  refundConditions: Joi.string().allow('').default(''),
  basePrice: Joi.number().min(0).default(0),
  pricingUnit: Joi.string().default('project'),
  estimatedTime: Joi.string().default('1-2 weeks'),
  location: Joi.string().default('Remote'),
  deliveryMode: Joi.string().valid('remote', 'in-person', 'hybrid').default('remote'),
  serviceRadiusKm: Joi.number().min(0).max(1000).default(0),
  durationMinutes: Joi.number().integer().min(15).max(1440).default(60),
  bookingLeadTimeHours: Joi.number().integer().min(0).max(8760).default(24),
  maxBookingsPerDay: Joi.number().integer().min(1).max(100).default(4),
  timeZone: Joi.string().max(80).default('Africa/Lagos'),
  availability: Joi.array().items(Joi.object({
    day: Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday').required(),
    startTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
    endTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
  })).unique('day').max(7).default([]),
  deliverables: Joi.array().items(Joi.string().max(160)).max(30).default([]),
  requirements: Joi.array().items(Joi.string().max(160)).max(30).default([]),
  cancellationPolicy: Joi.string().valid('flexible', 'moderate', 'strict', 'custom').default('moderate'),
  cancellationTerms: Joi.string().max(1000).allow('').default(''),
  reschedulePolicy: Joi.string().max(500).allow('').default(''),
});

async function ensureCategory(type, name, requestedBy) {
  const { Category } = TYPE_CONFIG[type];
  const categoryName = String(name || 'General').trim();
  if (!categoryName) return { name: 'General', approved: true };

  const normalized = categoryName.toLowerCase();
  const existing = await Category.findOne({ slug: normalized });
  if (existing?.approvalStatus === 'rejected') {
    existing.approvalStatus = 'pending';
    existing.requestedBy = requestedBy;
    await existing.save();
  }
  if (existing) return { name: existing.name, approved: existing.approvalStatus === 'approved' };

  if (normalized === 'general') return { name: 'General', approved: true };
  const created = await Category.create({ name: categoryName, slug: normalized, approvalStatus: 'pending', requestedBy });
  return { name: created.name, approved: false };
}

marketplaceRouter.get('/overview', asyncHandler(async (_req, res) => {
  const [products, courses, services, reviews] = await Promise.all([
    Product.find({ isActive: true, isVerified: true }).sort({ isFeatured: -1, promotionUntil: -1, createdAt: -1 }).limit(4).populate('seller', 'businessName isDemoSeed'),
    Course.find({ isActive: true, isVerified: true }).sort({ isFeatured: -1, promotionUntil: -1, createdAt: -1 }).limit(4).populate('seller', 'businessName isDemoSeed'),
    Service.find({ isActive: true, isVerified: true }).sort({ isFeatured: -1, promotionUntil: -1, createdAt: -1 }).limit(4).populate('seller', 'businessName isDemoSeed'),
    Review.find({ comment: { $ne: '' } }).sort({ createdAt: -1 }).limit(6).populate('buyerId', 'businessName').populate('sellerId', 'businessName'),
  ]);

  const allItems = [...products, ...courses, ...services];
  const links = await Link.find({ _id: { $in: allItems.map((item) => item.escrowLinkId).filter(Boolean) } });
  await Promise.all(links.map(ensureCheckoutPrice));
  const checkoutPriceById = new Map(links.map((link) => [String(link._id), link.checkoutPriceKobo]));
  for (const item of allItems) item.set('buyerPriceKobo', checkoutPriceById.get(String(item.escrowLinkId)) || null, { strict: false });

  res.json({
    products,
    courses,
    services,
    reviews,
    counts: {
      products: products.length,
      courses: courses.length,
      services: services.length,
    },
  });
}));

marketplaceRouter.get('/seller/:sellerId', asyncHandler(async (req, res) => {
  const seller = await User.findById(req.params.sellerId).select('businessName profilePictureUrl bio createdAt averageRating reviewCount isDemoSeed');
  if (!seller) throw new AppError(404, 'Seller not found');
  const [products, courses, services] = await Promise.all([
    Product.find({ seller: seller._id, isActive: true, isVerified: true }).sort({ createdAt: -1 }),
    Course.find({ seller: seller._id, isActive: true, isVerified: true }).sort({ createdAt: -1 }),
    Service.find({ seller: seller._id, isActive: true, isVerified: true }).sort({ createdAt: -1 }),
  ]);
  const listings = [
    ...products.map((item) => ({ ...item.toObject(), listingType: 'product' })),
    ...courses.map((item) => ({ ...item.toObject(), listingType: 'course' })),
    ...services.map((item) => ({ ...item.toObject(), listingType: 'service' })),
  ];
  const links = await Link.find({ _id: { $in: listings.map((item) => item.escrowLinkId).filter(Boolean) } });
  await Promise.all(links.map(ensureCheckoutPrice));
  const checkoutPriceById = new Map(links.map((link) => [String(link._id), link.checkoutPriceKobo]));
  res.json({
    seller,
    listings: listings.map((item) => ({
      ...item,
      buyerPriceKobo: checkoutPriceById.get(String(item.escrowLinkId)) ?? null,
    })),
  });
}));

marketplaceRouter.get('/:type', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const config = TYPE_CONFIG[type];
  if (!config) {
    return res.status(400).json({ error: 'Unsupported listing type' });
  }

  const items = await config.Model.find({ isActive: true, isVerified: true }).sort({ isFeatured: -1, promotionUntil: -1, createdAt: -1 }).populate('seller', 'businessName profilePictureUrl isDemoSeed');
  const links = await Link.find({ _id: { $in: items.map((item) => item.escrowLinkId).filter(Boolean) } });
  await Promise.all(links.map(ensureCheckoutPrice));
  const checkoutPriceById = new Map(links.map((link) => [String(link._id), link.checkoutPriceKobo]));
  for (const item of items) item.set('buyerPriceKobo', checkoutPriceById.get(String(item.escrowLinkId)) || null, { strict: false });
  res.json({ items });
}));

marketplaceRouter.get('/:type/:id', asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.params.type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const item = await config.Model.findOne({ _id: req.params.id, isActive: true, isVerified: true }).populate('seller', 'businessName profilePictureUrl bio isDemoSeed');
  if (!item) throw new AppError(404, 'Listing not found');
  const link = item.escrowLinkId ? await Link.findById(item.escrowLinkId) : null;
  const buyerPriceKobo = link ? await ensureCheckoutPrice(link) : null;
  res.json({ item: { ...item.toObject(), buyerPriceKobo } });
}));

const directCheckoutSchema = Joi.object({
  appointmentAt: Joi.date().iso().allow(null).default(null),
});

marketplaceRouter.post('/:type/:id/checkout', requireAuth, validate(directCheckoutSchema), asyncHandler(async (req, res) => {
  const listingType = req.params.type;
  if (listingType !== 'service') throw new AppError(400, 'Courses use the escrow cart; services use direct booking');
  const config = TYPE_CONFIG[listingType];
  const listing = await config.Model.findOne({ _id: req.params.id, isActive: true, isVerified: true });
  if (!listing) throw new AppError(404, 'Listing is no longer available');
  const buyer = await User.findById(req.sellerId);
  if (!buyer?.fullName || !buyer.nin) throw new AppError(403, 'Complete your identity details in Profile settings before checkout');
  const seller = await User.findById(listing.seller);
  if (!seller?.bankAccount) throw new AppError(409, 'This seller is not ready to receive payment yet');
  if (seller.isDemoSeed) throw new AppError(409, 'Demo listings are for browsing only and cannot accept real payment.');
  const link = await Link.findOne({ listingType, listingId: listing._id, active: true });
  if (!link) throw new AppError(409, 'Direct checkout is not available for this listing');
  const priceKobo = listingType === 'service' ? link.priceKobo : Math.round(listing.price * 100);
  if (!Number.isFinite(priceKobo) || priceKobo < 10000) throw new AppError(409, 'This listing does not have a direct checkout price');
  const buyerPriceKobo = await ensureCheckoutPrice(link);
  if (buyerPriceKobo == null) throw new AppError(503, 'The all-inclusive checkout price is temporarily unavailable');

  const reference = generateReference(`escrit-${listingType}`);
  const transaction = await Transaction.create({
    linkId: link._id,
    paymentProvider: await getPaymentProviderName(),
    paymentReference: reference,
    checkoutMode: 'direct',
    checkoutTotalKobo: buyerPriceKobo,
    buyerPriceKoboSnapshot: buyerPriceKobo,
    sellerPayoutBaseKobo: link.checkoutBasePriceKobo ?? link.priceKobo,
    buyerUserId: buyer._id,
    buyerEmail: buyer.email,
    fulfillmentNote: req.body.appointmentAt ? `Requested appointment: ${req.body.appointmentAt.toISOString()}` : '',
  });
  try {
    const payment = await initializeTransaction({
      email: buyer.email,
      amountKobo: buyerPriceKobo,
      reference,
      callbackUrl: `${env.clientOrigins[0]}/r/${link.id}/t/${transaction.id}/result`,
      metadata: { transactionId: transaction.id, listingType, listingId: listing.id, checkoutMode: 'direct' },
    });
    transaction.paymentProviderTransactionId = payment.id ? String(payment.id) : null;
    await transaction.save();
    res.json({ authorizationUrl: payment.authorization_url, transactionId: transaction.id, totalKobo: buyerPriceKobo });
  } catch (error) {
    await Transaction.deleteOne({ _id: transaction._id });
    throw error;
  }
}));

marketplaceRouter.get('/:type/:id/reviews', asyncHandler(async (req, res) => {
  if (!TYPE_CONFIG[req.params.type]) throw new AppError(400, 'Unsupported listing type');
  const reviews = await Review.find({ listingType: req.params.type, listingId: req.params.id })
    .sort({ createdAt: -1 })
    .populate('buyerId', 'businessName profilePictureUrl');
  res.json({ reviews });
}));

marketplaceRouter.get('/me/review-eligibility/:type/:id', requireAuth, asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.params.type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const listing = await config.Model.findById(req.params.id).select('escrowLinkId');
  if (!listing?.escrowLinkId) return res.json({ eligible: false });
  const transactions = await Transaction.find({
    linkId: listing.escrowLinkId,
    buyerUserId: req.sellerId,
    status: { $in: req.params.type === 'service'
      ? [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_COMPLETED]
      : [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED] },
  }).select('_id').sort({ createdAt: 1 });
  const reviewedIds = new Set((await Review.find({ transactionId: { $in: transactions.map((entry) => entry._id) } }).select('transactionId')).map((entry) => String(entry.transactionId)));
  const transaction = transactions.find((entry) => !reviewedIds.has(String(entry._id)));
  res.json({ eligible: Boolean(transaction), transactionId: transaction?._id || null });
}));

const reviewSchema = Joi.object({
  transactionId: Joi.string().hex().length(24).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(1000).allow('').default(''),
});

marketplaceRouter.post('/:type/:id/reviews', requireAuth, validate(reviewSchema), asyncHandler(async (req, res) => {
  const config = TYPE_CONFIG[req.params.type];
  if (!config) throw new AppError(400, 'Unsupported listing type');
  const listing = await config.Model.findById(req.params.id);
  if (!listing?.escrowLinkId) throw new AppError(404, 'Listing not found');
  const transaction = await Transaction.findOne({
    _id: req.body.transactionId,
    linkId: listing.escrowLinkId,
    buyerUserId: req.sellerId,
    status: { $in: req.params.type === 'service'
      ? [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_COMPLETED]
      : [TX_STATUS.RELEASED, TX_STATUS.RESOLVED_RELEASED, TX_STATUS.DIRECT_PAID, TX_STATUS.DIRECT_COMPLETED] },
  });
  if (!transaction) throw new AppError(403, 'Only a buyer with a completed order can review this listing');
  if (await Review.exists({ transactionId: transaction._id })) throw new AppError(409, 'You have already reviewed this order');

  const review = await Review.create({
    listingType: req.params.type,
    listingId: listing._id,
    sellerId: listing.seller,
    buyerId: req.sellerId,
    transactionId: transaction._id,
    rating: req.body.rating,
    comment: req.body.comment,
  });
  const listingCount = listing.reviewCount || 0;
  listing.averageRating = ((listing.averageRating || 0) * listingCount + review.rating) / (listingCount + 1);
  listing.reviewCount = listingCount + 1;
  await listing.save();

  const seller = await User.findById(listing.seller);
  if (seller) {
    const sellerCount = seller.reviewCount || 0;
    seller.averageRating = ((seller.averageRating || 0) * sellerCount + review.rating) / (sellerCount + 1);
    seller.reviewCount = sellerCount + 1;
    await seller.save();
  }
  res.status(201).json({ review });
}));

marketplaceRouter.post('/:type', requireAuth, validate(createListingSchema), asyncHandler(async (req, res) => {
  const { type } = req.params;
  const config = TYPE_CONFIG[type];
  if (!config) {
    return res.status(400).json({ error: 'Unsupported listing type' });
  }

  const seller = await User.findById(req.sellerId);
  if (!seller) {
    return res.status(404).json({ error: 'Seller not found' });
  }
  if (!seller.fullName || !seller.nin) throw new AppError(422, 'Complete your identity details in Profile settings before listing');
  if (!seller.bankAccount) {
    throw new AppError(422, 'Add a verified bank account before publishing a marketplace listing');
  }

  const priceNaira = type === 'service' ? Number(req.body.basePrice || 0) : Number(req.body.price || 0);
  if (priceNaira < 100) {
    throw new AppError(422, 'Marketplace listings must be priced at ₦100 or more to use escrow');
  }

  const categoryResult = await ensureCategory(type, req.body.category, seller._id);
  const payload = {
    ...req.body,
    seller: seller._id,
    category: categoryResult.name,
    categoryReviewStatus: categoryResult.approved ? 'approved' : 'pending',
    images: Array.isArray(req.body.images) ? req.body.images : [],
  };

  if (type === 'product') {
    payload.price = Number(req.body.price || 0);
    payload.stock = Number(req.body.stock || 1);
  }

  if (type === 'course') {
    payload.price = Number(req.body.price || 0);
    payload.curriculum = req.body.curriculum.length ? req.body.curriculum : [{ title: 'Course overview', description: req.body.description || '', videoUrl: '' }];
    if (req.body.refundable && !req.body.refundConditions) {
      return res.status(400).json({ error: 'Refund conditions are required when refundable is true' });
    }
  }

  if (type === 'service') {
    payload.basePrice = Number(req.body.basePrice || 0);
  }

  const item = await config.Model.create(payload);
  let link;
  try {
    if (priceNaira >= 100) {
      link = await Link.create({
        sellerId: seller._id,
        itemName: item.title,
        itemDescription: type === 'course' && item.refundable
          ? `${item.description || ''}\n\nRefund conditions: ${item.refundConditions}`.trim()
          : item.description,
        fulfillmentType: type,
        listingType: type,
        listingId: item._id,
        refundable: Boolean(item.refundable),
        scheduledDiscount: ['product', 'course'].includes(type) ? req.body.scheduledDiscount : null,
        itemPhotoUrl: item.images[0] || null,
        priceKobo: Math.round(priceNaira * 100),
        checkoutPriceKobo: null,
        checkoutBasePriceKobo: null,
      });
      item.escrowLinkId = link._id;
      await item.save();
    }
  } catch (error) {
    await Promise.all([
      config.Model.deleteOne({ _id: item._id }),
      link ? Link.deleteOne({ _id: link._id }) : Promise.resolve(),
    ]);
    throw error;
  }

  res.status(201).json({ item });
}));
