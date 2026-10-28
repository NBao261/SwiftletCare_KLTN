/**
 * SwiftletCare Mobile – Domain Types (mirror backend/src/types/domain.ts)
 * SRS §8.2
 */

// ── Enums ──────────────────────────────────────────────────────────────────────
// Khớp backend/src/types/domain.types.ts (Report 3 §2.3)
export type Role         = 'ADMIN' | 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'TECHNICIAN'
// PENDING: đã thêm vào kho, chưa có heartbeat đầu tiên; chỉ 3 trạng thái kết nối (Report 3 §6.6)
export type DeviceStatus = 'PENDING' | 'ONLINE' | 'OFFLINE'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
// DISMISSED: Domain Expert bác bỏ cảnh báo suy luận (EXPERT-FR-003)
export type AlertStatus  = 'ACTIVE' | 'ACKNOWLEDGED' | 'DISMISSED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH' | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'  | 'MISTING_INEFFECTIVE' // trước là PUMP_DRY
  | 'NOISE_ANOMALY'
  | 'UNEXPECTED_RESTART'                      // trước là POWER_OUTAGE
  | 'LOW_RETURN_RATE'  | 'EDGE_AI_DEGRADED'
  | 'SENSOR_FAULT'     | 'RS485_BUS_FAILURE'
  | 'SENSOR_ANOMALY'   | 'FORECAST_BREACH'
  | 'MAINTENANCE_DUE'
  | 'ACTUATOR_FAULT'   | 'CONFIG_MISMATCH'
export type SessionType  = 'MORNING_EXIT' | 'EVENING_ENTRY'
export type ControlMode  = 'AUTO' | 'MANUAL'

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
  /** ALERT-FR-013 — chỉ có tác dụng khi tài khoản đã liên kết bot Telegram */
  telegram: boolean
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
  is_primary: boolean
  /** FARM_OWNER = đồng sở hữu, DOMAIN_EXPERT = chuyên gia; member cũ không có field → đồng sở hữu */
  role?: Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT'>
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

// Relay IN1=misting, IN2=speaker (loa ru), IN3=ventilation; IN4 dự phòng (đã bỏ sưởi)
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

export interface CameraNode {
  _id: string
  device_id: string
  /** Camera đếm chim ở cửa ra vào của cả nhà yến — gắn House, không gắn Zone (backend SRS v2.1.8) */
  house_id: string
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

/** Số của cả nhà yến cho phiên vừa có tin, room house:<houseId> (JOIN_HOUSE) — cùng con số với GET /analytics/bird-count/current (backend SRS v2.1.8) */
export interface WsBirdCountUpdate {
  houseId: string
  sessionDate: string
  entryCount: number
  exitCount: number
  netCount: number
  returnRate: number | null
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
  refreshToken?: string
  user: User
}

// ── Navigation Params ──────────────────────────────────────────────────────────
export interface FarmDetailParams { farmId: string }
export interface ZoneDetailParams { zoneId: string }
export interface DeviceDetailParams { deviceId: string }
export interface AlertDetailParams { alertId: string }
