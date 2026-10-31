import type { AlertSeverity, AlertType } from './alert.types'
import type { SessionType } from './birdCount.types'
import type { ControlMode, RelayStates } from './device.types'

// Sự kiện TELEMETRY_UPDATE — số đo mới của Zone
export interface SocketTelemetryUpdate {
  zoneId: string
  temperature: number
  humidity: number
  light: number
  nh3: number
  co2: number
  sound: number
  relayStates: RelayStates
  controlMode: ControlMode
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
