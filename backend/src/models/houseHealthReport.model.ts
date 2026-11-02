import { Schema, model, Document, Types } from 'mongoose'
import type { ZoneHealthMetrics } from '@/models/zoneHealthReport.model'

export type HouseReportKind = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
export const HOUSE_REPORT_KINDS: HouseReportKind[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']

/** Mục của 1 Zone trong báo cáo nhà: số liệu như báo cáo Zone cũ, thêm cảnh báo suy luận và lỗi thiết bị */
export interface HouseReportZoneSection extends ZoneHealthMetrics {
  zone_id: Types.ObjectId
  zone_name: string
  /** Cảnh báo suy luận của kỳ theo kết luận của chuyên gia (EXPERT-FR-003) */
  inferred_alerts: { confirmed: number; dismissed: number; pending: number }
  /** Cảnh báo thiết bị và tải theo loại */
  device_faults: Record<string, number>
}

export interface HouseReportMetrics {
  /** Tỷ lệ chim về từng ngày; ngày thiếu phiên `complete: false` (VISION-FR-020) */
  return_rate_trend: { date: string; return_rate: number | null; complete: boolean }[]
  /** Trung bình các ngày đủ phiên */
  avg_return_rate: number | null
  /** Tóm tắt thời tiết ngoài trời của kỳ (ANALYTICS-FR-013); null khi không có dữ liệu */
  weather: {
    temperature_min: number | null
    temperature_max: number | null
    humidity_avg: number | null
    precipitation_mm: number | null
    /** Số ngày có ít nhất 1 giờ mưa ≥ RAIN_MM_PER_HOUR (BR-30) */
    rain_days: number
  } | null
}

/**
 * HouseHealthReport — EXPERT-FR-005/006, SM-09. Báo cáo sức khỏe 1 nhà yến trong 1 kỳ (ngày, tuần, tháng
 * theo BR-33, hoặc khoảng tự chọn), mỗi Zone một mục. Trạng thái các ngày của kỳ không lưu ở đây: dựng
 * lúc đọc từ `househealthdays` để che theo người gọi (BR-31). Thay báo cáo tuần theo Zone khi màn mới
 * dùng xong; tới lúc đó báo cáo Zone cũ vẫn chạy song song.
 */
export interface IHouseHealthReport extends Document {
  _id: Types.ObjectId
  house_id: Types.ObjectId
  farm_id: Types.ObjectId
  kind: HouseReportKind
  /** 'YYYY-MM-DD' giờ VN, tính cả 2 đầu */
  period_start: string
  period_end: string
  generated_at: Date
  house_metrics: HouseReportMetrics
  zone_sections: HouseReportZoneSection[]
  /** EXPERT-FR-006 — `at` lúc viết lần đầu, `edited_at` lần sửa gần nhất của tác giả */
  expert_conclusion?: { text: string; by: Types.ObjectId; at: Date; edited_at?: Date }
}

const houseHealthReportSchema = new Schema<IHouseHealthReport>(
  {
    house_id: { type: Schema.Types.ObjectId, ref: 'House', required: true },
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    kind:     { type: String, enum: HOUSE_REPORT_KINDS, required: true },
    period_start: { type: String, required: true },
    period_end:   { type: String, required: true },
    generated_at: { type: Date, required: true },
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
  { versionKey: false },
)

// Report 4 §6.3 — 1 báo cáo mỗi nhà, loại và kỳ: job chạy lại hoặc 2 instance không tạo bản trùng
houseHealthReportSchema.index({ house_id: 1, kind: 1, period_start: 1, period_end: 1 }, { unique: true })
houseHealthReportSchema.index({ house_id: 1, period_end: -1 })
houseHealthReportSchema.index({ farm_id: 1, period_end: -1 })

export const HouseHealthReport = model<IHouseHealthReport>('HouseHealthReport', houseHealthReportSchema)
