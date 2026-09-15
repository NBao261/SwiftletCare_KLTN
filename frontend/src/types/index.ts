// SwiftletCare TypeScript Type Definitions
// Generated from SRS §8.2 MongoDB Schemas

// SRS v1.7.0: OPERATOR gộp vào FARM_OWNER; TECHNICIAN/SALES_STAFF là 2 role mới.
// 'OPERATOR' giữ lại để tương thích ngược, không dùng cho code mới.
export type Role = 'ADMIN' | 'FARM_OWNER' | 'OPERATOR' | 'TECHNICIAN' | 'SALES_STAFF'
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DEGRADED'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH' | 'PREDATOR_DETECTED' | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'  | 'PUMP_DRY'          | 'BIRD_PANIC'
  | 'POWER_OUTAGE'     | 'LOW_RETURN_RATE'   | 'EDGE_AI_DEGRADED'
  | 'SENSOR_FAULT'     | 'RS485_BUS_FAILURE'
export type SessionType = 'MORNING_EXIT' | 'EVENING_ENTRY'
export type ControlMode = 'AUTO' | 'MANUAL'

// Module TICKET (§5.9)
export type TicketType =
  | 'SENSOR_FAULT' | 'RS485_BUS_FAILURE' | 'ACTUATOR_FAILURE' | 'NODE_OFFLINE'
  | 'EDGE_AI_DEGRADED' | 'POWER_OUTAGE' | 'SPEAKER_FAILURE' | 'PREDATOR_DETECTED'
  | 'INSTALLATION' | 'MAINTENANCE' | 'OTHER'
export type TicketPriority = 'P1' | 'P2' | 'P3'
export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'AWAITING_FIELD_CONFIRMATION' | 'CLOSED'

// Module MARKET (§5.8)
export type NestType = 'RAW' | 'CLEANED' | 'PREMIUM'
export type HarvestStatus = 'DRAFT' | 'LISTED' | 'ARCHIVED'
export type ListingStatus = 'AVAILABLE' | 'SOLD' | 'HIDDEN'

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
    light_max: number; nh3_max: number; co2_max: number
  }
}

// Guide v3.3 §8-9: relay IN1=misting, IN2=speaker (loa ru), IN3=ventilation, IN4=heating
export interface SensorNode {
  _id: string; device_id: string; zone_id: string
  firmware_version: string; last_heartbeat: string
  status: DeviceStatus; rssi: number; control_mode: ControlMode
  relay_states: { misting: boolean; speaker: boolean; ventilation: boolean; heating: boolean }
  override_expiry?: string
}

export interface TelemetryRecord {
  timestamp: string; temperature: number; humidity: number
  light_lux: number; nh3_ppm: number; co2_ppm: number; sound_db: number; is_anomaly: boolean
}

// Module TICKET (§5.9, §8.2)
export interface Ticket {
  _id: string; farm_id: string; zone_id?: string; alert_id?: string
  type: TicketType; priority: TicketPriority; status: TicketStatus
  assigned_to?: string
  sla_response_due_at?: string; sla_resolve_due_at?: string; is_sla_breached: boolean
  notes: Array<{ author_id: string; content: string; created_at: string }>
  satisfaction_rating?: number
  created_at: string; closed_at?: string
}

// Module MARKET (§5.8, §8.2)
export interface HarvestBatch {
  _id: string; farm_id: string; zone_id: string; trace_code: string
  harvest_date: string; nest_count: number; weight_grams: number
  nest_type: NestType; status: HarvestStatus; created_at: string
}

export interface NestListing {
  _id: string; harvest_batch_id: string; farm_id: string
  title: string; description?: string; price_vnd?: number; price_unit: string
  listing_status: ListingStatus; view_count: number; inquiry_count: number
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
