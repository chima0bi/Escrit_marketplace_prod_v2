import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    isActive: { type: Boolean, default: true },
    approvalStatus: { type: String, enum: ['approved', 'pending', 'rejected', 'assigned'], default: 'approved', index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const ProductCategory = mongoose.model('ProductCategory', categorySchema, 'productCategories');
export const CourseCategory = mongoose.model('CourseCategory', categorySchema, 'courseCategories');
export const ServiceCategory = mongoose.model('ServiceCategory', categorySchema, 'serviceCategories');
