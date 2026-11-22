import { Schema, model, Document, Types } from 'mongoose'
import { RULE_COMPARISONS, RULE_INDICATORS, type RuleAction, type RuleComparison, type RuleIndicator } from '@/utils/recommendationRule.util'

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
  // BR-22: chờ chuyên gia bật
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
    // Đã kiểm ở parseRuleInput
    action:      { type: Schema.Types.Mixed, required: true },
    source:      { type: String, required: true, trim: true },
    active:      { type: Boolean, default: true },
    pending_approval: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

recommendationRuleSchema.index({ farm_id: 1, active: 1 })

export const RecommendationRule = model<IRecommendationRule>('RecommendationRule', recommendationRuleSchema)
