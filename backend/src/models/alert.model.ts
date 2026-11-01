import { Schema, model, Document, Types } from 'mongoose'
import type { AlertType, AlertSeverity, AlertStatus, AlertVerdictResult, FarmMemberRole } from '@/types'

/** Alert document – SRS §8.2, ALERT-FR-001 */
export interface IAlert extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  zone_id?: Types.ObjectId
  /** Cảnh báo của cả nhà yến (camera đếm chim: EDGE_AI_DEGRADED, LOW_RETURN_RATE — SRS v2.1.8), không gắn Zone */
  house_id?: Types.ObjectId
  node_id?: Types.ObjectId
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  snapshot_url?: string
  metadata?: Record<string, unknown>
  /**
   * Report 4 §6.1 — chi tiết của sự cố: THRESHOLD_BREACH {metric, observed, threshold, direction, started_at}
   * (ALERT-FR-012); UNEXPECTED_RESTART {reset_reason} (THREAT-FR-012). `metadata` giữ cho client cũ
   */
  details?: Record<string, unknown>
  status: AlertStatus
  /** SM-01 — trạng thái trước khi bị bác bỏ (`DISMISSED`); đổi kết luận sang CONFIRMED thì trở về đây */
  previous_status?: Extract<AlertStatus, 'ACTIVE' | 'ACKNOWLEDGED'>
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
  /** ALERT-FR-015 — lúc đã gửi lại vì chưa ai xác nhận; có rồi thì không gửi lần nữa */
  renotified_at?: Date
  /**
   * EXPERT-FR-003 — xác nhận/bác bỏ cảnh báo suy luận; không có = chờ kiểm chứng. `role`: Domain Expert,
   * hoặc Farm Owner khi farm chưa có chuyên gia (BR-22); kết luận cũ trước G-03 không có `role`
   */
  expert_verdict?: { result: AlertVerdictResult; note?: string; by: Types.ObjectId; role?: FarmMemberRole; at: Date }
}

const alertSchema = new Schema<IAlert>(
  {
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    zone_id:  { type: Schema.Types.ObjectId, ref: 'Zone' },
    house_id: { type: Schema.Types.ObjectId, ref: 'House' },
    node_id:  { type: Schema.Types.ObjectId },
    type: {
      type: String,
      enum: [
        'THRESHOLD_BREACH','NODE_OFFLINE','SPEAKER_FAILURE',
        'MISTING_INEFFECTIVE','NOISE_ANOMALY','UNEXPECTED_RESTART','LOW_RETURN_RATE','EDGE_AI_DEGRADED',
        'SENSOR_FAULT','RS485_BUS_FAILURE','SENSOR_ANOMALY','FORECAST_BREACH','MAINTENANCE_DUE',
        'ACTUATOR_FAULT','CONFIG_MISMATCH',
      ] satisfies AlertType[],
      required: true,
    },
    severity:    { type: String, enum: ['CRITICAL','HIGH','MEDIUM','LOW'] satisfies AlertSeverity[], required: true },
    title:       { type: String, required: true },
    message:     { type: String, required: true },
    snapshot_url:        { type: String },
    metadata:            { type: Schema.Types.Mixed },
    details:             { type: Schema.Types.Mixed },
    status:              { type: String, enum: ['ACTIVE','ACKNOWLEDGED','DISMISSED','RESOLVED'] satisfies AlertStatus[], default: 'ACTIVE' },
    previous_status:     { type: String, enum: ['ACTIVE','ACKNOWLEDGED'] satisfies AlertStatus[] },
    created_at:          { type: Date, default: Date.now },
    last_seen_at:        { type: Date },
    occurrence_count:    { type: Number, default: 1 },
    acknowledged_at:     { type: Date },
    resolved_at:         { type: Date },
    acknowledged_by:     { type: Schema.Types.ObjectId, ref: 'User' },
    acknowledgement_note:{ type: String },
    renotified_at:       { type: Date },
    expert_verdict: {
      type: {
        result: { type: String, enum: ['CONFIRMED', 'REJECTED'] satisfies AlertVerdictResult[], required: true },
        note:   { type: String },
        by:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role:   { type: String, enum: ['DOMAIN_EXPERT', 'FARM_OWNER'] satisfies FarmMemberRole[] },
        at:     { type: Date, required: true },
        _id: false,
      },
    },
  },
  { versionKey: false }
)

// Tìm alert đang mở của cùng 1 sự cố (ALERT-FR-008)
alertSchema.index({ farm_id: 1, zone_id: 1, node_id: 1, type: 1, status: 1 })
// Cảnh báo của cả nhà (camera đếm chim) — lọc GET /alerts?houseId= và dedup theo House
alertSchema.index({ house_id: 1, type: 1, status: 1 }, { partialFilterExpression: { house_id: { $exists: true } } })
// Alert đã đóng tự xoá sau 180 ngày; alert đang mở không có resolved_at nên không bao giờ hết hạn
alertSchema.index({ resolved_at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 })

export const Alert = model<IAlert>('Alert', alertSchema)
