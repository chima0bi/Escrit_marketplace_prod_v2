import { Router } from 'express';
import Joi from 'joi';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveAccountNumber, listBanks } from '../services/paymentProvider.js';

export const sellerRouter = Router();
sellerRouter.use(requireAuth);

const profileSchema = Joi.object({
  businessName: Joi.string().trim().min(2).max(80).required(),
  fullName: Joi.string().trim().min(2).max(120).required(),
  nin: Joi.string().trim().min(5).max(40).allow('').default(''),
  idDocumentUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow('').default(''),
  bio: Joi.string().trim().max(500).allow('').default(''),
  profilePictureUrl: Joi.string().uri({ scheme: ['https'] }).max(500).allow('').default(''),
});

sellerRouter.patch('/profile', validate(profileSchema), asyncHandler(async (req, res) => {
  const current = await User.findById(req.sellerId);
  if (!current) throw new AppError(404, 'Seller not found');
  const changedKyc = current.fullName !== req.body.fullName || current.nin !== req.body.nin || current.idDocumentUrl !== req.body.idDocumentUrl;
  const seller = await User.findByIdAndUpdate(req.sellerId, {
    ...req.body,
    ...(changedKyc ? { kycStatus: 'pending', kycReviewNote: '', kycReviewedAt: null } : {}),
  }, { new: true, runValidators: true });
  if (!seller) throw new AppError(404, 'Seller not found');
  res.json({ seller });
}));

sellerRouter.get('/banks', asyncHandler(async (_req, res) => {
  const banks = await listBanks();
  res.json({ banks });
}));

const bankAccountSchema = Joi.object({
  accountNumber: Joi.string().length(10).pattern(/^\d+$/).required(),
  bankCode: Joi.string().required(),
  bankName: Joi.string().required(),
});

// Verifies the account with the bank via Flutterwave and saves the payout
// destination. The name shown to buyers always comes from the bank, never
// from what the seller typed.
sellerRouter.post('/bank-account', validate(bankAccountSchema), asyncHandler(async (req, res) => {
  const { accountNumber, bankCode, bankName } = req.body;

  const resolved = await resolveAccountNumber({ accountNumber, bankCode });
  const user = await User.findByIdAndUpdate(
    req.sellerId,
    {
      bankAccount: {
        accountNumber,
        bankCode,
        bankName,
        resolvedAccountName: resolved.account_name,
      },
    },
    { new: true }
  );

  if (!user) throw new AppError(404, 'Seller not found');
  res.json({ seller: user });
}));
