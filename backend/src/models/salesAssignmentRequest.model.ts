import { Schema, model, Document, Types } from 'mongoose'

export type SalesAssignmentRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
/** ADD = đề xuất thêm Sales Staff (AUTH-FR-005b); REMOVE = yêu cầu gỡ khỏi farm (Flow 16 bước 1e) */
export type SalesAssignmentRequestType = 'ADD' | 'REMOVE'

/** SalesAssignmentRequest – SRS §8.2, AUTH-FR-005b/005d, Flow 16 bước 1b/1e */
export interface ISalesAssignmentRequest extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  /** Document cũ (trước khi có yêu cầu gỡ) không có field này — luôn hiểu là ADD */
  type: SalesAssignmentRequestType
  requested_by: Types.ObjectId
  /** Chỉ có với type=REMOVE: tài khoản Sales Staff cần gỡ khỏi farm */
  sales_staff_id?: Types.ObjectId
  sales_staff_email: string
  status: SalesAssignmentRequestStatus
  reviewed_by?: Types.ObjectId
  review_note?: string
  reviewed_at?: Date
  created_at: Date
}

const salesAssignmentRequestSchema = new Schema<ISalesAssignmentRequest>(
  {
    farm_id:           { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    type:              { type: String, enum: ['ADD', 'REMOVE'], default: 'ADD' },
    requested_by:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sales_staff_id:    { type: Schema.Types.ObjectId, ref: 'User' },
    sales_staff_email: { type: String, required: true, lowercase: true, trim: true },
    status:            { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    reviewed_by:       { type: Schema.Types.ObjectId, ref: 'User' },
    review_note:       { type: String },
    reviewed_at:       { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false },
)

salesAssignmentRequestSchema.index({ status: 1, created_at: 1 })
salesAssignmentRequestSchema.index({ farm_id: 1, type: 1, sales_staff_email: 1, status: 1 })

export const SalesAssignmentRequest = model<ISalesAssignmentRequest>('SalesAssignmentRequest', salesAssignmentRequestSchema)
