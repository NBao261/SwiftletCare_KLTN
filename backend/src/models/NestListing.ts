import { Schema, model, Document, Types } from 'mongoose'
import type { ListingStatus } from '@/types'

/** NestListing – SRS §8.2, MARKET-FR-006..013 */
export interface INestListing extends Document {
  _id: Types.ObjectId
  harvest_batch_id: Types.ObjectId
  farm_id: Types.ObjectId
  title: string
  description?: string
  price_vnd?: number
  price_unit: string
  listing_status: ListingStatus
  contact_info: {
    show_phone: boolean
    show_email: boolean
    show_zalo: boolean
  }
  view_count: number
  inquiry_count: number
  published_at?: Date
  created_at: Date
  updated_at: Date
}

const nestListingSchema = new Schema<INestListing>(
  {
    harvest_batch_id: { type: Schema.Types.ObjectId, ref: 'HarvestBatch', required: true },
    farm_id:          { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    title:            { type: String, required: true },
    description:      { type: String },
    price_vnd:        { type: Number },
    price_unit:       { type: String, default: 'gram' },
    listing_status:   { type: String, enum: ['AVAILABLE','SOLD','HIDDEN'] as ListingStatus[], default: 'AVAILABLE' },
    contact_info: {
      show_phone: { type: Boolean, default: true },
      show_email: { type: Boolean, default: false },
      show_zalo:  { type: Boolean, default: true },
    },
    view_count:    { type: Number, default: 0 },
    inquiry_count: { type: Number, default: 0 },
    published_at:  { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

export const NestListing = model<INestListing>('NestListing', nestListingSchema)
