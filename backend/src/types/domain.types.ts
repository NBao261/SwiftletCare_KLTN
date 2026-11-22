// DOMAIN_EXPERT: cả farm, không điều khiển relay. FARM_TECHNICIAN: chỉ nhà được giao
export type Role         = 'ADMIN' | 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'FARM_TECHNICIAN'
export type FarmMemberRole = Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'FARM_TECHNICIAN'>
// PENDING: đã đăng ký, chưa có heartbeat đầu tiên
export type DeviceStatus = 'PENDING' | 'ONLINE' | 'OFFLINE'
export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
// DISMISSED: Domain Expert bác bỏ cảnh báo suy luận
export type AlertStatus  = 'ACTIVE' | 'ACKNOWLEDGED' | 'DISMISSED' | 'RESOLVED'
export type AlertType =
  | 'THRESHOLD_BREACH' | 'NODE_OFFLINE'
  | 'SPEAKER_FAILURE'  | 'MISTING_INEFFECTIVE'
  | 'NOISE_ANOMALY'
  | 'UNEXPECTED_RESTART'
  | 'LOW_RETURN_RATE'  | 'EDGE_AI_DEGRADED'
  | 'SENSOR_FAULT'     | 'RS485_BUS_FAILURE'
  | 'SENSOR_ANOMALY'   | 'FORECAST_BREACH'
  | 'MAINTENANCE_DUE'
  | 'ACTUATOR_FAULT'
  | 'CONFIG_MISMATCH'                         // backend tự tính
export type AlertVerdictResult = 'CONFIRMED' | 'REJECTED'
export type SessionType  = 'MORNING_EXIT' | 'EVENING_ENTRY'
export type ControlMode  = 'AUTO' | 'MANUAL'
export type ConfigSyncState = 'PENDING' | 'APPLIED' | 'MISMATCH' | 'UNKNOWN'


export type NestType = 'RAW' | 'CLEANED' | 'PREMIUM'
// Lô của Farm Technician chờ Farm Owner xác nhận
export type HarvestStatus = 'DRAFT' | 'CONFIRMED'

export interface JwtAccessPayload {
  sub: string
  role: Role
  iat: number
  exp: number
}

export interface CurrentUser {
  _id: string
  email: string
  role: Role
}

// Trường không có thì theo cài đặt chung
export interface ChannelChoice {
  push?: boolean
  telegram?: boolean
}

