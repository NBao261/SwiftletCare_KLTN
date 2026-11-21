import type { Role } from './auth.types'

// Thành viên farm: FARM_OWNER = đồng sở hữu, DOMAIN_EXPERT = chuyên gia, FARM_TECHNICIAN = kỹ thuật viên nhà yến (G-20);
// member cũ không có role → đồng sở hữu
export interface FarmMember {
  user_id: string
  is_primary: boolean
  role?: Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'FARM_TECHNICIAN'>
  joined_at: string
  // Chỉ có ở GET /farms/{id} (tên người xác nhận, người phán quyết cảnh báo)
  full_name?: string
  // Chỉ có ở GET /farms/{id} khi người xem là Farm Owner (chuyên gia không thấy email thành viên khác)
  email?: string
}

// Toạ độ GPS của farm (FARM-FR-001, A-5): vĩ độ −90…90, kinh độ −180…180
export interface Coordinates {
  lat: number
  lng: number
}

export interface Farm {
  _id: string
  name: string
  address: string
  // Bắt buộc khi tạo từ A-5; farm tạo trước đó có thể chưa có
  coordinates?: Coordinates
  owner_id: string
  // Chỉ có ở GET /farms: farm có ít nhất một Domain Expert còn hoạt động (chuyên gia bị khoá không tính, BR-22)
  has_active_expert?: boolean
  members: FarmMember[]
  created_at: string
}

// Tham số đếm chim theo nhà yến (EXPERT-FR-008) — backend dùng, không gửi thiết bị
export interface BirdCountTuning {
  return_rate_drop_pct?: number
}

// Giai đoạn nhà (FARM-FR-014, BR-46): đang dẫn dụ thì không xét chỉ số đàn, không báo LOW_RETURN_RATE
export type HouseStage = 'ATTRACTING' | 'OCCUPIED'

// Kỹ thuật viên được giao nhà (AUTH-FR-013): tối đa một người chính
export interface HouseTechnician {
  user_id: string
  primary: boolean
}

