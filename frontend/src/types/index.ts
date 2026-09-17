// SwiftletCare TypeScript Type Definitions
// Generated from SRS §8.2 MongoDB Schemas

// SRS AUTH-FR-004: 4 role tham gia RBAC. Buyer đăng ký qua OTP không mang role
// nào (role = null) vì không truy cập endpoint nào bị chặn theo role.
export type Role = 'ADMIN' | 'FARM_OWNER' | 'TECHNICIAN' | 'SALES_STAFF'
// PENDING: Technician đã khai báo qua Web Console nhưng thiết bị chưa gửi
// heartbeat đầu tiên (SRS §8.2, Flow 1).
export type DeviceStatus = 'PENDING' | 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DEGRADED'
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
  /** AUTH-FR-012 — đã yêu cầu xoá tài khoản, chờ Administrator xử lý trong ≤30 ngày */
  deletion_requested_at?: string
}

// AUTH-FR-002/003 — request/response cho POST /auth/login, /auth/register
export interface LoginRequest { email: string; password: string }
export interface RegisterRequest { email: string; password: string; full_name: string; phone?: string }
export interface LoginResponse { accessToken: string; user: User }

export interface Farm {
  _id: string; name: string; address: string
  /** Khu vực (VD 'HCMC') — khớp assigned_regions của Technician phụ trách (AUTH-FR-005c) */
  region?: string
  coordinates?: { lat: number; lng: number }
  owner_id: string
  /** Chỉ có ở GET /farms/:id (đã populate tên/email, xem farm.service.ts getFarm) */
  owner?: { full_name?: string; email?: string }
  members: Array<{ user_id: string; is_primary: boolean; joined_at: string; full_name?: string; email?: string }>
  is_deleted: boolean
  created_at: string
}

/** AUTH-FR-010, Flow 12 — lời mời thành viên/Sales Staff, hết hạn sau 7 ngày nếu không phản hồi */
export interface Invitation {
  _id: string
  farm_id: string
  invited_email: string
  invited_role: Extract<Role, 'FARM_OWNER' | 'SALES_STAFF'>
  invited_by: string
  token: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'
  expires_at: string
  responded_at?: string
  created_at: string
}

export interface House { _id: string; farm_id: string; name: string; floors: number; description?: string }

export interface Thresholds {
  temp_min: number; temp_max: number
  humidity_min: number; humidity_max: number
  light_max: number; nh3_max: number; co2_max: number
}

export interface Zone {
  _id: string; house_id: string; name: string; floor: number
  thresholds: Thresholds
}

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

export interface TelemetryRecord {
  _id?: string; node_id?: string; zone_id?: string
  timestamp: string; temperature?: number; humidity?: number
  light_lux?: number; nh3_ppm?: number; co2_ppm?: number; sound_db?: number; is_anomaly: boolean
}

// Module TICKET (§5.9, §8.2)
export interface TicketSatChecklist {
  modbus_addresses_ok: boolean
  camera_rtsp_ok: boolean
  lte_connection_ok: boolean
  relay_test_ok: boolean
}

export interface Ticket {
  _id: string; farm_id: string; zone_id?: string; alert_id?: string; created_by?: string
  type: TicketType; priority: TicketPriority; status: TicketStatus
  assigned_to?: string | { _id: string; full_name: string; email: string }
  /** Chỉ dùng cho type=INSTALLATION/MAINTENANCE (TICKET-FR-004b) */
  scheduled_visit_at?: string
  sla_response_due_at?: string; sla_resolve_due_at?: string; is_sla_breached: boolean
  sat_checklist: TicketSatChecklist
  notes: Array<{ author_id?: string; content: string; created_at: string }>
  satisfaction_rating?: number
  created_at: string; closed_at?: string
}

// Module MARKET (§5.8, §8.2)
export interface EnvSnapshot {
  avg_temperature?: number; avg_humidity?: number; avg_light_lux?: number
  avg_nh3_ppm?: number; avg_co2_ppm?: number
  telemetry_range?: { from: string; to: string }
  /** true khi Zone chưa đủ 7 ngày dữ liệu — Traceability Card nên nói rõ, không hiện số sai lệch */
  insufficient_data?: boolean
}

export interface FlockSnapshot {
  avg_return_rate_30d?: number
  estimated_population?: number
}

export interface HarvestBatch {
  _id: string; farm_id: string; zone_id: string; created_by?: string; trace_code: string
  harvest_date: string; nest_count: number; weight_grams: number
  nest_type: NestType; product_images: string[]
  env_snapshot: EnvSnapshot; flock_snapshot: FlockSnapshot
  status: HarvestStatus
  /** Set khi đã tạo Nest Listing từ batch này (MARKET-FR-006) */
  listing_id?: string
  is_deleted: boolean
  created_at: string; updated_at?: string
}

export interface NestListing {
  _id: string; harvest_batch_id: string | HarvestBatch; farm_id: string
  title: string; description?: string; price_vnd?: number; price_unit: string
  listing_status: ListingStatus
  contact_info: { show_phone: boolean; show_email: boolean; show_zalo: boolean }
  view_count: number; inquiry_count: number
  published_at?: string
}

/** MARKET-FR-010 — Buyer gửi liên hệ tới 1 Nest Listing */
export interface ContactInquiry {
  _id: string; listing_id: string
  buyer_name: string; buyer_phone?: string; buyer_email?: string; message: string
  created_at: string
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

// ── API response envelope (§9.0) ───────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  /** `unreadCount` chỉ có ở GET /alerts (ALERT-FR-007 — số cảnh báo ACTIVE) */
  meta?: { page?: number; limit?: number; total?: number; unreadCount?: number }
  error?: { code: string; message: string }
}

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
