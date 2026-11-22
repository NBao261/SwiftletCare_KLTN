// Payload sự kiện WebSocket: khớp các emit*() bên backend socket/index.ts.

import type { ControlMode, ControlOutput, DeviceStatus, RelayName, RelayStates } from '@/types/device.types'
import type { AlertSeverity, AlertType } from '@/types/alert.types'
import type { SessionType } from '@/types/vision.types'

// WebSocket Event Payloads
export interface TelemetryUpdateEvent {
  zoneId: string; temperature: number; humidity: number
  light: number; nh3: number; co2: number; sound: number
  relayStates: RelayStates; controlMode: ControlMode; controlOutput?: ControlOutput; timestamp: string
}

export interface RelayUpdateEvent {
  zoneId: string; relayName: RelayName; state: boolean; mode: ControlMode; overrideExpiry?: string
}

export interface DeviceStatusChangeEvent {
  nodeId: string; status: DeviceStatus; timestamp: string
}

export interface BirdCountUpdateEvent {
  zoneId: string; entryCount: number; exitCount: number
  sessionType: SessionType; timestamp: string
}

export interface AlertNewEvent {
  alertId: string; severity: AlertSeverity; type: AlertType
  title: string; message: string; snapshotUrl?: string
}
