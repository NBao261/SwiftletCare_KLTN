/**
 * SwiftletCare Mobile – Domain Types (mirror backend/src/types/domain.ts)
 * SRS §8.2
 */

// ── Enums ──────────────────────────────────────────────────────────────────────
// SRS v1.7.0: OPERATOR gộp vào FARM_OWNER; TECHNICIAN/SALES_STAFF là 2 role mới.
// 'OPERATOR' giữ lại để tương thích ngược, không dùng cho code mới.
export type Role         = 'ADMIN' | 'FARM_OWNER' | 'OPERATOR' | 'TECHNICIAN' | 'SALES_STAFF'
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DEGRADED'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertStatus  = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH' | 'PREDATOR_DETECTED' | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'  | 'PUMP_DRY'          | 'BIRD_PANIC'
  | 'POWER_OUTAGE'     | 'LOW_RETURN_RATE'   | 'EDGE_AI_DEGRADED'
  | 'SENSOR_FAULT'     | 'RS485_BUS_FAILURE'
export type SessionType  = 'MORNING_EXIT' | 'EVENING_ENTRY'
export type ControlMode  = 'AUTO' | 'MANUAL'

// Module TICKET (§5.9)
export type TicketType =
  | 'SENSOR_FAULT' | 'RS485_BUS_FAILURE' | 'ACTUATOR_FAILURE' | 'NODE_OFFLINE'
  | 'EDGE_AI_DEGRADED' | 'POWER_OUTAGE' | 'SPEAKER_FAILURE' | 'PREDATOR_DETECTED'
  | 'INSTALLATION' | 'MAINTENANCE' | 'OTHER'
export type TicketPriority = 'P1' | 'P2' | 'P3'
export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'AWAITING_FIELD_CONFIRMATION' | 'CLOSED'

// ── Entities ───────────────────────────────────────────────────────────────────
export interface User {
  _id: string
  email: string
  phone?: string
  full_name: string
  role: Role
  avatar_url?: string
  is_active: boolean
  notification_preferences: NotificationPreferences
  created_at: string
}

export interface NotificationPreferences {
  push: boolean
  zalo: boolean
  sms: boolean
  quiet_hours: { start: string; end: string }
}

export interface Farm {
  _id: string
  name: string
  address: string
  coordinates?: { lat: number; lng: number }
  owner_id: string
  members: FarmMember[]
  created_at: string
}

export interface FarmMember {
  user_id: string
  role: 'OPERATOR'
  joined_at: string
}

export interface House {
  _id: string
  farm_id: string
  name: string
  floors: number
  description?: string
}

export interface Zone {
  _id: string
  house_id: string
  name: string
  floor: number
  thresholds: Thresholds
}

export interface Thresholds {
  temp_min: number
  temp_max: number
  humidity_min: number
  humidity_max: number
  light_max: number
  nh3_max: number
  co2_max: number
}

// Guide v3.3 §8-9: relay IN1=misting, IN2=speaker (loa ru), IN3=ventilation, IN4=heating
export interface RelayStates {
  misting: boolean
  speaker: boolean
  ventilation: boolean
  heating: boolean
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

export interface CameraNode {
  _id: string
  device_id: string
  zone_id: string
  rtsp_url?: string
  status: DeviceStatus
  last_heartbeat?: string
  model_version?: string
}

export interface TelemetryRecord {
  _id: string
  node_id: string
  zone_id: string
  timestamp: string
  temperature?: number
  humidity?: number
  light_lux?: number
  nh3_ppm?: number
  co2_ppm?: number
  sound_db?: number
  is_anomaly: boolean
}

// Module TICKET (§5.9, §8.2)
export interface Ticket {
  _id: string
  farm_id: string
  zone_id?: string
  alert_id?: string
  type: TicketType
  priority: TicketPriority
  status: TicketStatus
  assigned_to?: string
  sla_response_due_at?: string
  sla_resolve_due_at?: string
  is_sla_breached: boolean
  notes: Array<{ author_id: string; content: string; created_at: string }>
  satisfaction_rating?: number
  created_at: string
  closed_at?: string
}

export interface Alert {
  _id: string
  farm_id: string
  zone_id?: string
  node_id?: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  snapshot_url?: string
  metadata?: Record<string, unknown>
  status: AlertStatus
  created_at: string
  acknowledged_at?: string
  acknowledged_by?: string
  acknowledgement_note?: string
}

export interface BirdCountRecord {
  _id: string
  camera_node_id: string
  zone_id: string
  timestamp: string
  session_type: SessionType
  entry_count: number
  exit_count: number
  return_rate: number
  confidence_avg?: number
}

// ── WebSocket Events (§9.3) ────────────────────────────────────────────────────
export interface WsTelemetryUpdate {
  zoneId: string
  temperature: number
  humidity: number
  light: number
  co2: number
  sound: number
  relayStates: RelayStates
  controlMode: ControlMode
  timestamp: string
}

export interface WsAlertNew {
  alertId: string
  severity: AlertSeverity
  type: AlertType
  title: string
  message: string
  snapshotUrl?: string
}

export interface WsBirdCountUpdate {
  zoneId: string
  entryCount: number
  exitCount: number
  returnRate: number
  sessionType: SessionType
  timestamp: string
}

export interface WsRelayUpdate {
  zoneId: string
  relayName: keyof RelayStates
  state: boolean
  mode: ControlMode
  overrideExpiry?: string
}

// ── API Response ───────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  data: T
  meta?: { page?: number; limit?: number; total?: number }
}

export interface ApiError {
  error: string
  details?: string | Record<string, unknown>
  code?: string
}

// ── Auth ────────────────────────────────────────────────────────────────────────
export interface LoginResponse {
  accessToken: string
  user: User
}

// ── Navigation Params ──────────────────────────────────────────────────────────
export interface FarmDetailParams { farmId: string }
export interface ZoneDetailParams { zoneId: string }
export interface DeviceDetailParams { deviceId: string }
export interface AlertDetailParams { alertId: string }
export interface TicketDetailParams { ticketId: string }
