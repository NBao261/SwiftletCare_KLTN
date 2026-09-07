// SwiftletCare TypeScript Type Definitions
// Generated from SRS §8.2 MongoDB Schemas

export type Role = 'ADMIN' | 'FARM_OWNER' | 'OPERATOR'
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DEGRADED'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH' | 'PREDATOR_DETECTED' | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'  | 'PUMP_DRY'          | 'BIRD_PANIC'
  | 'POWER_OUTAGE'     | 'LOW_RETURN_RATE'   | 'EDGE_AI_DEGRADED'
export type SessionType = 'MORNING_EXIT' | 'EVENING_ENTRY'
export type ControlMode = 'AUTO' | 'MANUAL'

export interface User {
  _id: string; email: string; phone?: string; full_name: string; role: Role; avatar_url?: string
  notification_preferences: {
    push: boolean; zalo: boolean; sms: boolean
    quiet_hours: { start: string; end: string }
  }
}

export interface Farm {
  _id: string; name: string; address: string
  coordinates?: { lat: number; lng: number }
  owner_id: string; members: Array<{ user_id: string; role: 'OPERATOR'; joined_at: string }>
  created_at: string
}

export interface House { _id: string; farm_id: string; name: string; floors: number }
export interface Zone {
  _id: string; house_id: string; name: string; floor: number
  thresholds: {
    temp_min: number; temp_max: number
    humidity_min: number; humidity_max: number
    light_max: number; co2_max: number
  }
}

export interface SensorNode {
  _id: string; device_id: string; zone_id: string
  firmware_version: string; last_heartbeat: string
  status: DeviceStatus; rssi: number; control_mode: ControlMode
  relay_states: { misting: boolean; ventilation: boolean; heating: boolean; light: boolean }
  override_expiry?: string
}

export interface TelemetryRecord {
  timestamp: string; temperature: number; humidity: number
  light_lux: number; co2_ppm: number; sound_db: number; is_anomaly: boolean
}

export interface Alert {
  _id: string; farm_id: string; zone_id?: string; node_id?: string
  type: AlertType; severity: AlertSeverity; title: string; message: string
  snapshot_url?: string; metadata?: Record<string, unknown>
  status: AlertStatus; created_at: string
  acknowledged_at?: string; acknowledged_by?: string; acknowledgement_note?: string
}

export interface BirdCountRecord {
  _id: string; zone_id: string; timestamp: string
  session_type: SessionType; entry_count: number; exit_count: number
  return_rate: number; confidence_avg: number
}

// ── WebSocket Event Payloads (§9.3) ───────────────────────────────────────────
export interface TelemetryUpdateEvent {
  zoneId: string; temperature: number; humidity: number
  light: number; co2: number; sound: number; timestamp: string
}

export interface RelayUpdateEvent {
  zoneId: string; relayName: string; state: boolean; mode: ControlMode
}

export interface BirdCountUpdateEvent {
  zoneId: string; entryCount: number; exitCount: number
  sessionType: SessionType; timestamp: string
}

export interface AlertNewEvent {
  alertId: string; severity: AlertSeverity; type: AlertType
  title: string; message: string; snapshotUrl?: string
}
