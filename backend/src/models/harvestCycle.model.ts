import { Schema, model, Document, Types } from 'mongoose'
import type { FarmMemberRole } from '@/types'

export type HarvestCycleStatus = 'OPEN' | 'CLOSED' | 'CONCLUDED'
export const HARVEST_CYCLE_STATUSES: HarvestCycleStatus[] = ['OPEN', 'CLOSED', 'CONCLUDED']

export interface CycleComparison {
  cycle_id: Types.ObjectId | null
  nest_count: number | null
  weight_grams: number | null
  nest_count_change_pct: number | null
  weight_change_pct: number | null
  /** Vì sao không so sánh được; null khi có số */
  reason: string | null
}

/**
 * HarvestCycle — Report 3 §6.22, BR-43, Report 4 ERD `HARVEST_CYCLE`: chu kỳ thu hoạch của 1 zone, từ lần thu hoạch
 * đã xác nhận trước (hoặc lúc đăng ký controller đầu tiên) tới lần kế tiếp. Dựng lại từ các lô đã xác nhận
 * (`harvestCycle.service#rebuildZoneCycles`), chỉ kết luận mùa vụ do người viết.
 */
export interface IHarvestCycle extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  house_id: Types.ObjectId
  zone_id: Types.ObjectId
  start_date: Date
  /** Ngày thu hoạch đóng chu kỳ; không có khi OPEN */
  end_date?: Date
  status: HarvestCycleStatus
  closing_harvest?: {
    /** 'YYYY-MM-DD' giờ VN — các lô đã xác nhận cùng ngày là một lần thu hoạch */
    date: string
    batch_ids: Types.ObjectId[]
    nest_count: number
    weight_grams: number
  }
  comparison?: { previous: CycleComparison; same_period_last_year: CycleComparison }
  health?: { good_days_pct: number | null; return_rate_avg: number | null; time_in_range_pct: number | null }
  completeness_pct?: number | null
  incomplete: boolean
  conclusion?: { text: string; recommendations?: string; by: Types.ObjectId; role: FarmMemberRole; at: Date }
  created_at: Date
  updated_at: Date
}

const comparisonSchema = new Schema<CycleComparison>({
  cycle_id:              { type: Schema.Types.ObjectId, ref: 'HarvestCycle', default: null },
  nest_count:            { type: Number, default: null },
  weight_grams:          { type: Number, default: null },
  nest_count_change_pct: { type: Number, default: null },
  weight_change_pct:     { type: Number, default: null },
  reason:                { type: String, default: null },
}, { _id: false })

const harvestCycleSchema = new Schema<IHarvestCycle>(
  {
    farm_id:    { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    house_id:   { type: Schema.Types.ObjectId, ref: 'House', required: true },
    zone_id:    { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    start_date: { type: Date, required: true },
    end_date:   { type: Date },
    status:     { type: String, enum: HARVEST_CYCLE_STATUSES, required: true, default: 'OPEN' },
    closing_harvest: {
      type: {
        date:         { type: String, required: true },
        batch_ids:    [{ type: Schema.Types.ObjectId, ref: 'HarvestBatch' }],
        nest_count:   { type: Number, required: true },
        weight_grams: { type: Number, required: true },
        _id: false,
      },
    },
    comparison: {
      type: { previous: comparisonSchema, same_period_last_year: comparisonSchema, _id: false },
    },
    health: {
      type: {
        good_days_pct:     { type: Number, default: null },
        return_rate_avg:   { type: Number, default: null },
        time_in_range_pct: { type: Number, default: null },
        _id: false,
      },
    },
    completeness_pct: { type: Number, default: null },
    incomplete:       { type: Boolean, default: false },
    conclusion: {
      type: {
        text:            { type: String, required: true },
        recommendations: { type: String },
        by:              { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role:            { type: String, enum: ['DOMAIN_EXPERT', 'FARM_OWNER'] satisfies FarmMemberRole[], required: true },
        at:              { type: Date, required: true },
        _id: false,
      },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false },
)

// Report 4 §6.4 — một chu kỳ mỗi zone mỗi mốc bắt đầu; so sánh nhà theo ngày đóng
harvestCycleSchema.index({ zone_id: 1, start_date: 1 }, { unique: true })
harvestCycleSchema.index({ house_id: 1, end_date: -1 })

export const HarvestCycle = model<IHarvestCycle>('HarvestCycle', harvestCycleSchema)
