// Module DEVICE (§5.3) — Sensor/Camera Node, relay, chế độ điều khiển.

// PENDING: Technician đã khai báo qua Web Console nhưng thiết bị chưa gửi
// heartbeat đầu tiên (SRS §8.2, Flow 1).
export type DeviceStatus = 'PENDING' | 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DEGRADED'

export type ControlMode = 'AUTO' | 'MANUAL'

// Guide v3.3 §8-9: relay IN1=misting, IN2=speaker (loa ru), IN3=ventilation, IN4=heating
export interface RelayStates { misting: boolean; speaker: boolean; ventilation: boolean; heating: boolean }
export type RelayName = keyof RelayStates

// ENV-FR-010/011: % công suất 0-100 do bộ điều khiển mờ trên ESP32 tính (tỉ lệ
// thời gian BẬT relay trong cửa sổ 2 phút). Chỉ có qua socket telemetry, firmware < 1.1.0 không gửi.
export interface ControlOutput { misting: number; ventilation: number }

export interface SensorNode {
  _id: string; device_id: string; zone_id: string
  firmware_version: string; last_heartbeat?: string
  status: DeviceStatus; rssi?: number; control_mode: ControlMode
  /** FARM-FR-006 — chẩn đoán từ heartbeat; reset_reason, ip chỉ có từ firmware 1.4.0 */
  booted_at?: string; free_heap?: number; reset_reason?: string; ip?: string
  relay_states: RelayStates
  override_expiry?: string
  speaker_schedule: { enabled: boolean; windows: Array<{ start: string; end: string }> }
  audio: { current_track: number; volume: number; playing: boolean; loop: boolean }
  registered_at: string
  /** TICKET-FR-008 — lệnh OTA đã gửi, chờ heartbeat báo đúng firmware_version mới */
  ota_pending?: { version: string; url: string; requested_at: string; requested_by?: string }
  /** OTA quá hạn xác nhận — thiết bị vẫn chạy `running_version` (đã rollback) */
  ota_failed?: { version: string; failed_at: string; running_version?: string }
  config_pushed_at?: string
  /** TICKET-FR-018 — giờ chạy + số lần đóng cắt thật của bơm/quạt (tính từ telemetry) */
  relay_usage?: { misting?: RelayUsage; ventilation?: RelayUsage; counted_until?: string }
  /** Quá 15 phút kể từ lúc đăng ký mà chưa có heartbeat đầu tiên */
  activation_overdue_at?: string
  decommissioned_at?: string; decommission_reason?: string
}

export interface RelayUsage { on_hours: number; switches: number; since_service_hours: number; since_service_switches: number }

/** POST /devices/sensor-nodes/:id/commands (TICKET-FR-008) */
export type NodeCommand = 'RESTART' | 'PUSH_CONFIG' | 'OTA'
export interface NodeCommandInput {
  command: NodeCommand
  ticket_id?: string
  /** Chỉ khi command=OTA. version dạng x.y.z (không có tiền tố "v"), url https, sha256 hex 64 ký tự */
  ota?: { version: string; url: string; sha256: string }
}

// ENV-FR-019 — một lần can thiệp tay 1 relay (GET /devices/sensor-nodes/:id/relay-overrides)
export type RelayOverrideEndReason = 'EXPIRED' | 'CLEARED_EARLY' | 'REPLACED'
export interface RelayOverrideLog {
  _id: string; node_id: string; zone_id: string; farm_id: string
  relay: 'misting' | 'ventilation' | 'speaker'
  state: boolean
  started_by?: { _id: string; full_name?: string }
  started_by_role?: string
  started_at: string; expires_at: string
  ended_at: string | null
  end_reason: RelayOverrideEndReason | null
}

// ENV-FR-013b — PUT /devices/sensor-nodes/:id/speaker-schedule (firmware: ≤2 khung, giờ tròn)
export interface SpeakerWindow { start: string; end: string }
export interface SpeakerScheduleInput { enabled?: boolean; windows?: SpeakerWindow[]; volume?: number; track?: number }

// ENV-FR-013c — bài trong danh mục web của 1 thiết bị. File DFPlayer phát thật
// nằm trên thẻ SD (`000N.mp3`); `file_url` chỉ để nghe lại bản gốc trên web.
export interface AudioTrack {
  _id: string; node_id: string
  track_number: number; display_name: string
  file_url: string; file_size_bytes: number
  synced_to_sd: boolean
  uploaded_by: string; uploaded_at: string
}

export interface CameraNode {
  _id: string; device_id: string; rtsp_url?: string
  // SRS v2.1.8 — camera ở cửa ra vào của cả nhà yến; zone_id chỉ còn ở bản ghi cũ
  house_id?: string; zone_id?: string
  /** VISION-FR-018 — vòng đếm Domain Expert đã vẽ; không có thì nút AI dùng vòng trong config.yaml */
  counting_ring?: { points: Array<[number, number]>; into_ring_is_exit: boolean; updated_at?: string } | null
  status: DeviceStatus; last_heartbeat?: string; model_version?: string; registered_at: string
  activation_overdue_at?: string
  decommissioned_at?: string; decommission_reason?: string
}

// OPS-NFR-004 — GET /devices/system-status (chỉ Admin)
export interface SystemNodeStatusItem {
  _id: string; device_id: string; type: 'sensor' | 'camera'; status: DeviceStatus
  last_heartbeat?: string; rssi?: number
  /** Chỉ sensor — camera không có */
  firmware_version?: string; registered_at?: string
  zone_id: string; farm_id: string; farm_name: string; house_name: string; floor?: number; zone_name: string
}
export interface SystemNodeStatus {
  summary: { total: number; online: number; offline: number; pending: number; error: number; degraded: number }
  nodes: SystemNodeStatusItem[]
}
