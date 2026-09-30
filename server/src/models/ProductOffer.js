import mongoose from 'mongoose';

const productOfferSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    proposedPriceKobo: { type: Number, min: 10000, required: true },
    status: { type: String, enum: ['PROPOSED', 'ACCEPTED', 'REJECTED'], default: 'PROPOSED', index: true },
    linkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', default: null },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ProductOffer = mongoose.model('ProductOffer', productOfferSchema);