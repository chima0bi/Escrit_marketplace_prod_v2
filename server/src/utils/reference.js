import crypto from 'node:crypto';

// Unique, URL-safe payment reference, e.g. "escrit-9f2c41b7a0d3e5c1".
export function generateReference(prefix) {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}
