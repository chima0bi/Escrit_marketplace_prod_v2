import { env } from '../config/env.js';

// Redirects plain-HTTP requests to HTTPS in production. The TLS load
// balancer reports the original protocol, which `trust proxy` exposes
// as `req.secure`.
export function enforceHttps(req, res, next) {
  if (env.nodeEnv !== 'production' || req.secure) return next();

  // A redirect would turn the webhook POST into a GET and drop its signed body.
  if (req.path.startsWith('/api/webhooks')) return next();

  return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
}

// Tells browsers to use HTTPS only for this host for the next year.
export function hstsHeader(_req, res, next) {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
}
