import { Schema, model, Document, Types } from 'mongoose'
import type { DayValue, RuleAction, RuleComparison, RuleIndicator } from '@/utils/recommendationRule.util'

// 7 ngày sau khi chấp nhận thì đo hiệu quả
export type RecommendationStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'MEASURED'

// Sửa luật sau đó không đổi khuyến nghị đã mở
export interface RuleSnapshot {
  name: string
  indicator: RuleIndicator
  comparison: RuleComparison
  value: number
  window_days: number
  action: RuleAction
}

export interface IRecommendation extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  house_id: Types.ObjectId
  rule_id: Types.ObjectId
  // Bản cũ không có: đọc luật hiện tại
  rule_snapshot?: RuleSnapshot
  status: RecommendationStatus
  // Dữ liệu cho biểu đồ
  evidence: { indicator: string; comparison: string; value: number; window_days: number; days: DayValue[] }
  raised_at: Date
  // Giờ VN
  raised_for: string
  decided_by?: Types.ObjectId
  decided_at?: Date
  // Mốc chờ như decided_at
  expired_at?: Date
  reject_reason?: string
  work_order_id?: Types.ObjectId
  review_ids: Types.ObjectId[]
  // null khi thiếu số
  effect?: { before: number | null; after: number | null; change: number | null; improved: boolean | null; measured_at: Date }
}

const STATUSES = ['OPEN', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'MEASURED'] satisfies RecommendationStatus[]

const recommendationSchema = new Schema<IRecommendation>(
  {
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    house_id: { type: Schema.Types.ObjectId, ref: 'House', required: true },
    rule_id:  { type: Schema.Types.ObjectId, ref: 'RecommendationRule', required: true },
    rule_snapshot: { type: Schema.Types.Mixed },
    status:   { type: String, enum: STATUSES, default: 'OPEN' },
    evidence: { type: Schema.Types.Mixed, required: true },
    raised_at:  { type: Date, required: true },
    raised_for: { type: String, required: true },
    decided_by: { type: Schema.Types.ObjectId, ref: 'User' },
    decided_at: { type: Date },
    expired_at: { type: Date },
    reject_reason: { type: String },
    work_order_id: { type: Schema.Types.ObjectId, ref: 'WorkOrder' },
    review_ids:    [{ type: Schema.Types.ObjectId, ref: 'ParameterReview' }],
    effect: { type: Schema.Types.Mixed },
  },
  { versionKey: false },
)

// mỗi luật và nhà chỉ một khuyến nghị mở
recommendationSchema.index({ rule_id: 1, house_id: 1 }, { unique: true, partialFilterExpression: { status: 'OPEN' } })
recommendationSchema.index({ house_id: 1, status: 1 })
recommendationSchema.index({ farm_id: 1, status: 1, raised_at: -1 })
recommendationSchema.index({ status: 1, raised_at: 1 })
recommendationSchema.index({ status: 1, decided_at: 1 })

export const Recommendation = model<IRecommendation>('Recommendation', recommendationSchema)
