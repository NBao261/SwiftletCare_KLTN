import { Schema, model, Document, Types } from 'mongoose'
import type { AlertType, AlertSeverity, AlertStatus } from '@/types'

/** Alert document – SRS §8.2, ALERT-FR-001 */
export interface IAlert extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  zone_id?: Types.ObjectId
  node_id?: Types.ObjectId
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  snapshot_url?: string
  metadata?: Record<string, unknown>
  status: AlertStatus
  created_at: Date
  /** Lần gần nhất sự cố còn được ghi nhận (cập nhật tối đa 1 lần/phút) — ALERT-FR-008 */
  last_seen_at?: Date
  /** Số lần sự cố được ghi nhận lại trong khi alert còn mở, thay vì tạo alert trùng */
  occurrence_count: number
  acknowledged_at?: Date
  /** Lúc cảnh báo được đóng (sự cố hết, hoặc thiết bị đã gỡ khỏi hệ thống) */
  resolved_at?: Date
  acknowledged_by?: Types.ObjectId
  acknowledgement_note?: string
}

const alertSchema = new Schema<IAlert>(
  {
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    zone_id:  { type: Schema.Types.ObjectId, ref: 'Zone' },
    node_id:  { type: Schema.Types.ObjectId },
    type: {
      type: String,
      enum: [
        'THRESHOLD_BREACH','PREDATOR_DETECTED','NODE_OFFLINE','SPEAKER_FAILURE',
        'PUMP_DRY','BIRD_PANIC','POWER_OUTAGE','LOW_RETURN_RATE','EDGE_AI_DEGRADED',
        'SENSOR_FAULT','RS485_BUS_FAILURE',
      ] as AlertType[],
      required: true,
    },
    severity:    { type: String, enum: ['CRITICAL','HIGH','MEDIUM','LOW'] as AlertSeverity[], required: true },
    title:       { type: String, required: true },
    message:     { type: String, required: true },
    snapshot_url:        { type: String },
    metadata:            { type: Schema.Types.Mixed },
    status:              { type: String, enum: ['ACTIVE','ACKNOWLEDGED','RESOLVED'] as AlertStatus[], default: 'ACTIVE' },
    created_at:          { type: Date, default: Date.now },
    last_seen_at:        { type: Date },
    occurrence_count:    { type: Number, default: 1 },
    acknowledged_at:     { type: Date },
    resolved_at:         { type: Date },
    acknowledged_by:     { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledgement_note:{ type: String },
  },
  { versionKey: false }
)

// Tìm alert đang mở của cùng 1 sự cố (ALERT-FR-008)
alertSchema.index({ farm_id: 1, zone_id: 1, node_id: 1, type: 1, status: 1 })
// Alert đã đóng tự xoá sau 180 ngày; alert đang mở không có resolved_at nên không bao giờ hết hạn
alertSchema.index({ resolved_at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 })

export const Alert = model<IAlert>('Alert', alertSchema)
