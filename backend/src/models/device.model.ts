import { Schema, model, Document, Types } from 'mongoose'
import type { DeviceStatus, ControlMode, RelayStates, CountingRing, Role, ConfigSyncState } from '@/types'

export interface IRelayOverride {
  mode: ControlMode
  override_expiry?: Date
  override_by?: Types.ObjectId
}

export interface ISensorNode extends Document {
  _id: Types.ObjectId
  device_id: string
  zone_id: Types.ObjectId
  firmware_version: string
  ota_pending?: { version: string; url: string; requested_at: Date; requested_by?: Types.ObjectId }
  ota_failed?: { version: string; failed_at: Date; running_version: string }
  last_heartbeat?: Date
  status: DeviceStatus
  applied_config_version?: number | null
  config_sync: ConfigSyncState
  config_stale_heartbeats: number
  rssi?: number
  booted_at?: Date
  free_heap?: number
  reset_reason?: string
  ip?: string
  relay_states: RelayStates
  relays: Record<keyof RelayStates, IRelayOverride>
  // Tóm tắt của relays, chỉ ghi qua syncOverrideSummary
  control_mode: ControlMode
  override_expiry?: Date
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
  simulated: boolean
  registered_by?: Types.ObjectId
  activation_overdue_at?: Date
  // không xoá vì telemetry/alert cũ tham chiếu node_id
  decommissioned_at?: Date
  decommission_reason?: string
  replaced_by?: Types.ObjectId
  // since_service_* về 0 khi xác nhận MAINTENANCE_DUE
  relay_usage: {
    misting: IRelayUsage
    ventilation: IRelayUsage
    counted_until?: Date
    last_misting_on?: boolean
    last_ventilation_on?: boolean
  }
  // thiếu thì giờ chạy tính theo thời gian relay BẬT
  actuator_baseline?: { misting_a?: number; ventilation_a?: number }
}

export interface IRelayUsage {
  on_hours: number
  switches: number
  since_service_hours: number
  since_service_switches: number
}

// Tình trạng camera IP do nút AI báo trong heartbeat
export const CAMERA_STATUSES = ['OK', 'NO_SOURCE', 'AUTH_FAILED', 'UNREACHABLE', 'NO_FRAMES'] as const
export type CameraStatus = typeof CAMERA_STATUSES[number]

// Địa chỉ camera IP Farm Owner nhập trên web; mật khẩu mã hoá (utils/secretBox.util), không bao giờ trả ra API
export interface ICameraSource {
  host: string
  port: number
  username: string
  path: string
  password_encrypted?: string
  // Tăng mỗi lần sửa; config của nút AI mang số này, nút AI thấy đổi thì lấy lại địa chỉ
  version: number
  updated_at: Date
  updated_by?: Types.ObjectId
}

export interface ICameraNode extends Document {
  _id: Types.ObjectId
  device_id: string
  house_id: Types.ObjectId
  // Cũ: URL chữ thường lúc đăng ký, nút AI không đọc; migrate:camera-source chuyển sang camera_source rồi xoá
  rtsp_url?: string
  camera_source?: ICameraSource
  camera_status?: CameraStatus
  camera_status_at?: Date
  status: DeviceStatus
  last_heartbeat?: Date
  model_version?: string
  fps?: number
  registered_at: Date
  simulated: boolean
  registered_by?: Types.ObjectId
  activation_overdue_at?: Date
  decommissioned_at?: Date
  decommission_reason?: string
  replaced_by?: Types.ObjectId
  // Vòng đầu tiên kèm người sửa; app cũ chỉ đọc trường này
  counting_ring?: CountingRing & { updated_at: Date; updated_by: Types.ObjectId }
  // 1–4 vòng; [] = đã xoá, nút AI dùng vòng trong config.yaml; bản ghi cũ không có
  counting_rings?: CountingRing[]
  // Vòng trong config.yaml do nút AI báo qua heartbeat, để web hiện như một vòng thường
  default_rings?: CountingRing[]
  counting_ring_history: ICountingRingHistoryEntry[]
}

export interface ICountingRingHistoryEntry {
  changed_by: Types.ObjectId
  changed_by_role?: Role
  changed_at: Date
  // Bản ghi cũ là 1 vòng, bản ghi mới là danh sách vòng
  old_value?: CountingRing | CountingRing[]
  new_value: CountingRing | CountingRing[]
}

const relayUsageSchema = {
  on_hours:               { type: Number, default: 0 },
  switches:               { type: Number, default: 0 },
  since_service_hours:    { type: Number, default: 0 },
  since_service_switches: { type: Number, default: 0 },
}

