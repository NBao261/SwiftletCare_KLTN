import { Schema, model, Document, Types } from 'mongoose'
import type { Thresholds } from '@/types'

/** SystemSetting – SRS §8.2, SYSTEM-FR-002. Singleton: collection chỉ có 1 document. */
export interface ISystemSetting extends Document {
  _id: Types.ObjectId
  /** Khoá ép singleton — xem ghi chú ở schema */
  _singleton: boolean
  default_thresholds: Thresholds
  updated_by?: Types.ObjectId
  updated_at: Date
}

const systemSettingSchema = new Schema<ISystemSetting>(
  {
    /**
     * MongoDB chỉ đảm bảo upsert atomic khi filter trỏ vào 1 unique index. Nếu
     * upsert bằng filter rỗng, 2 request đồng thời vào collection trống đều
     * không tìm thấy gì nên cùng insert → sinh nhiều document, ngưỡng mặc định
     * trả về trở nên không xác định. Field này luôn bằng true + unique index
     * nên document thứ 2 bị DB từ chối (E11000).
     */
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
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' }, versionKey: false },
)

export const SystemSetting = model<ISystemSetting>('SystemSetting', systemSettingSchema)
