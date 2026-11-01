import { Schema, model, Document, Types } from 'mongoose'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import { DEFAULT_FUZZY_TUNING } from '@/utils/fuzzyTuning.util'
import type { BirdCountTuning, DetectionTuning, FuzzyTuning, HealthLevels, Thresholds, Role } from '@/types'
import { DEFAULT_BIRD_COUNT_TUNING, DEFAULT_DETECTION_TUNING, DEFAULT_HEALTH_LEVELS } from '@/utils/detectionTuning.util'

/**
 * House + Zone Documents – SRS §8.2, FARM-FR-002
 */
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
  /** EXPERT-FR-008 (v2.1.8) — tham số đếm chim của cả nhà (camera ở cửa ra vào của House) */
  bird_count_tuning: BirdCountTuning
  bird_count_tuning_history: IBirdCountTuningHistoryEntry[]
  /** ANALYTICS-FR-012, BR-28 — mức chỉ số sức khỏe của nhà; thiếu trường nào thì dùng mặc định */
  health_levels: HealthLevels
}

export interface IThresholdHistoryEntry {
  changed_by: Types.ObjectId
  /** Role của người sửa lúc sửa (EXPERT-FR-004) — để phân biệt chủ farm với chuyên gia */
  changed_by_role?: Role
  changed_at: Date
  old_values: Partial<Thresholds>
  new_values: Partial<Thresholds>
  /** EXPERT_REVERT: chuyên gia hoàn lại thay đổi của Farm Owner (EXPERT-FR-010) */
  source: 'MANUAL' | 'RESET_TO_DEFAULT' | 'EXPERT_REVERT'
}

/** Nguồn 1 lần đổi hệ số mờ: sửa tay, chuyên gia hoàn lại (EXPERT-FR-010), áp gợi ý đã duyệt (EXPERT-FR-011) */
export type FuzzyTuningSource = 'MANUAL' | 'EXPERT_REVERT' | 'SUGGESTION_APPROVED'

export interface IFuzzyTuningHistoryEntry {
  changed_by: Types.ObjectId
  changed_by_role?: Role
  changed_at: Date
  old_values: Partial<FuzzyTuning>
  new_values: Partial<FuzzyTuning>
  /** Bản ghi trước G-04 không có — đều là sửa tay */
  source?: FuzzyTuningSource
}

export interface IDetectionTuningHistoryEntry {
  changed_by: Types.ObjectId
  changed_by_role?: Role
  changed_at: Date
  old_values: Partial<DetectionTuning>
  new_values: Partial<DetectionTuning>
}

export interface IZone extends Document {
  _id: Types.ObjectId
  house_id: Types.ObjectId
  /** Lưu kèm farm của House (Zone không bao giờ đổi farm) — kiểm tra quyền/lọc theo farm không phải đi qua House */
  farm_id: Types.ObjectId
  name: string
  floor: number
  thresholds: Thresholds
  threshold_history: IThresholdHistoryEntry[]
  /** ENV-FR-021 — hệ số bộ điều khiển mờ của mọi ESP32 trong Zone, gửi qua config/update */
  fuzzy_tuning: FuzzyTuning
  fuzzy_tuning_history: IFuzzyTuningHistoryEntry[]
  /** EXPERT-FR-008 — tham số phát hiện do Domain Expert chỉnh; thiếu trường nào thì dùng mặc định */
  detection_tuning: DetectionTuning
  detection_tuning_history: IDetectionTuningHistoryEntry[]
}

const houseSchema = new Schema<IHouse>(
  {
    farm_id:     { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    name:        { type: String, required: true, trim: true },
    floors:      { type: Number, default: 1 },
    description: { type: String },
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
    health_levels: {
      in_range_slight_pct: { type: Number, default: DEFAULT_HEALTH_LEVELS.in_range_slight_pct },
      in_range_clear_pct:  { type: Number, default: DEFAULT_HEALTH_LEVELS.in_range_clear_pct },
      air_slight_h:        { type: Number, default: DEFAULT_HEALTH_LEVELS.air_slight_h },
      air_clear_h:         { type: Number, default: DEFAULT_HEALTH_LEVELS.air_clear_h },
      noise_slight:        { type: Number, default: DEFAULT_HEALTH_LEVELS.noise_slight },
      noise_clear:         { type: Number, default: DEFAULT_HEALTH_LEVELS.noise_clear },
    },
  },
  { timestamps: { createdAt: 'created_at' } }
)

const zoneSchema = new Schema<IZone>(
  {
    house_id: { type: Schema.Types.ObjectId, ref: 'House', required: true },
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true, immutable: true },
    name:     { type: String, required: true },
    floor:    { type: Number, default: 1 },
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
      source: { type: String, enum: ['MANUAL', 'RESET_TO_DEFAULT', 'EXPERT_REVERT'] },
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
      source: { type: String, enum: ['MANUAL', 'EXPERT_REVERT', 'SUGGESTION_APPROVED'] satisfies FuzzyTuningSource[] },
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
    }],
  },
  { timestamps: { createdAt: 'created_at' } }
)

houseSchema.index({ farm_id: 1 })
zoneSchema.index({ house_id: 1 })
zoneSchema.index({ farm_id: 1 })

// Nơi tạo Zone không truyền farm_id (seed, fixture test) thì lấy từ House
zoneSchema.pre('validate', async function () {
  if (this.farm_id || !this.house_id) return
  const house = await House.findById(this.house_id).select('farm_id').lean()
  if (house) this.farm_id = house.farm_id
})

export const House = model<IHouse>('House', houseSchema)
export const Zone  = model<IZone>('Zone', zoneSchema)
