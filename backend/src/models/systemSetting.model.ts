import { Schema, model, Document, Types } from 'mongoose'
import type { SlaConfig, Thresholds } from '@/types'

/** SystemSetting – SRS §8.2, SYSTEM-FR-002. Singleton: collection chỉ có 1 document. */
export interface ISystemSetting extends Document {
  _id: Types.ObjectId
  /** Khoá ép singleton — xem ghi chú ở schema */
  _singleton: boolean
  default_thresholds: Thresholds
  /** TICKET-FR-006, SLA-NFR-001 — có thể chưa có nếu Admin chưa từng chỉnh SLA */
  sla_hours?: SlaConfig
  updated_by?: Types.ObjectId
  updated_at: Date
}

// Không đặt required: `sla_hours` là tuỳ chọn (chưa cấu hình thì dùng DEFAULT_SLA),
// mà required ở trường con sẽ bắt buộc cả document phải có SLA mới lưu được.
// Ràng buộc giá trị do assertValidSla (utils/sla.util.ts) kiểm ở tầng service.
const slaLevelSchema = {
  response_hours: { type: Number },
  resolve_hours:  { type: Number },
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
    sla_hours: {
      P1: slaLevelSchema,
      P2: slaLevelSchema,
      P3: slaLevelSchema,
    },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' }, versionKey: false },
)

export const SystemSetting = model<ISystemSetting>('SystemSetting', systemSettingSchema)
