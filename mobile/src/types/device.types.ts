import type { Role } from './auth.types'

// Khớp backend/src/types/domain.types.ts — PENDING: đã đăng ký nhưng chưa gửi heartbeat đầu tiên; chỉ 3 trạng thái kết nối (Report 3 §6.6)
export type DeviceStatus = 'PENDING' | 'ONLINE' | 'OFFLINE'

// Đồng bộ cấu hình của controller (ENV-FR-027, Report 3 §6.12) — cùng ConfigSyncState ở backend/src/types/domain.types.ts
export type ConfigSyncState = 'PENDING' | 'APPLIED' | 'MISMATCH' | 'UNKNOWN'
export type ControlMode = 'AUTO' | 'MANUAL'

// Relay IN1 phun sương, IN2 loa ru, IN3 quạt — khớp backend; IN4 dự phòng, đã bỏ sưởi (Report 3 §8)
export interface RelayStates {
  misting: boolean
  speaker: boolean
  ventilation: boolean
}

// Chế độ và hạn của một relay (BR-20) — khớp RelayOverride trong api-spec
export interface RelayOverride {
  mode: ControlMode
  // Chỉ có khi mode = MANUAL
  override_expiry?: string
  // ID người bật tay; thiết bị tự báo MANUAL thì không có
  override_by?: string
}

export interface SensorNode {
  _id: string
  device_id: string
  zone_id: string
  firmware_version: string
  last_heartbeat?: string
  status: DeviceStatus
  // ENV-FR-027 — APPLIED khi heartbeat báo đúng config_version của Zone; applied_config_version null khi firmware không báo
  config_sync?: ConfigSyncState
  applied_config_version?: number | null
  rssi?: number
  // FARM-FR-006 — chẩn đoán từ heartbeat: thời điểm khởi động (tính uptime), RAM trống, lý do khởi động, IP trong LAN
  booted_at?: string
  free_heap?: number
  reset_reason?: string
  ip?: string
  relay_states: RelayStates
  // Tóm tắt cả controller: MANUAL khi có ít nhất một relay đang điều khiển tay, hạn là hạn sớm nhất — chế độ thật của từng
  // relay nằm trong relays (BR-20); dữ liệu cũ chưa có relays thì dùng hai trường này cho mọi relay
  control_mode: ControlMode
  override_expiry?: string
  relays?: Partial<Record<keyof RelayStates, RelayOverride>>
  // Khung giờ phát loa ru (ENV-FR-013b), giờ dạng HH:mm
  speaker_schedule?: { enabled?: boolean; windows?: { start: string; end: string }[] }
  registered_at?: string
  // Flow 1 case 8a — PENDING quá 15 phút chưa có heartbeat
  activation_overdue_at?: string | null
  // FARM-FR-008 — thời điểm gỡ (danh sách chỉ trả thiết bị đang dùng, trường này có ở bản ghi gỡ/khôi phục trả về) và node lắp thay
  decommissioned_at?: string | null
  replaced_by?: string | null
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
  // FARM-FR-008 — thời điểm gỡ, có ở bản ghi gỡ/khôi phục trả về
  decommissioned_at?: string | null
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
  // ENV-FR-019 — bật bơm lúc Zone có cảnh báo cảm biến/phun sương và Farm Owner đã xác nhận
  alert_confirmed?: boolean
}

// Token xem live stream 60 giây của một camera (VISION-FR-013) — khớp GET /devices/camera-nodes/{id}/stream-token
export interface StreamToken {
  // Tên stream trên MediaMTX: cam-<device_id>
  path: string
  token: string
  expires_in: number
}
