import type { AlertSeverity, AlertType } from './alert.types'
import type { SessionType } from './birdCount.types'
import type { ControlMode, DeviceStatus, RelayStates } from './device.types'

// Sự kiện TELEMETRY_UPDATE — số đo mới của Zone; cảm biến hỏng thì chỉ số đó null (THREAT-FR-013)
export interface SocketTelemetryUpdate {
  zoneId: string
  temperature: number | null
  humidity: number | null
  light: number | null
  nh3: number | null
  co2: number | null
  sound: number | null
  relayStates: RelayStates
  controlMode: ControlMode
  // % phun sương và % quạt do bộ điều khiển mờ tính
  controlOutput?: { misting: number; ventilation: number }
  timestamp: string
}

// Sự kiện DEVICE_STATUS_CHANGE — controller gửi vào room zone, camera gửi vào room house
export interface SocketDeviceStatusChange {
  nodeId: string
  status: DeviceStatus
  timestamp: string
}

// Sự kiện ALERT_NEW — cảnh báo mới
export interface SocketAlertNew {
  alertId: string
  severity: AlertSeverity
  type: AlertType
  title: string
  message: string
  snapshotUrl?: string
}

// Sự kiện BIRD_COUNT_UPDATE — số của cả nhà yến cho phiên vừa có tin (room house:<houseId>, SRS v2.1.8)
export interface SocketBirdCountUpdate {
  houseId: string
  sessionDate: string
  entryCount: number
  exitCount: number
  netCount: number
  returnRate: number | null
  sessionType: SessionType
  timestamp: string
}

// Sự kiện RELAY_UPDATE — relay đổi trạng thái
export interface SocketRelayUpdate {
  zoneId: string
  relayName: keyof RelayStates
  state: boolean
  mode: ControlMode
  overrideExpiry?: string
}