export interface NotificationPreferences {
  push: boolean
  // Chỉ có tác dụng khi đã liên kết bot Telegram
  telegram: boolean
  // Ghi đè push/telegram theo mức cảnh báo
  by_severity?: Partial<Record<AlertSeverity, ChannelChoice>>
  quiet_hours: { start: string; end: string }
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

// IN1 misting, IN2 speaker, IN3 ventilation, IN4 dự phòng
export interface RelayStates {
  misting: boolean
  speaker: boolean
  ventilation: boolean
}

// % công suất 0-100 do bộ mờ trên ESP32 tính; chỉ đi kèm telemetry, không lưu
export interface ControlOutput {
  misting: number
  ventilation: number
}

// Tên field = key MQTT (firmware Config::update())
export interface FuzzyTuning {
  fuzzy_humidity_band: number  // %RH
  fuzzy_temp_band: number      // °C
  fuzzy_fan_dry_level: number  // %
  fuzzy_window_sec: number     // s
  fuzzy_input_filter: boolean  // lọc median+Kalman đầu vào
}

// tên field = key MQTT; mặc định và khoảng: utils/detectionTuning.util.ts
export interface DetectionTuning {
  noise_margin_db: number        // dB trên mức nền của giờ đó
  noise_min_sec: number          // s trong cửa sổ 15 s
  pump_dry_on_sec: number        // s bơm BẬT cộng dồn
  pump_dry_min_rise_pct: number  // %RH
  speaker_drop_pct: number       // % giảm so với nền
}

// Theo House: chim ra vào ở cửa của cả nhà
export interface BirdCountTuning {
  return_rate_drop_pct: number   // % giảm so với trung bình kỳ trước
}

// mức đàn chim lấy từ BirdCountTuning.return_rate_drop_pct
export interface HealthLevels {
  in_range_slight_pct: number    // % thời gian trong ngưỡng, dưới là SLIGHT
  in_range_clear_pct: number     // dưới là CLEAR
  air_slight_h: number           // giờ vượt ngưỡng NH3/CO2, từ đây là SLIGHT
  air_clear_h: number            // từ đây là CLEAR
  noise_slight: number           // số đợt NOISE_ANOMALY, từ đây là SLIGHT
  noise_clear: number            // từ đây là CLEAR
}

export type HealthLevel = 'NORMAL' | 'SLIGHT' | 'CLEAR'
export type HealthStatus = 'GOOD' | 'WATCH' | 'ACTION' | 'INSUFFICIENT_DATA'
export type HealthRatingValue = Exclude<HealthStatus, 'INSUFFICIENT_DATA'>
export type HealthSource = 'environment' | 'air' | 'flock' | 'noise'
// suy ra, không lưu
export type HealthRatingState = 'PENDING' | 'RATED' | 'SKIPPED' | 'EXPIRED'

export type HealthReasonCode =
  | 'ALL_NORMAL' | 'MISSING_DATA' | 'NOT_ASSESSED' | 'ENV_IN_RANGE' | 'AIR_OVER_LIMIT'
  | 'FLOCK_DROP' | 'FLOCK_NO_BASELINE' | 'NOISE_EPISODES' | 'WEATHER_UNAVAILABLE' | 'RAIN_DOWNGRADE'
  | 'ATTRACTING_STAGE'
// ATTRACTING thì không đánh giá đàn chim
export type HouseStage = 'ATTRACTING' | 'OCCUPIED'

// Mã + số, không phải câu: client tự dịch, ảnh chụp không phụ thuộc ngôn ngữ
export interface HealthReason {
  code: HealthReasonCode
  source: HealthSource | null
  level: Exclude<HealthLevel, 'NORMAL'> | null
  values: Record<string, unknown>
}

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
  // A; không đo dòng thì không gửi
  pump_current_a?: number
  fan_current_a?: number
  timestamp: number
  // Handler gắn theo topic
  buffered?: boolean
}

export interface HeartbeatPayload {
  deviceId: string
  firmwareVersion: string
  rssi: number
  freeHeap: number
  uptime: number
  timestamp: number
  // Heartbeat đầu sau mỗi lần reconnect: backend đẩy lại config
  justConnected?: boolean
  // firmware >= 1.4.0
  resetReason?: string
  ip?: string
  // firmware >= 2.1.0; thiếu = UNKNOWN
  appliedConfigVersion?: number
  // dòng bình thường đã học (A)
  actuatorBaseline?: { misting?: number; ventilation?: number }
  modelVersion?: string
  fps?: number
}

// Tỉ lệ khung hình 0–1
export interface CountingRing {
  points: Array<[number, number]>
  into_ring_is_exit: boolean
}

export interface RelayStatusPayload {
  deviceId: string
  relay_states: RelayStates
  control_mode: ControlMode
  override_expiry?: number
  relays?: Partial<Record<keyof RelayStates, { mode: ControlMode; remaining_ms?: number }>>
}

// Tin phiên (có session_type, cộng dồn) hoặc kind 'BUCKET' (5 phút)
export interface BirdCountPayload {
  deviceId: string
  kind?: 'BUCKET'
  session_type?: SessionType
  entry_count: number
  exit_count: number
  // Bỏ qua: backend tự tính trên số ròng
  return_rate?: number
  confidence_avg?: number
  // Chỉ tham khảo, job LOW_RETURN_RATE không dựa vào
  final?: boolean
  // epoch ms
  bucket_start?: number
  bucket_minutes?: number
  timestamp?: number
}

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

// Số của cả House, cùng con số với GET /analytics/bird-count/current
export interface WsBirdCountUpdate {
  houseId: string
  // Giờ Việt Nam
  sessionDate: string
  sessionType: SessionType
  entryCount: number
  exitCount: number
  // ra − vào (sáng) hoặc vào − ra (chiều), không âm
  netCount: number
  // null khi chưa có phiên sáng hoặc sáng không có chim ra
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

export interface PaginationQuery {
  page?: string
  limit?: string
}
