import { Schema, model, Document, Types } from 'mongoose'

/** ContactInquiry – SRS §8.2, MARKET-FR-010 (Buyer liên hệ Farm Owner) */
export interface IContactInquiry extends Document {
  _id: Types.ObjectId
  listing_id: Types.ObjectId
  buyer_name: string
  buyer_phone?: string
  buyer_email?: string
  message: string
  created_at: Date
  is_read: boolean
}

const contactInquirySchema = new Schema<IContactInquiry>(
  {
    listing_id: { type: Schema.Types.ObjectId, ref: 'NestListing', required: true },
    buyer_name: { type: String, required: true },
    buyer_phone:{ type: String },
    buyer_email:{ type: String },
    message:    { type: String, required: true },
    is_read:    { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
)

export const ContactInquiry = model<IContactInquiry>('ContactInquiry', contactInquirySchema)
