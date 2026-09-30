import rateLimit from 'express-rate-limit';

function limiter(limit, message) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message },
  });
}

// Buyer routes are unauthenticated, so they get a tighter cap.
export const publicLimiter = limiter(60, 'Too many requests, please try again shortly.');

// Login, registration, OTP and password-reset attempts.
export const authLimiter = limiter(20, 'Too many attempts, please try again shortly.');

// Upload signatures for item photos.
export const uploadLimiter = limiter(30, 'Too many upload attempts, please try again shortly.');
