import { Schema, model, Document, Types } from 'mongoose'
import { RULE_COMPARISONS, RULE_INDICATORS, type RuleAction, type RuleComparison, type RuleIndicator } from '@/utils/recommendationRule.util'

/**
 * Luật khuyến nghị — EXPERT-FR-016, BR-42; Report 4 ERD `RECOMMENDATION_RULE`. Domain Expert viết, Farm Owner cũng viết
 * được (BR-22): điều kiện trên một chỉ số của nhà trong `window_days` ngày và một hành động. `source` ghi luật lấy từ đâu.
 */
export interface IRecommendationRule extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  author_id: Types.ObjectId
  name: string
  indicator: RuleIndicator
  comparison: RuleComparison
  value: number
  window_days: number
  action: RuleAction
  source: string
  active: boolean
  // BR-22 — luật Farm Owner viết trên farm có chuyên gia: tắt, chờ chuyên gia bật (duyệt) hoặc tắt hẳn
  pending_approval: boolean
  created_at: Date
  updated_at: Date
}

const recommendationRuleSchema = new Schema<IRecommendationRule>(
  {
    farm_id:     { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    author_id:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:        { type: String, required: true, trim: true },
    indicator:   { type: String, enum: [...RULE_INDICATORS], required: true },
    comparison:  { type: String, enum: [...RULE_COMPARISONS], required: true },
    value:       { type: Number, required: true },
    window_days: { type: Number, required: true },
    // Mixed: hai dạng hành động (Work Order hoặc thay đổi tham số), đã kiểm ở recommendationRule.util#parseRuleInput
    action:      { type: Schema.Types.Mixed, required: true },
    source:      { type: String, required: true, trim: true },
    active:      { type: Boolean, default: true },
    pending_approval: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

// Report 4 §6 — job hằng ngày đọc luật đang bật của từng farm
recommendationRuleSchema.index({ farm_id: 1, active: 1 })

export const RecommendationRule = model<IRecommendationRule>('RecommendationRule', recommendationRuleSchema)
