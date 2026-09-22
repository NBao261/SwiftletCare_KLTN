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
