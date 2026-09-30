import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'platform', unique: true },
    commissionPercent: { type: Number, min: 0, max: 25, default: 5 },
    paymentProvider: { type: String, enum: ['paystack', 'flutterwave'], default: 'paystack' },
    // Owner-controlled, switchable without a redeploy — see services/paymentMode.js.
    // "test" is the safe default so a fresh deploy never accidentally takes live money.
    paymentMode: { type: String, enum: ['live', 'test'], default: 'test' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);
