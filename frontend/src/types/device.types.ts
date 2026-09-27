// Module DEVICE (§5.3) — Sensor/Camera Node, relay, chế độ điều khiển.

// PENDING: Technician đã khai báo qua Web Console nhưng thiết bị chưa gửi
// heartbeat đầu tiên (SRS §8.2, Flow 1).
export type DeviceStatus = 'PENDING' | 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DEGRADED'

export type ControlMode = 'AUTO' | 'MANUAL'

// Guide v3.3 §8-9: relay IN1=misting, IN2=speaker (loa ru), IN3=ventilation, IN4=heating
export interface RelayStates { misting: boolean; speaker: boolean; ventilation: boolean; heating: boolean }
export type RelayName = keyof RelayStates

export interface SensorNode {
  _id: string; device_id: string; zone_id: string
  firmware_version: string; last_heartbeat?: string
  status: DeviceStatus; rssi?: number; control_mode: ControlMode
  relay_states: RelayStates
  override_expiry?: string
  speaker_schedule: { enabled: boolean; windows: Array<{ start: string; end: string }> }
  audio: { current_track: number; volume: number; playing: boolean; loop: boolean }
  registered_at: string
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
  _id: string; device_id: string; zone_id: string; rtsp_url?: string
  status: DeviceStatus; last_heartbeat?: string; model_version?: string; registered_at: string
}

// OPS-NFR-004 — GET /devices/system-status (chỉ Admin)
export interface SystemNodeStatusItem {
  _id: string; device_id: string; type: 'sensor' | 'camera'; status: DeviceStatus
  last_heartbeat?: string; rssi?: number
  farm_name: string; house_name: string; zone_name: string
}
export interface SystemNodeStatus {
  summary: { total: number; online: number; offline: number; pending: number; error: number; degraded: number }
  nodes: SystemNodeStatusItem[]
}
