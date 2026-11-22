// Module FARM: Farm > House > Zone và ngưỡng môi trường của Zone.
import type { HouseStage } from '@/types/expert/profile.types'

export interface Farm {
  _id: string; name: string; address: string
  // bắt buộc khi tạo farm; farm cũ có thể chưa có (khi đó không có thời tiết)
  coordinates?: Coordinates
  owner_id: string
  // Chỉ có ở GET /farms/:id (đã populate tên/email, xem farm.service.ts getFarm)
  owner?: { full_name?: string; email?: string }
  // role: FARM_OWNER = đồng sở hữu, DOMAIN_EXPERT = chuyên gia; member cũ không có field → đồng sở hữu
  members: Array<{ user_id: string; is_primary: boolean; joined_at: string; full_name?: string; email?: string; role?: FarmMemberRole }>
  // Chỉ có ở GET /farms: có ít nhất một Domain Expert còn hoạt động (chuyên gia bị khoá không tính); false thì Farm Owner làm thay
  has_active_expert?: boolean
  is_deleted: boolean
  created_at: string
}

// Vai trò thành viên farm (POST /farms/:id/members): thêm FARM_TECHNICIAN: thợ được Farm Owner gán vào nhà cụ thể (backend f9d9522)
export type FarmMemberRole = 'FARM_OWNER' | 'DOMAIN_EXPERT' | 'FARM_TECHNICIAN'

// Vị trí farm: một farm là một địa điểm
export interface Coordinates { lat: number; lng: number }

// tham số đếm chim theo nhà, Domain Expert chỉnh
export interface BirdCountTuning { return_rate_drop_pct?: number }

export interface House {
  _id: string; farm_id: string; name: string; floors: number; description?: string
  bird_count_tuning?: BirdCountTuning
  // danh sách thợ được Farm Owner gán vào nhà này (Nhi thực hiện UI gán, backend f9d9522)
  technicians?: Array<{ user_id: string; primary: boolean }>
  // giai đoạn nhà; nhà tạo trước khi có trường này coi là OCCUPIED
  stage?: HouseStage
  stage_history?: Array<{ stage: HouseStage; changed_by?: string; changed_by_role?: string; changed_at: string }>
  // chỉ Farm Technician nhận: các ca trực của chính mình ở nhà này
  roster?: RosterShift[]
}

// một ca trực của nhà: 0 = Chủ nhật … 6 = thứ Bảy, giờ VN HH:mm, end trước start là ca qua nửa đêm
export interface RosterShift {
  technician_id: string
  role: 'PRIMARY' | 'BACKUP'
  weekdays: number[]
  start: string
  end: string
}

// tham số phát hiện theo Zone, Domain Expert chỉnh, gửi xuống ESP32
export interface DetectionTuning {
  noise_margin_db?: number; noise_min_sec?: number
  pump_dry_on_sec?: number; pump_dry_min_rise_pct?: number
  speaker_drop_pct?: number
}

export interface Thresholds {
  temp_min: number; temp_max: number
  humidity_min: number; humidity_max: number
  light_max: number; nh3_max: number; co2_max: number
}

// 4 hệ số bộ điều khiển mờ trên ESP32 (khớp backend `FuzzyTuning`, key MQTT config/update)
export interface FuzzyTuning {
  fuzzy_humidity_band: number  // %RH
  fuzzy_temp_band: number      // °C
  fuzzy_fan_dry_level: number  // %
  fuzzy_window_sec: number     // giây
  fuzzy_input_filter: boolean  // lọc nhiễu đầu vào bộ mờ (tắt để so sánh A/B)
}

// 4 hệ số dạng số (nhập bằng ô số, có khoảng hợp lệ)
export type FuzzyNumericKey = Exclude<keyof FuzzyTuning, 'fuzzy_input_filter'>

// 1 lần đổi ngưỡng của Zone
export interface ZoneThresholdHistoryEntry {
  changed_by?: string; changed_at?: string
  source?: 'MANUAL' | 'RESET_TO_DEFAULT'
  changed_by_role?: string
}

export interface Zone {
  _id: string; house_id: string; name: string; floor: number
  thresholds: Thresholds
  threshold_history?: ZoneThresholdHistoryEntry[]
  detection_tuning?: DetectionTuning
  fuzzy_tuning?: FuzzyTuning
}
