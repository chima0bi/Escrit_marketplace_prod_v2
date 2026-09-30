import mongoose from 'mongoose';

const platformCreditEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['earned', 'spent', 'adjustment'], required: true },
    amountKobo: { type: Number, required: true },
    reason: { type: String, required: true, maxlength: 300 },
    listingId: { type: mongoose.Schema.Types.ObjectId, default: null },
    listingType: { type: String, enum: ['product', 'course', 'service', null], default: null },
  },
  { timestamps: true }
);

export const PlatformCreditEntry = mongoose.model('PlatformCreditEntry', platformCreditEntrySchema);