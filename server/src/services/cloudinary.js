// Signed browser-to-Cloudinary uploads. The browser sends the photo
// straight to Cloudinary, so image bytes never pass through this API and
// the API secret never leaves the server.
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

const UPLOAD_FOLDER = 'escrit/items';

// Cloudinary signature: SHA-1 of the params sorted by name and joined as
// "key=value&key=value", with the API secret appended.
export function signParams(params, apiSecret) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(payload + apiSecret).digest('hex');
}

// Everything the browser needs to upload one image. Signatures are only
// valid for a short window, so a leaked one is of little use.
export function createUploadSignature() {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(503, 'Photo uploads are not available right now. Paste an image link instead.');
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signature = signParams({ folder: UPLOAD_FOLDER, timestamp }, apiSecret);
  return { cloudName, apiKey, timestamp, signature, folder: UPLOAD_FOLDER };
}
