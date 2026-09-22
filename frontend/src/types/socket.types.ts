// Payload sự kiện WebSocket (§9.3) — khớp các emit*() bên backend socket/index.ts.

import type { ControlMode, DeviceStatus, RelayName, RelayStates } from '@/types/device.types'
import type { AlertSeverity, AlertType } from '@/types/alert.types'
import type { SessionType } from '@/types/vision.types'

// ── WebSocket Event Payloads (§9.3) ───────────────────────────────────────────
export interface TelemetryUpdateEvent {
  zoneId: string; temperature: number; humidity: number
  light: number; nh3: number; co2: number; sound: number
  relayStates: RelayStates; controlMode: ControlMode; timestamp: string
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
