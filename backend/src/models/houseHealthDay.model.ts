import { Schema, model, Document, Types } from 'mongoose'
import type { FarmMemberRole, HealthLevel, HealthRatingValue, HealthSource, HealthStatus } from '@/types'

/**
 * ANALYTICS-FR-012, EXPERT-FR-012, SM-17 — trạng thái sức khỏe 1 ngày (giờ VN) của 1 nhà yến.
 * `current_*` theo dữ liệu mới nhất (tính lại khi dữ liệu trễ hoặc kết luận cảnh báo đổi); mỗi lần chấm
 * lưu ảnh chụp `snapshot` không bao giờ đổi, NFR-14 chỉ dùng ảnh chụp (BR-31, D16). Trạng thái chấm
 * của từng người suy ra từ `ratings` và ngày, không lưu riêng. Giữ suốt đời hệ thống (BR-36).
 */
export interface IHealthIndicator {
  /** environment: % thời gian trong ngưỡng (Zone thấp nhất); air: số giờ vượt ngưỡng (Zone cao nhất);
   *  flock: % tỷ lệ chim về giảm so với nền; noise: số đợt NOISE_ANOMALY. null khi không tính được */
  value: number | null
  /** null khi nguồn không đủ dữ liệu (không đánh giá) */
  level: HealthLevel | null
  /** Số liệu đi kèm (vd return_rate, baseline_avg, theo từng Zone) */
  details?: Record<string, unknown>
}

export type HealthIndicators = Record<HealthSource, IHealthIndicator>

export interface IHealthSnapshot {
  status: HealthStatus
  reasons: string[]
  /** Mức của từng nguồn lúc chấm — để tính tỷ lệ báo động giả theo từng nguồn (ANALYTICS-FR-014) */
  levels: Record<HealthSource, HealthLevel | null>
}

export interface IHealthRating {
  _id: Types.ObjectId
  by: Types.ObjectId
  role: FarmMemberRole
  outcome: 'RATED' | 'SKIPPED'
  rating?: HealthRatingValue
  note?: string
  at: Date
  snapshot: IHealthSnapshot
}

export interface IDayWeather {
  temperature_min: number | null
  temperature_max: number | null
  humidity_avg: number | null
  precipitation_mm: number | null
  /** Số giờ có dữ liệu (tối đa 24) */
  hours: number
}

export interface IHouseHealthDay extends Document {
  _id: Types.ObjectId
  house_id: Types.ObjectId
  farm_id: Types.ObjectId
  /** 'YYYY-MM-DD' giờ VN */
  date: string
  indicators: HealthIndicators
  /** Đủ dữ liệu theo từng nguồn (BR-28) */
  completeness: Record<HealthSource, boolean>
  current_status: HealthStatus
  current_reasons: string[]
  /** ALERT-FR-014 — cảnh báo NOISE_ANOMALY được tính trong ngày */
  evidence: { noise_alert_ids: Types.ObjectId[] }
  /** ANALYTICS-FR-013 — thời tiết ngoài trời của ngày (chỉ hiển thị); null khi không có dữ liệu.
   *  Lưu kèm ngày vì bản ghi theo giờ chỉ giữ 90 ngày (BR-36) */
  weather: IDayWeather | null
  computed_at: Date
  ratings: IHealthRating[]
}

const LEVELS = ['NORMAL', 'SLIGHT', 'CLEAR'] satisfies HealthLevel[]
const STATUSES = ['GOOD', 'WATCH', 'ACTION', 'INSUFFICIENT_DATA'] satisfies HealthStatus[]

const indicatorSchema = new Schema<IHealthIndicator>(
  {
    value:   { type: Number, default: null },
    level:   { type: String, enum: LEVELS, default: null },
    details: { type: Schema.Types.Mixed },
  },
  { _id: false }
)

const sourceFlags = { environment: Boolean, air: Boolean, flock: Boolean, noise: Boolean }
const sourceLevels = {
  environment: { type: String, enum: LEVELS },
  air:         { type: String, enum: LEVELS },
  flock:       { type: String, enum: LEVELS },
  noise:       { type: String, enum: LEVELS },
}

const houseHealthDaySchema = new Schema<IHouseHealthDay>(
  {
    house_id: { type: Schema.Types.ObjectId, ref: 'House', required: true },
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    date:     { type: String, required: true },
    indicators: {
      environment: { type: indicatorSchema },
      air:         { type: indicatorSchema },
      flock:       { type: indicatorSchema },
      noise:       { type: indicatorSchema },
    },
    completeness:    sourceFlags,
    current_status:  { type: String, enum: STATUSES, required: true },
    current_reasons: [{ type: String }],
    evidence: {
      noise_alert_ids: [{ type: Schema.Types.ObjectId, ref: 'Alert' }],
    },
    weather:     { type: Schema.Types.Mixed, default: null },
    computed_at: { type: Date, required: true },
    ratings: [{
      by:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
      role:    { type: String, enum: ['FARM_OWNER', 'DOMAIN_EXPERT'] satisfies FarmMemberRole[], required: true },
      outcome: { type: String, enum: ['RATED', 'SKIPPED'], required: true },
      rating:  { type: String, enum: ['GOOD', 'WATCH', 'ACTION'] satisfies HealthRatingValue[] },
      note:    { type: String },
      at:      { type: Date, required: true },
      snapshot: {
        status:  { type: String, enum: STATUSES, required: true },
        reasons: [{ type: String }],
        levels:  sourceLevels,
      },
    }],
  },
  { versionKey: false }
)

houseHealthDaySchema.index({ house_id: 1, date: 1 }, { unique: true })
houseHealthDaySchema.index({ farm_id: 1, date: 1 })

export const HouseHealthDay = model<IHouseHealthDay>('HouseHealthDay', houseHealthDaySchema)
