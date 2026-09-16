/**
 * SwiftletCare Backend – Domain Type Definitions
 * Shared enums and interfaces across models, services, and controllers.
 */

// ── Domain Enums ───────────────────────────────────────────────────────────────
// SRS AUTH-FR-004: Buyer đăng ký qua OTP nằm cùng collection `users` nhưng
// role = null vì không tham gia RBAC (không có endpoint nào chặn theo role Buyer).
export type Role         = 'ADMIN' | 'FARM_OWNER' | 'TECHNICIAN' | 'SALES_STAFF'
// PENDING: Technician đã tạo record qua Web Console Onboarding nhưng thiết bị
// chưa gửi heartbeat đầu tiên (SRS §8.2, Flow 1 bước 4).
export type DeviceStatus = 'PENDING' | 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DEGRADED'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertStatus  = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH' | 'PREDATOR_DETECTED' | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'  | 'PUMP_DRY'          | 'BIRD_PANIC'
  | 'POWER_OUTAGE'     | 'LOW_RETURN_RATE'   | 'EDGE_AI_DEGRADED'
  | 'SENSOR_FAULT'     | 'RS485_BUS_FAILURE' // THREAT-FR-013
export type SessionType  = 'MORNING_EXIT' | 'EVENING_ENTRY'
export type ControlMode  = 'AUTO' | 'MANUAL'

// ── Module TICKET (§5.9, §8.2) ───────────────────────────────────────────────
export type TicketType =
  | 'SENSOR_FAULT' | 'RS485_BUS_FAILURE' | 'ACTUATOR_FAILURE' | 'NODE_OFFLINE'
  | 'EDGE_AI_DEGRADED' | 'POWER_OUTAGE' | 'SPEAKER_FAILURE' | 'PREDATOR_DETECTED'
  | 'INSTALLATION' | 'MAINTENANCE' | 'OTHER'
export type TicketPriority = 'P1' | 'P2' | 'P3'
export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'AWAITING_FIELD_CONFIRMATION' | 'CLOSED'

// ── Module MARKET (§5.8, §8.2) ───────────────────────────────────────────────
export type NestType = 'RAW' | 'CLEANED' | 'PREMIUM'
export type HarvestStatus = 'DRAFT' | 'LISTED' | 'ARCHIVED'
export type ListingStatus = 'AVAILABLE' | 'SOLD' | 'HIDDEN'

// ── Module SALES — Giai đoạn 2 (§5.10, §8.2) ─────────────────────────────────
export type ProductReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
export type ProductListingStatus = 'ACTIVE' | 'OUT_OF_STOCK' | 'HIDDEN'
export type OrderStatus =
  | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PACKED' | 'SHIPPING'
  | 'DELIVERED' | 'DELIVERY_FAILED' | 'CANCELLED'
export type PaymentMethod = 'COD' | 'VNPAY' | 'MOMO' | 'ZALOPAY'
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED'
export type ReturnStatus =
  | 'SUBMITTED' | 'UNDER_VERIFICATION' | 'APPROVED_REFUND'
  | 'APPROVED_EXCHANGE' | 'REJECTED'

// ── JWT Payload ────────────────────────────────────────────────────────────────
export interface JwtAccessPayload {
  sub: string   // User._id
  role: Role
  iat: number
  exp: number
}

/**
 * Người dùng đang đăng nhập, rút gọn từ req.user để truyền xuống tầng service.
 * `assigned_regions` chỉ có ý nghĩa khi role=TECHNICIAN — dùng để giới hạn
 * Technician chỉ thao tác được trên Farm thuộc khu vực mình phụ trách
 * (SRS AUTH-FR-005c, RACI mục 4.4 ghi chú ¹).
 */
export interface CurrentUser {
  _id: string
  email: string
  role: Role
  assigned_regions?: string[]
}

// ── Sub-document interfaces ────────────────────────────────────────────────────
export interface NotificationPreferences {
  push: boolean
  zalo: boolean
  sms: boolean
  quiet_hours: { start: string; end: string }
}

export interface Thresholds {
  temp_min: number
  temp_max: number
  humidity_min: number
  humidity_max: number
  light_max: number
  nh3_max: number // ENV-FR-006, ENV-FR-011 (ES-NH3-01)
  co2_max: number
}

// Guide v3.3 §8-9: relay IN1=misting, IN2=speaker (loa ru), IN3=ventilation,
// IN4=heating (dự phòng). Không có kênh "light" trên phần cứng thật.
export interface RelayStates {
  misting: boolean
  speaker: boolean
  ventilation: boolean
  heating: boolean
}

// ── MQTT Message Payloads ──────────────────────────────────────────────────────
export interface TelemetryPayload {
  deviceId: string
  temperature: number
  humidity: number
  light_lux: number
  nh3_ppm: number
  co2_ppm: number
  sound_db: number
  relay_states: RelayStates
  control_mode: ControlMode
  timestamp: number   // Unix ms
}

export interface HeartbeatPayload {
  deviceId: string
  firmwareVersion: string
  rssi: number
  freeHeap: number
  uptime: number
  timestamp: number
}

export interface RelayStatusPayload {
  deviceId: string
  relay_states: RelayStates
  control_mode: ControlMode
  override_expiry?: number
}

export interface BirdCountPayload {
  deviceId: string
  session_type: SessionType
  entry_count: number
  exit_count: number
  return_rate: number
  confidence_avg: number
  timestamp: number
}

export interface VisionAlertPayload {
  deviceId: string
  type: 'PREDATOR_DETECTED'
  class: 'rat' | 'snake' | 'owl'
  severity: AlertSeverity
  confidence: number
  snapshotUrl?: string
  timestamp: number
}

// ── WebSocket Event Payloads (§9.3) ───────────────────────────────────────────
export interface WsTelemetryUpdate {
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

export interface WsRelayUpdate {
  zoneId: string
  relayName: keyof RelayStates
  state: boolean
  mode: ControlMode
  overrideExpiry?: string
}

export interface WsBirdCountUpdate {
  zoneId: string
  entryCount: number
  exitCount: number
  returnRate: number
  sessionType: SessionType
  timestamp: string
}

export interface WsDeviceStatusChange {
  nodeId: string
  status: DeviceStatus
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

// ── API Response Wrappers ──────────────────────────────────────────────────────
export interface ApiSuccess<T = unknown> {
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

export interface ApiError {
  error: string
  details?: string | Record<string, unknown>
  code?: string
}

// ── Pagination Query Params ────────────────────────────────────────────────────
export interface PaginationQuery {
  page?: string
  limit?: string
}
