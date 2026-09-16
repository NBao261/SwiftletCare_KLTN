import { Schema, model, Document, Types } from 'mongoose'
import type { ReturnStatus } from '@/types'

/** ReturnRequest – SRS §8.2, Module SALES (Giai đoạn 2) */
export interface IReturnRequest extends Document {
  _id: Types.ObjectId
  order_id: Types.ObjectId
  reason: string
  evidence_images: string[]
  status: ReturnStatus
  verified_by?: Types.ObjectId
  resolved_by?: Types.ObjectId
  resolution_note?: string
  created_at: Date
  resolved_at?: Date
}

const returnRequestSchema = new Schema<IReturnRequest>(
  {
    order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    reason:   { type: String, required: true },
    evidence_images: [{ type: String }],
    status: {
      type: String,
      enum: ['SUBMITTED','UNDER_VERIFICATION','APPROVED_REFUND','APPROVED_EXCHANGE','REJECTED'] as ReturnStatus[],
      default: 'SUBMITTED',
    },
    verified_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolved_by: { type: Schema.Types.ObjectId, ref: 'User' },
    resolution_note: { type: String },
    resolved_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false }
)

export const ReturnRequest = model<IReturnRequest>('ReturnRequest', returnRequestSchema)
