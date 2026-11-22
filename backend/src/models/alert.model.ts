import { Schema, model, Document, Types } from 'mongoose'
import type { AlertType, AlertSeverity, AlertStatus, AlertVerdictResult, FarmMemberRole } from '@/types'
import { SITE_CAUSES, type SiteCause } from '@/models/workOrder.model'

// Gồm cả DISMISSED. Đặt ở model để workOrder.service khỏi import alert.service (vòng import)
export const OPEN_ALERT_STATUSES: AlertStatus[] = ['ACTIVE', 'ACKNOWLEDGED', 'DISMISSED']

export const ONSITE_OBSERVATIONS = [
  'BIRDS_DISTURBED', 'WORK_OR_PEOPLE_NEARBY', 'RAIN', 'SENSOR_DIRTY_OR_FAULTY', 'NOTHING_UNUSUAL', 'OTHER',
] as const
export type OnsiteObservation = typeof ONSITE_OBSERVATIONS[number]

export interface OnsiteCheck {
  technician_id: Types.ObjectId
  requested_at: Date
  observation?: OnsiteObservation
  note?: string
  // Khoá MinIO
  photo?: string
  answered_by?: Types.ObjectId
  answered_at?: Date
}

export interface IAlert extends Document {
  _id: Types.ObjectId
  farm_id: Types.ObjectId
  zone_id?: Types.ObjectId
  // Cảnh báo của cả nhà (camera), không gắn Zone
  house_id?: Types.ObjectId
  node_id?: Types.ObjectId
  // eventId mới nhất của thiết bị
  event_id?: string
  // tính trong hook validate, unique khi còn mở
  incident_key?: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  snapshot_url?: string
  metadata?: Record<string, unknown>
  // THRESHOLD_BREACH {metric, observed, threshold, direction, started_at}; UNEXPECTED_RESTART {reset_reason}
  details?: Record<string, unknown>
  status: AlertStatus
  // đổi kết luận sang CONFIRMED thì trở về đây
  previous_status?: Extract<AlertStatus, 'ACTIVE' | 'ACKNOWLEDGED'>
  created_at: Date
  // Cập nhật tối đa 1 lần/phút
  last_seen_at?: Date
  occurrence_count: number
  acknowledged_at?: Date
  resolved_at?: Date
  acknowledged_by?: Types.ObjectId
  acknowledgement_note?: string
  // có rồi thì không gửi lại nữa
  renotified_at?: Date
  // không có = chờ kiểm chứng; role là Farm Owner khi farm chưa có chuyên gia
  expert_verdict?: { result: AlertVerdictResult; note?: string; by: Types.ObjectId; role?: FarmMemberRole; at: Date }
  // mỗi việc nhắc một lần
  expert_reminded_at?: Date
  // Không có = cảnh báo cũ, gửi Farm Owner
  routing?: { technician_id?: Types.ObjectId; owners_notified: boolean }
  // có rồi thì không báo nữa
  escalated_at?: Date
  site_cause?: { cause: SiteCause; photos: string[]; by: Types.ObjectId; at: Date }
  onsite_checks: OnsiteCheck[]
}

const alertSchema = new Schema<IAlert>(
  {
    farm_id:  { type: Schema.Types.ObjectId, ref: 'Farm', required: true },
    zone_id:  { type: Schema.Types.ObjectId, ref: 'Zone' },
    house_id: { type: Schema.Types.ObjectId, ref: 'House' },
    node_id:  { type: Schema.Types.ObjectId },
    event_id: { type: String },
    incident_key: { type: String },
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
    expert_reminded_at: { type: Date },
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
    routing: {
      type: {
        technician_id:   { type: Schema.Types.ObjectId, ref: 'User' },
        owners_notified: { type: Boolean, required: true },
        _id: false,
      },
    },
    escalated_at: { type: Date },
    site_cause: {
      type: {
        cause:  { type: String, enum: SITE_CAUSES, required: true },
        photos: { type: [String], default: [] },
        by:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
        at:     { type: Date, required: true },
        _id: false,
      },
    },
    onsite_checks: [{
      technician_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      requested_at:  { type: Date, required: true },
      observation:   { type: String, enum: ONSITE_OBSERVATIONS },
      note:          { type: String },
      photo:         { type: String },
      answered_by:   { type: Schema.Types.ObjectId, ref: 'User' },
      answered_at:   { type: Date },
      _id: false,
    }],
  },
  { versionKey: false }
)

// ACTUATOR_FAULT tách theo details.load, MAINTENANCE_DUE theo details.plan_id
export function incidentKeyOf(alert: {
  type: string
  farm_id: unknown
  zone_id?: unknown
  house_id?: unknown
  node_id?: unknown
  details?: Record<string, unknown>
}): string {
  const part = (value: unknown) => (value === undefined || value === null ? '' : String(value))
  const load = alert.type === 'ACTUATOR_FAULT' ? part(alert.details?.load) : ''
  const plan = alert.type === 'MAINTENANCE_DUE' ? part(alert.details?.plan_id) : ''
  return [alert.type, alert.farm_id, alert.zone_id, alert.house_id, alert.node_id, load, plan].map(part).join('|')
}

alertSchema.pre('validate', function setIncidentKey() {
  this.incident_key = incidentKeyOf(this)
})

alertSchema.index({ farm_id: 1, zone_id: 1, node_id: 1, type: 1, status: 1 })
// Hai tin cùng sự cố tới cùng lúc không tạo được hai cảnh báo mở
alertSchema.index(
  { incident_key: 1 },
  { unique: true, partialFilterExpression: { incident_key: { $type: 'string' }, status: { $in: OPEN_ALERT_STATUSES } } },
)
alertSchema.index({ house_id: 1, type: 1, status: 1 }, { partialFilterExpression: { house_id: { $exists: true } } })
// Đã đóng thì xoá sau 180 ngày. QoS 1 giao lại không tạo cảnh báo thứ hai
alertSchema.index({ node_id: 1, event_id: 1 }, { unique: true, partialFilterExpression: { event_id: { $type: 'string' } } })
alertSchema.index({ resolved_at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 })
alertSchema.index({ status: 1, 'routing.owners_notified': 1, created_at: 1 }, { partialFilterExpression: { 'routing.owners_notified': false } })

export const Alert = model<IAlert>('Alert', alertSchema)
