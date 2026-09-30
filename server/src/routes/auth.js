import { Router } from 'express';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { AppError } from '../middleware/errorHandler.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  signAccessToken,
  signRefreshToken,
  setRefreshCookie,
  refreshCookieOptions,
  requireAuth,
} from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { verifyGoogleIdToken, isGoogleSignInConfigured } from '../services/googleAuth.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../services/mailer.js';
import { generateOtp, verifyOtp, generateResetToken, verifyResetToken } from '../utils/otp.js';

export const authRouter = Router();

// Signs both tokens and returns the same { accessToken, seller } shape
// for every login path (password, Google, registration).
async function issueSession(res, user) {
  const email = user.email.toLowerCase();
  if (env.ownerEmails.includes(email) && user.role !== 'owner') {
    user.role = 'owner';
    await user.save();
  } else if (env.adminEmails.includes(email) && user.role === 'user') {
    user.role = 'admin';
    await user.save();
  }
  const accessToken = signAccessToken(user.id);
  setRefreshCookie(res, signRefreshToken(user.id));
  return { accessToken, seller: user };
}

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  businessName: Joi.string().min(2).max(80).required(),
  fullName: Joi.string().trim().min(2).max(120).required(),
  nin: Joi.string().trim().min(5).max(40).required(),
});

authRouter.post('/register', authLimiter, validate(registerSchema), asyncHandler(async (req, res) => {
  const { email, password, businessName, fullName, nin } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw new AppError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, businessName, fullName, nin });

  // A failed email must not block sign-up: the app shows a "verify your
  // email" banner and the seller can request a new code.
  await issueAndSendOtp(user).catch((err) => console.error('[auth] failed to send OTP', err));

  res.status(201).json(await issueSession(res, user));
}));

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

authRouter.post('/login', authLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  // Google-only accounts have no password hash; check before comparing.
  const valid = user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) {
    if (user && !user.passwordHash) {
      throw new AppError(401, 'This account uses Google Sign-In — log in with Google instead');
    }
    throw new AppError(401, 'Invalid email or password');
  }

  res.json(await issueSession(res, user));
}));

// --- Google Sign-In ---------------------------------------------------
// The browser gets a signed ID token from Google and we verify it. The
// first sign-in with a new Google email creates the account.
authRouter.get('/google/config', (_req, res) => {
  res.json({ enabled: isGoogleSignInConfigured(), clientId: env.google.clientId });
});

const googleSchema = Joi.object({ idToken: Joi.string().required() });

authRouter.post('/google', authLimiter, validate(googleSchema), asyncHandler(async (req, res) => {
  const { googleId, email, name } = await verifyGoogleIdToken(req.body.idToken);

  let user = await User.findOne({ $or: [{ googleId }, { email }] });
  let accountCreated = false;
  if (!user) {
    user = await User.create({
      email,
      googleId,
      businessName: name || email.split('@')[0],
      emailVerified: true, // Google has already verified this address
    });
    accountCreated = true;
  } else if (!user.googleId) {
    // Existing email/password account: link Google to it, no duplicate.
    user.googleId = googleId;
    user.emailVerified = true;
    await user.save();
  }

  res.json({ ...await issueSession(res, user), accountCreated });
}));

// --- Email OTP verification ------------------------------------------
async function issueAndSendOtp(user) {
  const { code, hash, expiresAt } = generateOtp();
  user.otpCodeHash = hash;
  user.otpExpiresAt = expiresAt;
  await user.save();
  await sendOtpEmail(user.email, code);
}

authRouter.post('/resend-otp', authLimiter, requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId);
  if (!user) throw new AppError(404, 'Seller not found');
  if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });

  await issueAndSendOtp(user);
  res.json({ ok: true });
}));

const verifyOtpSchema = Joi.object({ code: Joi.string().length(6).pattern(/^\d+$/).required() });

authRouter.post(
  '/verify-otp',
  authLimiter,
  requireAuth,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.sellerId).select('+otpCodeHash +otpExpiresAt');
    if (!user) throw new AppError(404, 'Seller not found');

    if (!verifyOtp(req.body.code, user.otpCodeHash, user.otpExpiresAt)) {
      throw new AppError(400, 'That code is invalid or has expired');
    }

    user.emailVerified = true;
    user.otpCodeHash = null;
    user.otpExpiresAt = null;
    await user.save();
    res.json({ ok: true, seller: user });
  })
);

// --- Forgot / reset password ------------------------------------------
const forgotPasswordSchema = Joi.object({ email: Joi.string().email().required() });

authRouter.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    // Same response whether or not the account exists, so this cannot
    // be used to discover registered emails.
    if (user) {
      const { token, hash, expiresAt } = generateResetToken();
      user.resetTokenHash = hash;
      user.resetTokenExpiresAt = expiresAt;
      await user.save();
      const resetUrl = `${env.clientUrl}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
      await sendPasswordResetEmail(user.email, resetUrl).catch((err) =>
        console.error('[auth] failed to send reset email', err)
      );
    }
    res.json({ ok: true });
  })
);

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
});

authRouter.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email, token, password } = req.body;
    const user = await User.findOne({ email }).select('+resetTokenHash +resetTokenExpiresAt');
    if (!user || !verifyResetToken(token, user.resetTokenHash, user.resetTokenExpiresAt)) {
      throw new AppError(400, 'This reset link is invalid or has expired');
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    await user.save();
    res.json({ ok: true });
  })
);

authRouter.post('/refresh', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new AppError(401, 'Missing refresh token');

  try {
    const payload = jwt.verify(token, env.jwt.refreshSecret);
    const accessToken = signAccessToken(payload.sub);
    res.json({ accessToken });
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }
});

authRouter.post('/logout', (_req, res) => {
  // Must use the same cookie attributes as when it was set.
  res.clearCookie('refreshToken', refreshCookieOptions());
  res.status(204).end();
});

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.sellerId);
  if (!user) throw new AppError(404, 'Seller not found');
  res.json({ seller: user });
}));
