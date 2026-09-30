// Verifies the ID token that Google Identity Services issues in the
// browser. Only the public Client ID is needed: we check Google's
// signature and that the token was issued for this app (the audience).
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

let client = null;
function getClient() {
  if (!env.google.clientId) return null;
  if (!client) client = new OAuth2Client(env.google.clientId);
  return client;
}

export function isGoogleSignInConfigured() {
  return Boolean(env.google.clientId);
}

// Returns { googleId, email, name } for a valid token, otherwise throws.
export async function verifyGoogleIdToken(idToken) {
  const googleClient = getClient();
  if (!googleClient) throw new AppError(503, 'Google Sign-In is not configured on this server');
  if (!idToken) throw new AppError(400, 'Missing Google ID token');

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.google.clientId });
    payload = ticket.getPayload();
  } catch {
    throw new AppError(401, 'Invalid Google sign-in token');
  }

  if (!payload?.email) throw new AppError(401, 'Google account has no email');
  if (payload.email_verified === false) {
    throw new AppError(401, 'Google account email is not verified');
  }

  return { googleId: payload.sub, email: payload.email, name: payload.name || null };
}
