import { Schema, model, Document, Types } from 'mongoose'
import type { DeviceStatus, ControlMode, RelayStates } from '@/types'

/**
 * SensorNode + CameraNode Documents – SRS §8.2
 */
export interface ISensorNode extends Document {
  _id: Types.ObjectId
  device_id: string
  zone_id: Types.ObjectId
  firmware_version: string
  /**
   * TICKET-FR-008, Flow 15 — lệnh OTA đã gửi, chờ heartbeat báo đúng
   * `firmware_version` mới để xác nhận thành công (bước 5).
   */
  ota_pending?: { version: string; url: string; requested_at: Date; requested_by?: Types.ObjectId }
  /** Lần OTA gần nhất quá hạn xác nhận — thiết bị vẫn chạy `running_version` (đã rollback) */
  ota_failed?: { version: string; failed_at: Date; running_version: string }
  last_heartbeat?: Date
  status: DeviceStatus
  rssi?: number
  relay_states: RelayStates
  control_mode: ControlMode
  override_expiry?: Date
  // ENV-FR-013b: hệ thống loa ru (Relay IN2 + DFPlayer Mini)
  speaker_schedule: {
    enabled: boolean
    windows: Array<{ start: string; end: string }>
  }
  audio: {
    current_track: number
    volume: number
    playing: boolean
    loop: boolean
  }
  registered_at: Date
  /** Technician/Admin đã onboarding — nhận thông báo khi kích hoạt quá hạn (Flow 1 case 8a) */
  registered_by?: Types.ObjectId
  /** Flow 1 case 8a — quá 15 phút từ lúc đăng ký mà chưa nhận heartbeat đầu tiên */
  activation_overdue_at?: Date
  /**
   * FARM-FR-008 — thiết bị đã gỡ khỏi hiện trường. Không xoá document vì
   * telemetry/alert cũ tham chiếu node_id; chỉ loại khỏi mọi danh sách/luồng MQTT.
   */
  decommissioned_at?: Date
  decommission_reason?: string
  /** Node mới lắp thay vào chỗ node này (nếu gỡ theo diện thay thế) */
  replaced_by?: Types.ObjectId
}

export interface ICameraNode extends Document {
  _id: Types.ObjectId
  device_id: string
  zone_id: Types.ObjectId
  rtsp_url?: string
  status: DeviceStatus
  last_heartbeat?: Date
  model_version?: string
  registered_at: Date
  /** Technician/Admin đã onboarding — nhận thông báo khi kích hoạt quá hạn (Flow 1 case 8a) */
  registered_by?: Types.ObjectId
  /** Flow 1 case 8a — quá 15 phút từ lúc đăng ký mà chưa nhận heartbeat đầu tiên */
  activation_overdue_at?: Date
  /**
   * FARM-FR-008 — thiết bị đã gỡ khỏi hiện trường. Không xoá document vì
   * telemetry/alert cũ tham chiếu node_id; chỉ loại khỏi mọi danh sách/luồng MQTT.
   */
  decommissioned_at?: Date
  decommission_reason?: string
  /** Node mới lắp thay vào chỗ node này (nếu gỡ theo diện thay thế) */
  replaced_by?: Types.ObjectId
}

const sensorNodeSchema = new Schema<ISensorNode>(
  {
    device_id:        { type: String, required: true, unique: true },
    zone_id:          { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    firmware_version: { type: String, default: '1.0.0' },
    ota_pending: {
      type: new Schema({
        version:      { type: String, required: true },
        url:          { type: String, required: true },
        requested_at: { type: Date, required: true },
        requested_by: { type: Schema.Types.ObjectId, ref: 'User' },
      }, { _id: false }),
      default: undefined,
    },
    ota_failed: {
      type: new Schema({
        version:         { type: String, required: true },
        failed_at:       { type: Date, required: true },
        running_version: { type: String },
      }, { _id: false }),
      default: undefined,
    },
    last_heartbeat:   { type: Date },
    // PENDING = Technician vừa tạo qua Web Console Onboarding, chờ heartbeat đầu
    // tiên (Flow 1 bước 4→8). cron job `deviceOffline.job` chỉ quét node ONLINE nên node
    // PENDING không bị nhầm thành OFFLINE khi chưa từng kết nối.
    status:           { type: String, enum: ['PENDING','ONLINE','OFFLINE','ERROR','DEGRADED'] as DeviceStatus[], default: 'PENDING' },
    rssi:             { type: Number },
    relay_states: {
      misting:     { type: Boolean, default: false },
      speaker:     { type: Boolean, default: false },
      ventilation: { type: Boolean, default: false },
      heating:     { type: Boolean, default: false },
    },
    control_mode:    { type: String, enum: ['AUTO','MANUAL'] as ControlMode[], default: 'AUTO' },
    override_expiry: { type: Date },
    speaker_schedule: {
      enabled: { type: Boolean, default: true },
      windows: [{ start: String, end: String }],
    },
    audio: {
      current_track: { type: Number, default: 1 },
      volume:        { type: Number, default: 20 },
      playing:       { type: Boolean, default: false },
      loop:          { type: Boolean, default: true },
    },
    registered_at:   { type: Date, default: Date.now },
    registered_by:   { type: Schema.Types.ObjectId, ref: 'User' },
    activation_overdue_at: { type: Date },
    decommissioned_at:   { type: Date },
    decommission_reason: { type: String },
    replaced_by:         { type: Schema.Types.ObjectId },
  },
  { timestamps: false }
)

const cameraNodeSchema = new Schema<ICameraNode>(
  {
    device_id:      { type: String, required: true, unique: true },
    zone_id:        { type: Schema.Types.ObjectId, ref: 'Zone', required: true },
    rtsp_url:       { type: String },
    status:         { type: String, enum: ['PENDING','ONLINE','OFFLINE','ERROR','DEGRADED'] as DeviceStatus[], default: 'PENDING' },
    last_heartbeat: { type: Date },
    model_version:  { type: String },
    registered_at:  { type: Date, default: Date.now },
    registered_by:  { type: Schema.Types.ObjectId, ref: 'User' },
    activation_overdue_at: { type: Date },
    decommissioned_at:   { type: Date },
    decommission_reason: { type: String },
    replaced_by:         { type: Schema.Types.ObjectId },
  },
  { timestamps: false }
)

// `deviceOffline.job.ts` quét đúng cặp field này mỗi 10s — không có index thì
// full collection scan lặp lại liên tục khi số thiết bị tăng lên.
sensorNodeSchema.index({ status: 1, last_heartbeat: 1 })
// zone_id là filter chính của mọi danh sách thiết bị theo zone (dashboard).
sensorNodeSchema.index({ zone_id: 1 })
cameraNodeSchema.index({ zone_id: 1 })
// activationOverdue.job quét node PENDING theo registered_at mỗi phút
sensorNodeSchema.index({ status: 1, registered_at: 1 })
cameraNodeSchema.index({ status: 1, registered_at: 1 })

/** FARM-FR-008 — điều kiện "thiết bị còn hoạt động", dùng chung cho mọi truy vấn */
export const IN_SERVICE = { decommissioned_at: null } as const

export const SensorNode = model<ISensorNode>('SensorNode', sensorNodeSchema)
export const CameraNode = model<ICameraNode>('CameraNode', cameraNodeSchema)
