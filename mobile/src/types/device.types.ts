export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DEGRADED'
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
}
