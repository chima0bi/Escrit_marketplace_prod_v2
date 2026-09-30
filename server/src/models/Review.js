import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    listingType: { type: String, enum: ['product', 'course', 'service'], required: true, index: true },
    listingId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true, unique: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

reviewSchema.index({ listingType: 1, listingId: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);