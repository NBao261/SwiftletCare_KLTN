import { Schema, model, Document, Types } from 'mongoose'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import { DEFAULT_FUZZY_TUNING } from '@/utils/fuzzyTuning.util'
import type { BirdCountTuning, DetectionTuning, FuzzyTuning, HealthLevels, HouseStage, Thresholds, Role } from '@/types'
import { DEFAULT_BIRD_COUNT_TUNING, DEFAULT_DETECTION_TUNING, DEFAULT_HEALTH_LEVELS } from '@/utils/detectionTuning.util'
import { currentConfigVersion } from '@/utils/configSync.util'
import { WEATHER_METRICS, type WeatherRuleInput } from '@/utils/weatherCompensation.util'
import { applySoftDeleteScope } from '@/utils/softDelete.util'
import type { CountingSchedule } from '@/utils/countingSchedule.util'

export interface IWeatherRule extends WeatherRuleInput {
  _id: Types.ObjectId
}

export interface IBirdCountTuningHistoryEntry {
  changed_by: Types.ObjectId
  changed_by_role?: Role
  changed_at: Date
  old_values: Partial<BirdCountTuning>
  new_values: Partial<BirdCountTuning>
}

export interface IHouse extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  name: string
  floors: number
  description?: string
  is_deleted: boolean
  deleted_at?: Date
  deleted_by?: Types.ObjectId
  // _id là rule_id gửi kèm offset
  weather_rules: IWeatherRule[]
  weather_rules_history: Array<{ changed_by: Types.ObjectId; changed_by_role?: Role; changed_at: Date; old_values: unknown; new_values: unknown }>
  weather_rules_proposal?: { rules: Array<WeatherRuleInput & { _id?: string }>; proposed_by: Types.ObjectId; proposed_at: Date } | null
  bird_count_tuning: BirdCountTuning
  bird_count_tuning_history: IBirdCountTuningHistoryEntry[]
  counting_schedule?: CountingSchedule
  // Sửa lịch áp từ hôm sau (effective_from)
  counting_schedule_history: Array<{
    schedule: CountingSchedule; effective_from: string; changed_by: Types.ObjectId; changed_by_role: Role; changed_at: Date
  }>
  // job nhận việc 1 lần/ngày qua trường này
  last_session_check?: string
  health_levels: HealthLevels
  // Lịch sử để đánh giá lại ngày cũ đúng giai đoạn
  stage: HouseStage
  stage_history: Array<{ stage: HouseStage; changed_by: Types.ObjectId; changed_by_role: Role; changed_at: Date }>
  technicians: Array<{ user_id: Types.ObjectId; primary: boolean }>
  // Giờ VN; ngoài mọi ca thì tới thợ chính
  roster: Array<{ technician_id: Types.ObjectId; role: 'PRIMARY' | 'BACKUP'; weekdays: number[]; start: string; end: string }>
}

export interface IThresholdHistoryEntry {
  changed_by: Types.ObjectId
  changed_by_role?: Role
  changed_at: Date
  old_values: Partial<Thresholds>
  new_values: Partial<Thresholds>
  source: 'MANUAL' | 'RESET_TO_DEFAULT' | 'EXPERT_REVERT' | 'PROFILE'
}

export type FuzzyTuningSource = 'MANUAL' | 'EXPERT_REVERT' | 'SUGGESTION_APPROVED' | 'PROFILE'

export interface IFuzzyTuningHistoryEntry {
  changed_by: Types.ObjectId
  changed_by_role?: Role
  changed_at: Date
  old_values: Partial<FuzzyTuning>
  new_values: Partial<FuzzyTuning>
  source?: FuzzyTuningSource
}

export interface IDetectionTuningHistoryEntry {
  changed_by: Types.ObjectId
  changed_by_role?: Role
  changed_at: Date
  old_values: Partial<DetectionTuning>
  new_values: Partial<DetectionTuning>
  source?: 'PROFILE'
}

