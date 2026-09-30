// Paystack implements the same payment contract as the existing Flutterwave adapter.
// The provider-neutral wrapper normalizes its response shape before business logic sees it.
import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { getPaystackCredentials } from './paymentMode.js';

// Built fresh per call (not a module-level singleton) since which key pair
// is active can change at runtime via the owner's live/test toggle.
async function client() {
  const { secretKey, mode } = await getPaystackCredentials();
  if (!secretKey) {
    throw new AppError(
      503,
      `Payments are not configured. Set PAYSTACK_SECRET_KEY_${mode.toUpperCase()} to enable checkout and payouts in ${mode} mode.`
    );
  }
  return axios.create({
    baseURL: env.paystack.baseUrl,
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
  });
}

export async function initializeTransaction({ email, amountKobo, reference, callbackUrl, metadata }) {
  const { data } = await (await client()).post('/transaction/initialize', { email, amount: amountKobo, currency: 'NGN', reference, callback_url: callbackUrl, metadata });
  return { authorization_url: data.data.authorization_url, id: reference };
}

export async function verifyTransactionById(reference) {
  const { data } = await (await client()).get(`/transaction/verify/${encodeURIComponent(reference)}`);
  const transaction = data.data;
  return {
    id: transaction.id,
    status: transaction.status === 'success' ? 'successful' : transaction.status,
    tx_ref: transaction.reference,
    currency: transaction.currency,
    amount: Number(transaction.amount || 0) / 100,
  };
}

export async function resolveAccountNumber({ accountNumber, bankCode }) {
  const { data } = await (await client()).get('/bank/resolve', { params: { account_number: accountNumber, bank_code: bankCode } });
  return { account_name: data.data.account_name };
}

export async function listBanks() {
  const { data } = await (await client()).get('/bank');
  return data.data.map((bank) => ({ ...bank, name: bank.name, code: bank.code }));
}

export async function initiateTransfer({ amountKobo, accountNumber, bankCode, accountName, reason, reference }) {
  const c = await client();
  const recipientResponse = await c.post('/transferrecipient', { type: 'nuban', name: accountName, account_number: accountNumber, bank_code: bankCode, currency: 'NGN' });
  const { data } = await c.post('/transfer', { source: 'balance', amount: amountKobo, recipient: recipientResponse.data.data.recipient_code, reason, reference });
  return data.data;
}

export async function refundTransaction({ transactionId, amountKobo, reason }) {
  if (!transactionId) throw new AppError(409, 'The payment provider has not supplied a refundable transaction ID');
  const { data } = await (await client()).post('/refund', { transaction: transactionId, amount: amountKobo, currency: 'NGN', customer_note: reason, merchant_note: reason });
  return data.data;
}

export async function quoteCollectionFee(amountKobo) {
  return Math.min(Math.ceil(amountKobo * 0.015) + 10000, 200000);
}