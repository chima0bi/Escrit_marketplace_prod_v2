// Seller authentication: a short-lived access token in the Authorization
// header, plus a long-lived refresh token in an httpOnly cookie that
// client-side JavaScript can never read.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import { User } from '../models/User.js';
import { asyncHandler } from './asyncHandler.js';

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl });
}

export function signRefreshToken(userId) {
  return jwt.sign({ sub: userId }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshTtl });
}

// In production the client (Vercel) and API (Render) are on different
// domains, so the cookie is cross-site and needs SameSite=None + Secure.
// Locally (plain http, same-origin proxy) "lax" is used instead.
export function refreshCookieOptions() {
  const crossSite = env.nodeEnv === 'production';
  return {
    httpOnly: true,
    secure: crossSite,
    sameSite: crossSite ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, refreshCookieOptions());
}

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'Missing access token');

  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    req.sellerId = payload.sub;
    next();
  } catch {
    throw new AppError(401, 'Invalid or expired access token');
  }
}

// ADMIN_EMAILS remains a migration-compatible access list; new admin roles
// are persisted and only owners can grant them.
export const requireAdmin = asyncHandler(async (req, _res, next) => {
  const user = await User.findById(req.sellerId);
  if (!user || (!['admin', 'owner'].includes(user.role) && !env.adminEmails.includes(user.email.toLowerCase()))) {
    throw new AppError(403, 'Admin access only');
  }
  next();
});

export const requireOwner = asyncHandler(async (req, _res, next) => {
  const user = await User.findById(req.sellerId);
  if (!user || (user.role !== 'owner' && !env.ownerEmails.includes(user.email.toLowerCase()))) {
    throw new AppError(403, 'Owner access only');
  }
  next();
});
