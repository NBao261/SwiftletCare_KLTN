import type { Role } from './auth.types'

// Khớp backend/src/types/domain.types.ts — PENDING: đã đăng ký nhưng chưa gửi heartbeat đầu tiên; chỉ 3 trạng thái kết nối (Report 3 §6.6)
export type DeviceStatus = 'PENDING' | 'ONLINE' | 'OFFLINE'
export type ControlMode = 'AUTO' | 'MANUAL'

// Relay IN1 phun sương, IN2 loa ru, IN3 quạt — khớp backend; IN4 dự phòng, đã bỏ sưởi (Report 3 §8)
export interface RelayStates {
  misting: boolean
  speaker: boolean
  ventilation: boolean
}

export interface SensorNode {
  _id: string
  device_id: string
  zone_id: string
  firmware_version: string
  last_heartbeat?: string
  status: DeviceStatus
  rssi?: number
  relay_states: RelayStates
  control_mode: ControlMode
  override_expiry?: string
  registered_at?: string
  // Flow 1 case 8a — PENDING quá 15 phút chưa có heartbeat
  activation_overdue_at?: string | null
}

// Camera đếm chim ở cửa ra vào của cả nhà yến — gắn House, không gắn Zone (SRS v2.1.8)
export interface CameraNode {
  _id: string
  device_id: string
  house_id: string
  rtsp_url?: string
  status: DeviceStatus
  last_heartbeat?: string
  model_version?: string
  registered_at?: string
  // Flow 1 case 8a — PENDING quá 15 phút chưa có heartbeat
  activation_overdue_at?: string | null
}

export type RelayName = keyof RelayStates

// Một lần can thiệp tay một relay (ENV-FR-019) — khớp RelayOverrideLog trong api-spec; ended_at null là đang override
export interface RelayOverrideLog {
  _id: string
  node_id: string
  zone_id: string
  farm_id: string
  relay: RelayName
  // Trạng thái được ép: true = bật, false = tắt
  state: boolean
  started_by?: { _id: string; full_name: string }
  started_by_role?: Role
  started_at: string
  expires_at: string
  ended_at: string | null
  end_reason: 'EXPIRED' | 'CLEARED_EARLY' | 'REPLACED' | null
}

// Token xem live stream 60 giây của một camera (VISION-FR-013) — khớp GET /devices/camera-nodes/{id}/stream-token
export interface StreamToken {
  // Tên stream trên MediaMTX: cam-<device_id>
  path: string
  token: string
  expires_in: number
}
