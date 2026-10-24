/**
 * SwiftletCare Backend – Domain Type Definitions
 * Shared enums and interfaces across models, services, and controllers.
 */

// ── Domain Enums ───────────────────────────────────────────────────────────────
// SRS AUTH-FR-004 (v2.0.0). DOMAIN_EXPERT = chuyên gia nuôi yến do Primary Owner mời,
// phạm vi luôn là cả farm: chỉ đọc dữ liệu vận hành, kiểm chứng cảnh báo suy luận,
// chỉnh ngưỡng/hệ số/tham số phát hiện — không relay, ticket hay ghi thu hoạch (mục 4.4).
export type Role         = 'ADMIN' | 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'TECHNICIAN'
/** Vai trò phía khách hàng có thể là thành viên farm (`farms.members[].role`, `invitations.invited_role`) */
export type FarmMemberRole = Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT'>
// PENDING: Technician đã tạo record qua Web Console Onboarding nhưng thiết bị
// chưa gửi heartbeat đầu tiên (SRS §8.2, Flow 1 bước 4).
export type DeviceStatus = 'PENDING' | 'ONLINE' | 'OFFLINE' | 'ERROR' | 'DEGRADED'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AlertStatus  = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH' | 'PREDATOR_DETECTED' | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'  | 'PUMP_DRY'          | 'NOISE_ANOMALY' // THREAT-FR-007 (v2.0.0, trước là BIRD_PANIC)
  | 'POWER_OUTAGE'     | 'LOW_RETURN_RATE'   | 'EDGE_AI_DEGRADED'
  | 'SENSOR_FAULT'     | 'RS485_BUS_FAILURE' // THREAT-FR-013
  | 'SENSOR_ANOMALY'   | 'FORECAST_BREACH'   // v1.24.0 — ALERT-FR-010/011
  | 'MAINTENANCE_DUE'                       // ALERT-FR-016 (thay ticket bảo trì)
/** EXPERT-FR-003 — kết quả Domain Expert kiểm chứng 1 cảnh báo suy luận */
export type AlertVerdictResult = 'CONFIRMED' | 'REJECTED'
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
export type HarvestStatus = 'DRAFT' | 'ARCHIVED'

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
  /** ALERT-FR-013 — chỉ có tác dụng khi tài khoản đã liên kết bot Telegram */
  telegram: boolean
  zalo: boolean
  sms: boolean
  quiet_hours: { start: string; end: string }
}

/** TICKET-FR-006, SLA-NFR-001 — SLA theo mức ưu tiên, Admin cấu hình được */
export interface SlaLevel {
  response_hours: number
  resolve_hours: number
}
export type SlaConfig = Record<TicketPriority, SlaLevel>

export interface Thresholds {
  temp_min: number
  temp_max: number
  humidity_min: number
  humidity_max: number
  light_max: number
  nh3_max: number // ENV-FR-006, ENV-FR-011 (ES-NH3-01)
  co2_max: number
}

// Guide v3.3 §8-9: relay IN1=misting, IN2=speaker (loa ru), IN3=ventilation.
// IN4 để dự phòng — SRS v2.0.0 bỏ sưởi (ENV-FR-012). Không có kênh "light".
export interface RelayStates {
  misting: boolean
  speaker: boolean
  ventilation: boolean
}

// ENV-FR-010/011 (v1.24.0): % công suất 0-100 do bộ điều khiển mờ trên ESP32
// tính (= tỉ lệ thời gian BẬT relay trong cửa sổ 2 phút). Chỉ đi kèm telemetry,
// không lưu DB. Firmware < 1.1.0 không gửi.
export interface ControlOutput {
  misting: number
  ventilation: number
}

// ENV-FR-021 (v1.24.0): 4 hệ số bộ điều khiển mờ theo Zone, gửi xuống ESP32 qua
// config/update — tên field = tên key MQTT (firmware Config::update()).
export interface FuzzyTuning {
  fuzzy_humidity_band: number  // %RH — độ rộng vùng chuyển tiếp độ ẩm
  fuzzy_temp_band: number      // °C — độ rộng vùng "nóng"
  fuzzy_fan_dry_level: number  // % — mức quạt khi nóng mà khô
  fuzzy_window_sec: number     // s — cửa sổ time-proportioning
  fuzzy_input_filter: boolean  // ENV-FR-022 — lọc median+Kalman đầu vào bộ mờ (tắt để so sánh A/B)
}

