import type { Role } from './auth.types'

// Thành viên farm: FARM_OWNER = đồng sở hữu, DOMAIN_EXPERT = chuyên gia; member cũ không có role → đồng sở hữu
export interface FarmMember {
  user_id: string
  is_primary: boolean
  role?: Extract<Role, 'FARM_OWNER' | 'DOMAIN_EXPERT'>
  joined_at: string
  // Chỉ có ở GET /farms/{id} (tên người xác nhận, người phán quyết cảnh báo)
  full_name?: string
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
  members: FarmMember[]
  created_at: string
}

// Tham số đếm chim theo nhà yến (EXPERT-FR-008) — backend dùng, không gửi thiết bị
export interface BirdCountTuning {
  return_rate_drop_pct?: number
}

export interface House {
  _id: string
  farm_id: string
  name: string
  floors: number
  description?: string
  bird_count_tuning?: BirdCountTuning
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

// Hệ số bộ điều khiển mờ của Zone (ENV-FR-021) — tên field = key MQTT config/update
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

// Một lần đổi hệ số mờ của zone (Zone.fuzzy_tuning_history trong api-spec); changed_by là id, không có tên
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
