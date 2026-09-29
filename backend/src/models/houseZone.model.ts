import { Schema, model, Document, Types } from 'mongoose'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import { DEFAULT_FUZZY_TUNING } from '@/utils/fuzzyTuning.util'
import type { FuzzyTuning, Thresholds } from '@/types'

/**
 * House + Zone Documents – SRS §8.2, FARM-FR-002
 */
export interface IHouse extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  name: string
  floors: number
  description?: string
}

export interface IThresholdHistoryEntry {
  changed_by: Types.ObjectId
  changed_at: Date
  old_values: Partial<Thresholds>
  new_values: Partial<Thresholds>
  source: 'MANUAL' | 'RESET_TO_DEFAULT'
}

export interface IFuzzyTuningHistoryEntry {
  changed_by: Types.ObjectId
  changed_at: Date
  old_values: Partial<FuzzyTuning>
  new_values: Partial<FuzzyTuning>
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
}

const houseSchema = new Schema<IHouse>(
  {
    farm_id:     { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    name:        { type: String, required: true, trim: true },
    floors:      { type: Number, default: 1 },
    description: { type: String },
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
      source: { type: String, enum: ['MANUAL', 'RESET_TO_DEFAULT'] },
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
