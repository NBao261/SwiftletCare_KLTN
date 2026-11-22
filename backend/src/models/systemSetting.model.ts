import { Schema, model, Document, Types } from 'mongoose'
import type { Thresholds } from '@/types'

/** Singleton: collection chỉ có 1 document */
export interface ISystemSetting extends Document {
  _id: Types.ObjectId
  _singleton: boolean
  default_thresholds: Thresholds
  default_thresholds_source?: string
  default_thresholds_updated_at?: Date

  updated_by?: Types.ObjectId
  updated_at: Date
}


const systemSettingSchema = new Schema<ISystemSetting>(
  {
    /** Upsert chỉ atomic khi filter trỏ vào unique index: thiếu thì 2 request đồng thời tạo 2 document */
    _singleton: { type: Boolean, default: true, unique: true, immutable: true },
    default_thresholds: {
      temp_min:     { type: Number, required: true },
      temp_max:     { type: Number, required: true },
      humidity_min: { type: Number, required: true },
      humidity_max: { type: Number, required: true },
      light_max:    { type: Number, required: true },
      nh3_max:      { type: Number, required: true },
      co2_max:      { type: Number, required: true },
    },
    default_thresholds_source: { type: String },
    default_thresholds_updated_at: { type: Date },

    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' }, versionKey: false },
)

export const SystemSetting = model<ISystemSetting>('SystemSetting', systemSettingSchema)
