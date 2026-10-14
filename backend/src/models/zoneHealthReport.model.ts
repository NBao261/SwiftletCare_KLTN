import { Schema, model, Document, Types } from 'mongoose'

/** Số liệu tổng hợp của 1 Zone trong 1 khoảng thời gian (EXPERT-FR-005) */
export interface ZoneHealthMetrics {
  sample_count: number
  temp_in_range_pct: number | null
  humidity_in_range_pct: number | null
  /** ANALYTICS-FR-011 */
  auto_mode_pct: number | null
  misting_switches: number
  ventilation_switches: number
  /** { <AlertType>: số cảnh báo phát sinh trong kỳ } — gồm cả lỗi thiết bị */
  alerts_by_type: Record<string, number>
  /** null khi chưa có dữ liệu đếm chim */
  avg_return_rate: number | null
  nh3_avg: number | null
  nh3_max: number | null
  co2_avg: number | null
  co2_max: number | null
}

/**
 * ZoneHealthReport – SRS §8.2, EXPERT-FR-005/006. Hệ thống tự tổng hợp theo chu kỳ;
 * Domain Expert gắn kết luận và khuyến nghị cho Farm Owner đọc.
 */
export interface IZoneHealthReport extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  zone_id: Types.ObjectId
  period_start: Date
  period_end: Date
  metrics: ZoneHealthMetrics
  generated_at: Date
  expert_conclusion?: { text: string; by: Types.ObjectId; at: Date }
}

const zoneHealthReportSchema = new Schema<IZoneHealthReport>(
  {
    farm_id: { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    zone_id: { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    period_start: { type: Date, required: true },
    period_end:   { type: Date, required: true },
    metrics:      { type: Schema.Types.Mixed, required: true },
    generated_at: { type: Date, default: Date.now },
    expert_conclusion: {
      type: {
        text: { type: String, required: true },
        by:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at:   { type: Date, required: true },
        _id: false,
      },
    },
  },
  { versionKey: false },
)

// unique: 2 lần chạy chồng nhau (2 instance lúc deploy) cùng mốc phút không tạo 2 báo cáo + 2 thông báo
zoneHealthReportSchema.index({ zone_id: 1, period_end: -1 }, { unique: true })

export const ZoneHealthReport = model<IZoneHealthReport>('ZoneHealthReport', zoneHealthReportSchema)
