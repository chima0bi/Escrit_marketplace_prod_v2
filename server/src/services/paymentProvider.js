// Business code calls this adapter instead of importing a processor directly.
// Changing the admin setting therefore switches checkout, fees, banks, payouts, and refunds together.
import * as paystack from './paystack.js';
import * as flutterwave from './flutterwave.js';
import { getPlatformSettings } from './platformSettings.js';

export async function getPaymentProviderName() {
  const settings = await getPlatformSettings();
  return settings.paymentProvider || 'paystack';
}

async function provider() {
  return (await getPaymentProviderName()) === 'flutterwave' ? flutterwave : paystack;
}

export async function initializeTransaction(args) { return (await provider()).initializeTransaction(args); }
export async function verifyTransactionById(id) { return (await provider()).verifyTransactionById(id); }
export async function resolveAccountNumber(args) { return (await provider()).resolveAccountNumber(args); }
export async function listBanks() { return (await provider()).listBanks(); }
export async function initiateTransfer(args) { return (await provider()).initiateTransfer(args); }
export async function refundTransaction(args) { return (await provider()).refundTransaction(args); }
export async function quoteCollectionFee(amountKobo) { return (await provider()).quoteCollectionFee(amountKobo); }