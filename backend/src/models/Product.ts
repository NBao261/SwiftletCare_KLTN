import { Schema, model, Document, Types } from 'mongoose'
import type { ProductReviewStatus, ProductListingStatus } from '@/types'

/** Product – SRS §8.2, Module SALES (§5.10, Giai đoạn 2) */
export interface IProduct extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  harvest_batch_id: Types.ObjectId
  created_by: Types.ObjectId
  name: string
  description?: string
  price_vnd: number
  price_unit: string
  images: string[]
  review_status: ProductReviewStatus
  rejection_reason?: string
  listing_status: ProductListingStatus
  created_at: Date
  updated_at: Date
}

const productSchema = new Schema<IProduct>(
  {
    farm_id:          { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    harvest_batch_id: { type: Schema.Types.ObjectId, ref: 'HarvestBatch', required: true },
    created_by:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:             { type: String, required: true },
    description:      { type: String },
    price_vnd:        { type: Number, required: true },
    price_unit:       { type: String, default: 'gram' },
    images: [{ type: String }],
    review_status:   { type: String, enum: ['PENDING_REVIEW','APPROVED','REJECTED'] as ProductReviewStatus[], default: 'PENDING_REVIEW' },
    rejection_reason:{ type: String },
    listing_status:  { type: String, enum: ['ACTIVE','OUT_OF_STOCK','HIDDEN'] as ProductListingStatus[], default: 'HIDDEN' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

export const Product = model<IProduct>('Product', productSchema)