// EXPERT-FR-008 (v2.1.0): tham số phát hiện theo Zone do Domain Expert chỉnh, gửi xuống
// ESP32 qua config/update (tên field = tên key MQTT). Mặc định + khoảng hợp lệ:
// utils/detectionTuning.util.ts.
export interface DetectionTuning {
  noise_margin_db: number        // dB — ồn cao hơn mức nền của giờ đó bao nhiêu thì tính
  noise_min_sec: number          // s — số giây ồn trong cửa sổ 15 giây
  pump_dry_on_sec: number        // s — thời gian bơm BẬT cộng dồn trước khi xét
  pump_dry_min_rise_pct: number  // %RH — độ ẩm phải tăng tối thiểu
  speaker_drop_pct: number       // % — mức âm giảm so với nền thì coi là hỏng loa
}

// EXPERT-FR-008 (v2.1.8): tham số đếm chim theo House (chim ra vào ở cửa của cả nhà, không
// theo Zone) do Domain Expert chỉnh, backend dùng
export interface BirdCountTuning {
  return_rate_drop_pct: number   // % — tỷ lệ chim về giảm so với trung bình kỳ trước
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
  control_output?: ControlOutput
  timestamp: number   // Unix ms
}

export interface HeartbeatPayload {
  deviceId: string
  firmwareVersion: string
  rssi: number
  freeHeap: number
  uptime: number
  timestamp: number
  /** true ở heartbeat đầu tiên sau mỗi lần ESP32 (re)connect MQTT — backend đẩy lại config/update */
  justConnected?: boolean
  /** FARM-FR-006 — firmware ≥ 1.4.0: lý do lần khởi động gần nhất (POWERON, BROWNOUT, TASK_WDT…) và IP LAN */
  resetReason?: string
  ip?: string
}

/** VISION-FR-018 — vòng đếm quanh lỗ ra vào, các đỉnh (x, y) theo tỉ lệ khung hình 0–1 */
export interface CountingRing {
  points: Array<[number, number]>
  into_ring_is_exit: boolean
}

export interface RelayStatusPayload {
  deviceId: string
  relay_states: RelayStates
  control_mode: ControlMode
  override_expiry?: number
}

/**
 * `vision/bird-count` của nút AI (docs/bird-counting-plan.md §6.6). Hai loại tin trên cùng topic:
 * tin của phiên (có `session_type`, số cộng dồn của phiên, gửi mỗi 30 giây) và tin `kind: 'BUCKET'`
 * (số của 1 khoảng 5 phút, VISION-FR-017). `return_rate` do backend tự tính (VISION-FR-009).
 */
export interface BirdCountPayload {
  deviceId: string
  kind?: 'BUCKET'
  session_type?: SessionType
  entry_count: number
  exit_count: number
  /** Bỏ qua nếu nút AI gửi — backend tính cho cả House trên số ròng */
  return_rate?: number
  confidence_avg?: number
  /** Tin cuối của phiên — chỉ để tham khảo, job LOW_RETURN_RATE không dựa vào nó */
  final?: boolean
  /** epoch ms, đầu khoảng của tin BUCKET */
  bucket_start?: number
  bucket_minutes?: number
  timestamp?: number
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
  controlOutput?: ControlOutput
  timestamp: string
}

export interface WsRelayUpdate {
  zoneId: string
  relayName: keyof RelayStates
  state: boolean
  mode: ControlMode
  overrideExpiry?: string
}

/**
 * VISION-FR-012 — số của **cả House** (cộng mọi camera của nhà) cho phiên vừa có tin, phát vào room
 * `house:<houseId>`, cùng con số với `GET /analytics/bird-count/current` (birdCount.service#houseDailyCounts).
 */
export interface WsBirdCountUpdate {
  houseId: string
  /** 'YYYY-MM-DD' giờ Việt Nam */
  sessionDate: string
  sessionType: SessionType
  /** Số thô của phiên, cộng mọi camera của House */
  entryCount: number
  exitCount: number
  /** Số ròng của phiên: ra − vào (sáng) hoặc vào − ra (chiều), không âm */
  netCount: number
  /** % chim về trong ngày; null khi chưa có phiên sáng hoặc phiên sáng không có chim ra */
  returnRate: number | null
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
