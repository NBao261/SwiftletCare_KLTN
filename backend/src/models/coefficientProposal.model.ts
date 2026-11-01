import { Schema, model, Document, Types } from 'mongoose'
import type { FuzzyTuning } from '@/types'

export type CoefficientProposalStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED'

/**
 * EXPERT-FR-011, Report 3 §6.11 — gợi ý hệ số của hệ thống (ANALYTICS-FR-010) mà Farm Owner gửi
 * cho Domain Expert; trên farm có chuyên gia chỉ chuyên gia áp được gợi ý. Giá trị được chụp lúc gửi
 * để chuyên gia duyệt đúng cái Farm Owner đã thấy.
 */
export interface ICoefficientProposal extends Document {
  _id: Types.ObjectId
  zone_id: Types.ObjectId
  farm_id: Types.ObjectId
  submitted_by: Types.ObjectId
  suggested_values: Partial<FuzzyTuning>
  current_values: FuzzyTuning
  /** % thời gian trong ngưỡng và % phun dự kiến (hiện tại / gợi ý), từ mô phỏng của gợi ý */
  predicted?: Record<string, number>
  status: CoefficientProposalStatus
  /** Lý do từ chối (bắt buộc khi REJECTED) */
  note?: string
  decided_by?: Types.ObjectId
  decided_at?: Date
  created_at: Date
  updated_at: Date
}

const coefficientProposalSchema = new Schema<ICoefficientProposal>(
  {
    zone_id:          { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    farm_id:          { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    submitted_by:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    suggested_values: { type: Schema.Types.Mixed, required: true },
    current_values:   { type: Schema.Types.Mixed, required: true },
    predicted:        { type: Schema.Types.Mixed },
    status:           {
      type: String, enum: ['PROPOSED', 'APPROVED', 'REJECTED', 'SUPERSEDED'] satisfies CoefficientProposalStatus[],
      default: 'PROPOSED',
    },
    note:             { type: String, trim: true },
    decided_by:       { type: Schema.Types.ObjectId, ref: 'User' },
    decided_at:       { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
)

coefficientProposalSchema.index({ zone_id: 1, status: 1 })
// Mỗi Zone chỉ 1 đề xuất đang chờ: 2 lần gửi cùng lúc không để lại 2 đề xuất PROPOSED (EXPERT-FR-011)
coefficientProposalSchema.index({ zone_id: 1 }, { unique: true, partialFilterExpression: { status: 'PROPOSED' } })
// Danh sách đề xuất của 1 farm, mới nhất trước
coefficientProposalSchema.index({ farm_id: 1, created_at: -1 })

export const CoefficientProposal = model<ICoefficientProposal>('CoefficientProposal', coefficientProposalSchema)
