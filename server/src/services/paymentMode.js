// Single source of truth for which credential set (test or live) is active.
// The owner flips PlatformSettings.paymentMode at runtime; env only holds the keys.
// Anything unset or unrecognised resolves to "test" so real money is never touched by accident.
import { env } from '../config/env.js';
import { getPlatformSettings } from './platformSettings.js';

export async function getPaymentMode() {
  const settings = await getPlatformSettings();
  return settings.paymentMode === 'live' ? 'live' : 'test';
}

function pick(provider, mode) {
  const cfg = env[provider];
  const live = mode === 'live';
  return {
    mode,
    secretKey: live ? cfg.secretKeyLive : cfg.secretKeyTest,
    webhookSecret: live ? cfg.webhookSecretLive : cfg.webhookSecretTest,
  };
}

export async function getPaystackCredentials() {
  return pick('paystack', await getPaymentMode());
}

export async function getFlutterwaveCredentials() {
  return pick('flutterwave', await getPaymentMode());
}

// Which modes have keys configured; lets the UI disable "Live" until keys exist.
export function getConfiguredModes() {
  return {
    paystack: { test: !!env.paystack.secretKeyTest, live: !!env.paystack.secretKeyLive },
    flutterwave: { test: !!env.flutterwave.secretKeyTest, live: !!env.flutterwave.secretKeyLive },
  };
}