const relayOverrideSchema = new Schema<IRelayOverride>(
  {
    mode:            { type: String, enum: ['AUTO','MANUAL'] satisfies ControlMode[], default: 'AUTO' },
    override_expiry: { type: Date },
    override_by:     { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
)

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
    // deviceOffline.job chỉ quét ONLINE nên PENDING không bị thành OFFLINE
    status:           { type: String, enum: ['PENDING','ONLINE','OFFLINE'] satisfies DeviceStatus[], default: 'PENDING' },
    applied_config_version: { type: Number, default: null },
    config_sync:      { type: String, enum: ['PENDING','APPLIED','MISMATCH','UNKNOWN'] satisfies ConfigSyncState[], default: 'PENDING' },
    config_stale_heartbeats: { type: Number, default: 0 },
    rssi:             { type: Number },
    booted_at:        { type: Date },
    free_heap:        { type: Number },
    reset_reason:     { type: String },
    ip:               { type: String },
    relay_states: {
      misting:     { type: Boolean, default: false },
      speaker:     { type: Boolean, default: false },
      ventilation: { type: Boolean, default: false },
    },
    relays: {
      misting:     { type: relayOverrideSchema, default: () => ({}) },
      speaker:     { type: relayOverrideSchema, default: () => ({}) },
      ventilation: { type: relayOverrideSchema, default: () => ({}) },
    },
    control_mode:    { type: String, enum: ['AUTO','MANUAL'] satisfies ControlMode[], default: 'AUTO' },
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
    simulated:       { type: Boolean, default: false },
    activation_overdue_at: { type: Date },
    decommissioned_at:   { type: Date },
    decommission_reason: { type: String },
    replaced_by:         { type: Schema.Types.ObjectId },
    relay_usage: {
      misting:             relayUsageSchema,
      ventilation:         relayUsageSchema,
      counted_until:       { type: Date },
      last_misting_on:     { type: Boolean },
      last_ventilation_on: { type: Boolean },
    },
    actuator_baseline: {
      misting_a:     { type: Number },
      ventilation_a: { type: Number },
    },
  },
  { timestamps: false }
)

const cameraNodeSchema = new Schema<ICameraNode>(
  {
    device_id:      { type: String, required: true, unique: true },
    house_id:       { type: Schema.Types.ObjectId, ref: 'House', required: true },
    rtsp_url:       { type: String, select: false },
    camera_source: {
      type: new Schema({
        host:               { type: String, required: true },
        port:               { type: Number, required: true },
        username:           { type: String, default: '' },
        path:               { type: String, required: true },
        password_encrypted: { type: String, select: false },
        version:            { type: Number, required: true },
        updated_at:         { type: Date, required: true },
        updated_by:         { type: Schema.Types.ObjectId, ref: 'User' },
      }, { _id: false }),
    },
    camera_status:    { type: String, enum: CAMERA_STATUSES },
    camera_status_at: { type: Date },
    status:         { type: String, enum: ['PENDING','ONLINE','OFFLINE'] satisfies DeviceStatus[], default: 'PENDING' },
    last_heartbeat: { type: Date },
    model_version:  { type: String },
    fps:            { type: Number },
    registered_at:  { type: Date, default: Date.now },
    registered_by:  { type: Schema.Types.ObjectId, ref: 'User' },
    simulated:      { type: Boolean, default: false },
    activation_overdue_at: { type: Date },
    decommissioned_at:   { type: Date },
    decommission_reason: { type: String },
    replaced_by:         { type: Schema.Types.ObjectId },
    counting_ring: {
      type: new Schema({
        points:            { type: [[Number]], required: true },
        into_ring_is_exit: { type: Boolean, required: true },
        updated_at: { type: Date, required: true },
        updated_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      }, { _id: false }),
      default: undefined,
    },
    counting_rings: {
      type: [new Schema({
        points:            { type: [[Number]], required: true },
        into_ring_is_exit: { type: Boolean, required: true },
      }, { _id: false })],
      default: undefined,
    },
    default_rings: {
      type: [new Schema({
        points:            { type: [[Number]], required: true },
        into_ring_is_exit: { type: Boolean, required: true },
      }, { _id: false })],
      default: undefined,
    },
    counting_ring_history: [{
      changed_by:      { type: Schema.Types.ObjectId, ref: 'User' },
      changed_by_role: { type: String },
      changed_at:      { type: Date },
      old_value:       { type: Schema.Types.Mixed },
      new_value:       { type: Schema.Types.Mixed },
    }],
  },
  { timestamps: false }
)

sensorNodeSchema.index({ status: 1, last_heartbeat: 1 })
cameraNodeSchema.index({ status: 1, last_heartbeat: 1 })
sensorNodeSchema.index({ zone_id: 1 })
cameraNodeSchema.index({ house_id: 1 })
sensorNodeSchema.index({ status: 1, registered_at: 1 })
cameraNodeSchema.index({ status: 1, registered_at: 1 })

export const IN_SERVICE = { decommissioned_at: null } as const

export const SensorNode = model<ISensorNode>('SensorNode', sensorNodeSchema)
export const CameraNode = model<ICameraNode>('CameraNode', cameraNodeSchema)
