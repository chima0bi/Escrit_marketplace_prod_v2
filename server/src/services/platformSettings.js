import { PlatformSettings } from '../models/PlatformSettings.js';

export async function getPlatformSettings() {
  return PlatformSettings.findOneAndUpdate(
    { key: 'platform' },
    { $setOnInsert: { key: 'platform' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}