export interface House {
  _id: string
  farm_id: string
  name: string
  floors: number
  description?: string
  bird_count_tuning?: BirdCountTuning
  // Backend mặc định OCCUPIED; nhà tạo trước FARM-FR-014 có thể chưa có
  stage?: HouseStage
  technicians?: HouseTechnician[]
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

// Hệ số bộ điều khiển fuzzy của Zone (ENV-FR-021) — tên field = key MQTT config/update
export interface FuzzyTuning {
  fuzzy_humidity_band?: number
  fuzzy_temp_band?: number
  fuzzy_fan_dry_level?: number
  fuzzy_window_sec?: number
  fuzzy_input_filter?: boolean
}

// Tham số phát hiện theo Zone (EXPERT-FR-008) — chuyên gia chỉnh, gửi xuống ESP32
export interface DetectionTuning {
  noise_margin_db?: number
  noise_min_sec?: number
  pump_dry_on_sec?: number
  pump_dry_min_rise_pct?: number
  speaker_drop_pct?: number
}

// Một lần đổi hệ số fuzzy của zone (Zone.fuzzy_tuning_history trong api-spec); changed_by là id, không có tên
export interface FuzzyTuningHistoryEntry {
  changed_by: string
  changed_by_role?: Role
  changed_at: string
  old_values: Partial<FuzzyTuning>
  new_values: Partial<FuzzyTuning>
}

export interface Zone {
  _id: string
  house_id: string
  name: string
  floor: number
  thresholds: Thresholds
  fuzzy_tuning?: FuzzyTuning
  fuzzy_tuning_history?: FuzzyTuningHistoryEntry[]
  detection_tuning?: DetectionTuning
}

// Body tạo farm (POST /farms): cả 3 trường bắt buộc
export interface CreateFarmPayload {
  name: string
  address: string
  coordinates: Coordinates
}

// Body sửa farm (PUT /farms/{id}): gửi trường nào sửa trường đó
export type UpdateFarmPayload = Partial<CreateFarmPayload>

// Body tạo nhà yến (POST /farms/{id}/houses)
export interface CreateHousePayload {
  name: string
  floors?: number
  description?: string
}

// Body tạo zone (POST /farms/houses/{houseId}/zones): ngưỡng mặc định do backend chép vào
export interface CreateZonePayload {
  name: string
  floor?: number
}

// Luật bù phun sương theo thời tiết của nhà (ENV-FR-030, BR-38): dự báo 2 giờ tới vượt ngưỡng thì cộng offset vào mức phun
export type WeatherMetric = 'temperature' | 'humidity' | 'rain'

export interface WeatherRule {
  // Có khi luật đã lưu; luật mới không gửi
  _id?: string
  metric: WeatherMetric
  // Nhiệt độ tối đa ≥ min °C, độ ẩm ngoài trời tối đa ≥ min %, tổng mưa ≥ min mm
  min: number
  // Điểm % cộng vào mức phun, −10…+10 và khác 0
  offset_pct: number
  // Thời hạn của một lần bù, 1–120 phút
  duration_min: number
  active: boolean
}

// GET /farms/houses/{houseId}/weather-rules: luật và lần bù gần nhất (null khi chưa bù lần nào)
export interface WeatherRulesView {
  house_id: string
  rules: WeatherRule[]
  last_compensation: {
    rule_id: string
    offset_pct: number
    sent_at: string
    expires_at: string
    forecast: { temperature_max: number | null; humidity_max: number | null; rain_mm: number | null }
  } | null
}

// Lịch đếm chim của nhà (VISION-FR-019, BR-13): khung giờ VN 'HH:mm', nửa mở [start, end)
export interface CountingTimeWindow {
  start: string
  end: string
}

export interface CountingDayWindows {
  morning: CountingTimeWindow
  evening: CountingTimeWindow
}

// Hồ sơ theo mùa: khoảng ngày trong năm 'MM-DD', tính cả hai đầu; from sau to là khoảng vắt qua năm mới
export interface SeasonalCountingProfile extends CountingDayWindows {
  name: string
  from: string
  to: string
}

// Khung tạm cho những ngày cụ thể 'YYYY-MM-DD', thắng hồ sơ theo mùa
export interface TemporaryCountingWindow extends CountingDayWindows {
  from: string
  to: string
}

export interface CountingSchedule {
  profiles: SeasonalCountingProfile[]
  temporary: TemporaryCountingWindow[]
}

export type CountingWindowSource = 'TEMPORARY' | 'PROFILE' | 'DEFAULT'

// GET /farms/houses/{houseId}/counting-schedule
export interface CountingScheduleView {
  house_id: string
  schedule: CountingSchedule
  // Lần sửa gần nhất áp từ ngày này; null khi chưa đặt lịch
  effective_from: string | null
  default_windows: CountingDayWindows
  // Khung đang áp hôm nay (giờ VN)
  today: CountingDayWindows & { date: string; source: CountingWindowSource }
}

// Mức của các chỉ số sức khỏe của nhà (BR-28): "nhẹ" và "rõ" của thời gian trong ngưỡng, giờ không khí vượt ngưỡng, đợt tiếng ồn
export interface HealthLevels {
  in_range_slight_pct: number
  in_range_clear_pct: number
  air_slight_h: number
  air_clear_h: number
  noise_slight: number
  noise_clear: number
}

// GET /farms/houses/{houseId}/health-levels: can_edit do backend quyết (chuyên gia, chủ trại khi farm chưa có chuyên gia — BR-22)
export interface HouseHealthLevelsView {
  house_id: string
  health_levels: HealthLevels
  defaults: HealthLevels
  can_edit: boolean
}

// Một nhà trong tổng quan farm (ANALYTICS-FR-015): trạng thái ngày hôm nay (null kèm lý do khi chưa tính hoặc thiếu dữ liệu)
export interface HouseOverview {
  house_id: string
  name: string
  stage: HouseStage
  status: 'GOOD' | 'WATCH' | 'ACTION' | null
  status_reason: 'NOT_COMPUTED' | 'INSUFFICIENT_DATA' | null
  open_alerts: number
  open_work_orders: number
  latest_return_rate: { date: string; value: number } | null
  simulated: boolean
}

// GET /farms/{id}/overview; date là ngày hôm nay giờ VN
export interface FarmOverview {
  farm_id: string
  date: string
  houses: HouseOverview[]
}
