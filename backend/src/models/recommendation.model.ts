import { Schema, model, Document, Types } from 'mongoose'
import type { DayValue } from '@/utils/recommendationRule.util'

/**
 * Khuyến nghị — EXPERT-FR-017…019, Report 3 §6.21 (SM-21); Report 4 ERD `RECOMMENDATION`. Một luật thoả ở một nhà thì
 * mở một khuyến nghị kèm bằng chứng; Farm Owner chấp nhận (Work Order hoặc thay đổi tham số theo MF-05) hoặc từ chối;
 * 7 ngày sau khi chấp nhận thì đo hiệu quả.
 */
export type RecommendationStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'MEASURED'

export interface IRecommendation extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  house_id: Types.ObjectId
  rule_id: Types.ObjectId
  status: RecommendationStatus
  /** EXPERT-FR-017 — điều kiện của luật lúc thoả và giá trị từng ngày đã thoả (dữ liệu cho biểu đồ) */
  evidence: { indicator: string; comparison: string; value: number; window_days: number; days: DayValue[] }
  raised_at: Date
  /** Ngày (giờ VN) đánh giá đã thoả luật */
  raised_for: string
  decided_by?: Types.ObjectId
  decided_at?: Date
  reject_reason?: string
  work_order_id?: Types.ObjectId
  /** Mục duyệt EXPERT-FR-010 mở cho từng zone khi hành động là thay đổi tham số trên farm có chuyên gia */
  review_ids: Types.ObjectId[]
  /** EXPERT-FR-019 — trung bình chỉ số 7 ngày trước và sau ngày chấp nhận; null khi thiếu số */
  effect?: { before: number | null; after: number | null; change: number | null; improved: boolean | null; measured_at: Date }
}

const STATUSES = ['OPEN', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'MEASURED'] satisfies RecommendationStatus[]

const recommendationSchema = new Schema<IRecommendation>(
  {
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    house_id: { type: Schema.Types.ObjectId, ref: 'House', required: true },
    rule_id:  { type: Schema.Types.ObjectId, ref: 'RecommendationRule', required: true },
    status:   { type: String, enum: STATUSES, default: 'OPEN' },
    evidence: { type: Schema.Types.Mixed, required: true },
    raised_at:  { type: Date, required: true },
    raised_for: { type: String, required: true },
    decided_by: { type: Schema.Types.ObjectId, ref: 'User' },
    decided_at: { type: Date },
    reject_reason: { type: String },
    work_order_id: { type: Schema.Types.ObjectId, ref: 'WorkOrder' },
    review_ids:    [{ type: Schema.Types.ObjectId, ref: 'ParameterReview' }],
    effect: { type: Schema.Types.Mixed },
  },
  { versionKey: false },
)

// BR-42 — mỗi luật và nhà chỉ một khuyến nghị đang mở; job chạy lại không mở bản thứ hai
recommendationSchema.index({ rule_id: 1, house_id: 1 }, { unique: true, partialFilterExpression: { status: 'OPEN' } })
recommendationSchema.index({ house_id: 1, status: 1 })
// Job hết hạn và đo hiệu quả quét theo trạng thái và thời điểm
recommendationSchema.index({ status: 1, raised_at: 1 })
recommendationSchema.index({ status: 1, decided_at: 1 })

export const Recommendation = model<IRecommendation>('Recommendation', recommendationSchema)
