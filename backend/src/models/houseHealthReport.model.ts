import { Schema, model, Document, Types } from 'mongoose'

export interface ZoneHealthMetrics {
  sample_count: number
  temp_in_range_pct: number | null
  humidity_in_range_pct: number | null
  /** ANALYTICS-FR-011 */
  auto_mode_pct: number | null
  misting_switches: number
  ventilation_switches: number
  /** Gồm cả lỗi thiết bị */
  alerts_by_type: Record<string, number>
  avg_return_rate: number | null
  nh3_avg: number | null
  nh3_max: number | null
  co2_avg: number | null
  co2_max: number | null
}

export type HouseReportKind = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
export const HOUSE_REPORT_KINDS: HouseReportKind[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']

export interface HouseReportZoneSection extends ZoneHealthMetrics {
  zone_id: Types.ObjectId
  zone_name: string
  inferred_alerts: { confirmed: number; dismissed: number; pending: number }
  device_faults: Record<string, number>
}

export interface HouseReportMetrics {
  /** Ngày thiếu phiên: complete false (VISION-FR-020) */
  return_rate_trend: { date: string; return_rate: number | null; complete: boolean }[]
  avg_return_rate: number | null
  /** null khi không có dữ liệu */
  weather: {
    temperature_min: number | null
    temperature_max: number | null
    humidity_avg: number | null
    precipitation_mm: number | null
    /** BR-30 */
    rain_days: number
  } | null
}

/** BR-33: trạng thái các ngày dựng lúc đọc từ househealthdays, không lưu ở đây */
export interface IHouseHealthReport extends Document {
  _id: Types.ObjectId
  house_id: Types.ObjectId
  farm_id: Types.ObjectId
  kind: HouseReportKind
  /** Giờ VN, tính cả 2 đầu */
  period_start: string
  period_end: string
  generated_at: Date
  house_metrics: HouseReportMetrics
  zone_sections: HouseReportZoneSection[]
  expert_conclusion?: { text: string; by: Types.ObjectId; at: Date; edited_at?: Date }
  /** BR-22: mỗi việc nhắc một lần */
  expert_reminded_at?: Date
}

const houseHealthReportSchema = new Schema<IHouseHealthReport>(
  {
    house_id: { type: Schema.Types.ObjectId, ref: 'House', required: true },
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    kind:     { type: String, enum: HOUSE_REPORT_KINDS, required: true },
    period_start: { type: String, required: true },
    period_end:   { type: String, required: true },
    generated_at: { type: Date, required: true },
    expert_reminded_at: { type: Date },
    house_metrics: { type: Schema.Types.Mixed, required: true },
    zone_sections: [{ type: Schema.Types.Mixed }],
    expert_conclusion: {
      type: {
        text: { type: String, required: true },
        by:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at:   { type: Date, required: true },
        edited_at: { type: Date },
        _id: false,
      },
    },
  },
  // minimize: false để giữ object rỗng như api-spec
  { versionKey: false, minimize: false },
)

// Job chạy lại hoặc 2 instance không tạo bản trùng
houseHealthReportSchema.index({ house_id: 1, kind: 1, period_start: 1, period_end: 1 }, { unique: true })
houseHealthReportSchema.index({ house_id: 1, period_end: -1 })
houseHealthReportSchema.index({ farm_id: 1, period_end: -1 })

export const HouseHealthReport = model<IHouseHealthReport>('HouseHealthReport', houseHealthReportSchema)