export interface IZone extends Document {
  _id: Types.ObjectId
  house_id: Types.ObjectId
  // Zone không bao giờ đổi farm: lọc theo farm khỏi đi qua House
  farm_id: Types.ObjectId
  name: string
  floor: number
  is_deleted: boolean
  deleted_at?: Date
  deleted_by?: Types.ObjectId
  thresholds: Thresholds
  threshold_history: IThresholdHistoryEntry[]
  fuzzy_tuning: FuzzyTuning
  fuzzy_tuning_history: IFuzzyTuningHistoryEntry[]
  detection_tuning: DetectionTuning
  detection_tuning_history: IDetectionTuningHistoryEntry[]
  // Tăng qua deviceConfig.service#publishZoneConfig
  config_version: number
}

const houseSchema = new Schema<IHouse>(
  {
    farm_id:     { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    name:        { type: String, required: true, trim: true },
    floors:      { type: Number, default: 1 },
    description: { type: String },
    is_deleted:  { type: Boolean, default: false },
    deleted_at:  { type: Date },
    deleted_by:  { type: Schema.Types.ObjectId, ref: 'User' },
    weather_rules: [{
      metric:       { type: String, enum: [...WEATHER_METRICS], required: true },
      min:          { type: Number, required: true },
      offset_pct:   { type: Number, required: true },
      duration_min: { type: Number, required: true },
      active:       { type: Boolean, default: true },
    }],
    weather_rules_proposal: {
      type: new Schema({
        rules: { type: Schema.Types.Mixed, required: true },
        proposed_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        proposed_at: { type: Date, required: true },
      }, { _id: false }),
      default: null,
    },
    weather_rules_history: [{
      changed_by: { type: Schema.Types.ObjectId, ref: 'User' },
      changed_by_role: { type: String },
      changed_at: { type: Date },
      old_values: { type: Schema.Types.Mixed },
      new_values: { type: Schema.Types.Mixed },
      _id: false,
    }],
    bird_count_tuning: {
      return_rate_drop_pct: { type: Number, default: DEFAULT_BIRD_COUNT_TUNING.return_rate_drop_pct },
    },
    bird_count_tuning_history: [{
      changed_by: { type: Schema.Types.ObjectId, ref: 'User' },
      changed_by_role: { type: String },
      changed_at: { type: Date },
      old_values: { type: Schema.Types.Mixed },
      new_values: { type: Schema.Types.Mixed },
    }],
    counting_schedule: { type: Schema.Types.Mixed },
    counting_schedule_history: [{
      // Đã kiểm ở parseCountingSchedule
      schedule:        { type: Schema.Types.Mixed, required: true },
      effective_from:  { type: String, required: true },
      changed_by:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
      changed_by_role: { type: String, required: true },
      changed_at:      { type: Date, required: true },
      _id: false,
    }],
    last_session_check: { type: String },
    health_levels: {
      in_range_slight_pct: { type: Number, default: DEFAULT_HEALTH_LEVELS.in_range_slight_pct },
      in_range_clear_pct:  { type: Number, default: DEFAULT_HEALTH_LEVELS.in_range_clear_pct },
      air_slight_h:        { type: Number, default: DEFAULT_HEALTH_LEVELS.air_slight_h },
      air_clear_h:         { type: Number, default: DEFAULT_HEALTH_LEVELS.air_clear_h },
      noise_slight:        { type: Number, default: DEFAULT_HEALTH_LEVELS.noise_slight },
      noise_clear:         { type: Number, default: DEFAULT_HEALTH_LEVELS.noise_clear },
    },
    stage: { type: String, enum: ['ATTRACTING', 'OCCUPIED'] satisfies HouseStage[], default: 'OCCUPIED' },
    stage_history: [{
      stage:           { type: String, enum: ['ATTRACTING', 'OCCUPIED'] satisfies HouseStage[], required: true },
      changed_by:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
      changed_by_role: { type: String, required: true },
      changed_at:      { type: Date, required: true },
      _id: false,
    }],
    technicians: [{
      user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      primary: { type: Boolean, default: false },
      _id: false,
    }],
    roster: [{
      technician_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      role:     { type: String, enum: ['PRIMARY', 'BACKUP'], required: true },
      weekdays: [{ type: Number, min: 0, max: 6 }],
      start:    { type: String, required: true },
      end:      { type: String, required: true },
      _id: false,
    }],
  },
  { timestamps: { createdAt: 'created_at' } }
)
houseSchema.index({ 'technicians.user_id': 1 })

const zoneSchema = new Schema<IZone>(
  {
    house_id: { type: Schema.Types.ObjectId, ref: 'House', required: true },
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true, immutable: true },
    name:     { type: String, required: true },
    floor:    { type: Number, default: 1 },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date },
    deleted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    thresholds: {
      temp_min:     { type: Number, default: DEFAULT_THRESHOLDS.temp_min },
      temp_max:     { type: Number, default: DEFAULT_THRESHOLDS.temp_max },
      humidity_min: { type: Number, default: DEFAULT_THRESHOLDS.humidity_min },
      humidity_max: { type: Number, default: DEFAULT_THRESHOLDS.humidity_max },
      light_max:    { type: Number, default: DEFAULT_THRESHOLDS.light_max },
      nh3_max:      { type: Number, default: DEFAULT_THRESHOLDS.nh3_max },
      co2_max:      { type: Number, default: DEFAULT_THRESHOLDS.co2_max },
    },
    threshold_history: [{
      changed_by: { type: Schema.Types.ObjectId, ref: 'User' },
      changed_at: { type: Date },
      old_values: { type: Schema.Types.Mixed },
      new_values: { type: Schema.Types.Mixed },
      source: { type: String, enum: ['MANUAL', 'RESET_TO_DEFAULT', 'EXPERT_REVERT', 'PROFILE'] },
      changed_by_role: { type: String },
    }],
    fuzzy_tuning: {
      fuzzy_humidity_band: { type: Number, default: DEFAULT_FUZZY_TUNING.fuzzy_humidity_band },
      fuzzy_temp_band:     { type: Number, default: DEFAULT_FUZZY_TUNING.fuzzy_temp_band },
      fuzzy_fan_dry_level: { type: Number, default: DEFAULT_FUZZY_TUNING.fuzzy_fan_dry_level },
      fuzzy_window_sec:    { type: Number, default: DEFAULT_FUZZY_TUNING.fuzzy_window_sec },
      fuzzy_input_filter:  { type: Boolean, default: DEFAULT_FUZZY_TUNING.fuzzy_input_filter },
    },
    fuzzy_tuning_history: [{
      changed_by: { type: Schema.Types.ObjectId, ref: 'User' },
      changed_by_role: { type: String },
      changed_at: { type: Date },
      old_values: { type: Schema.Types.Mixed },
      new_values: { type: Schema.Types.Mixed },
      source: { type: String, enum: ['MANUAL', 'EXPERT_REVERT', 'SUGGESTION_APPROVED', 'PROFILE'] satisfies FuzzyTuningSource[] },
    }],
    detection_tuning: {
      noise_margin_db:       { type: Number, default: DEFAULT_DETECTION_TUNING.noise_margin_db },
      noise_min_sec:         { type: Number, default: DEFAULT_DETECTION_TUNING.noise_min_sec },
      pump_dry_on_sec:       { type: Number, default: DEFAULT_DETECTION_TUNING.pump_dry_on_sec },
      pump_dry_min_rise_pct: { type: Number, default: DEFAULT_DETECTION_TUNING.pump_dry_min_rise_pct },
      speaker_drop_pct:      { type: Number, default: DEFAULT_DETECTION_TUNING.speaker_drop_pct },
    },
    detection_tuning_history: [{
      changed_by: { type: Schema.Types.ObjectId, ref: 'User' },
      changed_by_role: { type: String },
      changed_at: { type: Date },
      old_values: { type: Schema.Types.Mixed },
      new_values: { type: Schema.Types.Mixed },
      source: { type: String, enum: ['PROFILE'] },
    }],
    config_version: { type: Number, default: () => currentConfigVersion() },
  },
  { timestamps: { createdAt: 'created_at' } }
)

houseSchema.index({ farm_id: 1 })
zoneSchema.index({ house_id: 1 })
zoneSchema.index({ farm_id: 1 })

// Seed, fixture không truyền farm_id
zoneSchema.pre('validate', async function () {
  if (this.farm_id || !this.house_id) return
  const house = await House.findById(this.house_id).select('farm_id').lean()
  if (house) this.farm_id = house.farm_id
})

applySoftDeleteScope(houseSchema)
applySoftDeleteScope(zoneSchema)

export const House = model<IHouse>('House', houseSchema)
export const Zone  = model<IZone>('Zone', zoneSchema)
