import { env } from '../config/env.js';
import { getPaymentProviderName, quoteCollectionFee } from './paymentProvider.js';

export function effectiveBasePriceKobo(link, now = new Date()) {
  const discount = link.scheduledDiscount;
  if (!discount || now < new Date(discount.startsAt) || now > new Date(discount.endsAt)) return link.priceKobo;
  return Math.max(10000, Math.round(link.priceKobo * (100 - discount.percent) / 100));
}

export async function ensureCheckoutPrice(link) {
  const basePriceKobo = effectiveBasePriceKobo(link);
  const provider = await getPaymentProviderName();
  if (link.checkoutPriceKobo != null && link.checkoutBasePriceKobo === basePriceKobo && link.checkoutProvider === provider) return link.checkoutPriceKobo;
  const anyKeyConfigured =
    env.flutterwave.secretKeyLive || env.flutterwave.secretKeyTest || env.paystack.secretKeyLive || env.paystack.secretKeyTest;
  if (!anyKeyConfigured) return null;
  try {
    link.checkoutBasePriceKobo = basePriceKobo;
    link.checkoutPriceKobo = basePriceKobo + await quoteCollectionFee(basePriceKobo);
    link.checkoutProvider = provider;
    await link.save();
    return link.checkoutPriceKobo;
  } catch (error) {
    console.warn(`[pricing] unable to refresh fee quote for ${link._id}: ${error.message}`);
    return null;
  }
}
