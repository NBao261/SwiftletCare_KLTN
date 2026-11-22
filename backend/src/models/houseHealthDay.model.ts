import { Schema, model, Document, Types } from 'mongoose'
import type { FarmMemberRole, HealthLevel, HealthRatingValue, HealthReason, HealthReasonCode, HealthSource, HealthStatus } from '@/types'

/** SM-17: current_* tính lại khi dữ liệu trễ; snapshot lúc chấm không đổi, NFR-14 chỉ dùng snapshot */
export interface IHealthIndicator {
  /** environment %, air giờ, flock % giảm, noise số đợt; null khi không tính được */
  value: number | null
  /** null khi không đủ dữ liệu */
  level: HealthLevel | null
  details?: Record<string, unknown>
}

export type HealthIndicators = Record<HealthSource, IHealthIndicator>

export interface IHealthSnapshot {
  status: HealthStatus
  reasons: HealthReason[]
  /** Để tính báo động giả theo nguồn (ANALYTICS-FR-014) */
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
  /** Tối đa 24 */
  hours: number
}

export interface IHouseHealthDay extends Document {
  _id: Types.ObjectId
  house_id: Types.ObjectId
  farm_id: Types.ObjectId
  /** Giờ VN */
  date: string
  indicators: HealthIndicators
  /** BR-28 */
  completeness: Record<HealthSource, boolean>
  current_status: HealthStatus
  current_reasons: HealthReason[]
  evidence: { noise_alert_ids: Types.ObjectId[] }
  /** Lưu kèm vì bản ghi theo giờ chỉ giữ 90 ngày (BR-36) */
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

const SOURCES = ['environment', 'air', 'flock', 'noise'] satisfies HealthSource[]
export const HEALTH_REASON_CODES = [
  'ALL_NORMAL', 'MISSING_DATA', 'NOT_ASSESSED', 'ENV_IN_RANGE', 'AIR_OVER_LIMIT',
  'FLOCK_DROP', 'FLOCK_NO_BASELINE', 'NOISE_EPISODES', 'WEATHER_UNAVAILABLE', 'RAIN_DOWNGRADE',
] satisfies HealthReasonCode[]

const reasonSchema = new Schema<HealthReason>(
  {
    code:   { type: String, enum: HEALTH_REASON_CODES, required: true },
    source: { type: String, enum: SOURCES, default: null },
    level:  { type: String, enum: ['SLIGHT', 'CLEAR'], default: null },
    values: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false, minimize: false }
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
    current_reasons: [reasonSchema],
    evidence: {
      noise_alert_ids: [{ type: Schema.Types.ObjectId, ref: 'Alert' }],
    },
    weather:     { type: Schema.Types.Mixed, default: null },
    computed_at: { type: Date, required: true },
    ratings: [{
      by:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
      role:    { type: String, enum: ['FARM_OWNER', 'FARM_TECHNICIAN', 'DOMAIN_EXPERT'] satisfies FarmMemberRole[], required: true },
      outcome: { type: String, enum: ['RATED', 'SKIPPED'], required: true },
      rating:  { type: String, enum: ['GOOD', 'WATCH', 'ACTION'] satisfies HealthRatingValue[] },
      note:    { type: String },
      at:      { type: Date, required: true },
      snapshot: {
        status:  { type: String, enum: STATUSES, required: true },
        reasons: [reasonSchema],
        levels:  sourceLevels,
      },
    }],
  },
  { versionKey: false }
)

houseHealthDaySchema.index({ house_id: 1, date: 1 }, { unique: true })
houseHealthDaySchema.index({ farm_id: 1, date: 1 })

export const HouseHealthDay = model<IHouseHealthDay>('HouseHealthDay', houseHealthDaySchema)
