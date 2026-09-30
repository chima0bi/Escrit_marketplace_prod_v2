// All Flutterwave API calls live here; routes and escrow rules stay provider-agnostic.
import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { getFlutterwaveCredentials } from './paymentMode.js';

// Built per call because the active key pair can change at runtime (owner live/test toggle).
// Every exported function awaits this before touching the API.
async function requireFlutterwaveConfig() {
  const { secretKey, mode } = await getFlutterwaveCredentials();
  if (!secretKey) {
    throw new AppError(503, `Payments are not configured. Set FLW_SECRET_KEY_${mode.toUpperCase()} to enable checkout and payouts in ${mode} mode.`);
  }
  return axios.create({
    baseURL: env.flutterwave.baseUrl,
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
  });
}

export async function initializeTransaction({ email, amountKobo, reference, callbackUrl, metadata }) {
  const client = await requireFlutterwaveConfig();
  const { data } = await client.post('/payments', {
    tx_ref: reference,
    amount: amountKobo / 100,
    currency: 'NGN',
    redirect_url: callbackUrl,
    customer: { email },
    meta: metadata,
    customizations: { title: 'Escrit marketplace purchase' },
  });
  return { authorization_url: data.data.link, id: data.data.id || null };
}

export async function verifyTransactionById(id) {
  const client = await requireFlutterwaveConfig();
  const { data } = await client.get(`/transactions/${encodeURIComponent(id)}/verify`);
  return data.data;
}

export async function resolveAccountNumber({ accountNumber, bankCode }) {
  const client = await requireFlutterwaveConfig();
  try {
    const { data } = await client.post('/accounts/resolve', {
      account_number: accountNumber,
      account_bank: bankCode,
    });
    return data.data;
  } catch (error) {
    if (error.response?.status === 429) {
      throw new AppError(429, 'Bank verification is temporarily rate limited. Please try again shortly.');
    }
    if (error.response) {
      throw new AppError(422, 'We could not verify this account. Check the bank and 10-digit account number.');
    }
    throw new AppError(503, 'Flutterwave bank verification is unavailable right now. Please try again.');
  }
}

export async function listBanks() {
  const client = await requireFlutterwaveConfig();
  const { data } = await client.get('/banks/NG', { params: { include_provider_type: 1 } });
  return data.data;
}

export async function initiateTransfer({ amountKobo, accountNumber, bankCode, accountName, reason, reference }) {
  const client = await requireFlutterwaveConfig();
  const { data } = await client.post('/transfers', {
    account_bank: bankCode,
    account_number: accountNumber,
    amount: amountKobo / 100,
    currency: 'NGN',
    debit_currency: 'NGN',
    beneficiary_name: accountName,
    narration: reason,
    reference,
  });
  return data.data;
}

export async function refundTransaction({ transactionId, amountKobo, reason }) {
  const client = await requireFlutterwaveConfig();
  if (!transactionId) throw new AppError(409, 'The payment provider has not supplied a refundable transaction ID');
  const { data } = await client.post(`/transactions/${encodeURIComponent(transactionId)}/refund`, {
    amount: amountKobo / 100,
    comments: reason,
  });
  return data.data;
}

export async function quoteCollectionFee(amountKobo) {
  const client = await requireFlutterwaveConfig();
  const { data } = await client.get('/transactions/fee', {
    params: { amount: amountKobo / 100, currency: 'NGN' },
  });
  const feeNaira = Number(data.data.fee || 0) + Number(data.data.stamp_duty_fee || 0);
  return Math.ceil(feeNaira * 100);
}