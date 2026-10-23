// Module FARM (§5.2) — Farm > House > Zone và ngưỡng môi trường của Zone.

export interface Farm {
  _id: string; name: string; address: string
  /** Khu vực (VD 'HCMC') — khớp assigned_regions của Technician phụ trách (AUTH-FR-005c) */
  region?: string
  coordinates?: { lat: number; lng: number }
  owner_id: string
  /** Chỉ có ở GET /farms/:id (đã populate tên/email, xem farm.service.ts getFarm) */
  owner?: { full_name?: string; email?: string }
  /** role: FARM_OWNER = đồng sở hữu, DOMAIN_EXPERT = chuyên gia (SRS v2.0.0); member cũ không có field → đồng sở hữu */
  members: Array<{ user_id: string; is_primary: boolean; joined_at: string; full_name?: string; email?: string; role?: FarmMemberRole }>
  is_deleted: boolean
  created_at: string
}

/** Vai trò thành viên farm (POST /farms/:id/members) */
export type FarmMemberRole = 'FARM_OWNER' | 'DOMAIN_EXPERT'

/** FARM-FR-009 — 1 tỉnh/thành trong danh mục khu vực (GET /farms/regions) */
export interface Region { code: string; name: string }

/** EXPERT-FR-008 (SRS v2.1.8) — tham số đếm chim theo nhà, Domain Expert chỉnh */
export interface BirdCountTuning { return_rate_drop_pct?: number }

export interface House {
  _id: string; farm_id: string; name: string; floors: number; description?: string
  bird_count_tuning?: BirdCountTuning
}

/** EXPERT-FR-008 — tham số phát hiện theo Zone, Domain Expert chỉnh, gửi xuống ESP32 */
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

/** ENV-FR-021 — 4 hệ số bộ điều khiển mờ trên ESP32 (khớp backend `FuzzyTuning`, key MQTT config/update) */
export interface FuzzyTuning {
  fuzzy_humidity_band: number  // %RH
  fuzzy_temp_band: number      // °C
  fuzzy_fan_dry_level: number  // %
  fuzzy_window_sec: number     // giây
  fuzzy_input_filter: boolean  // ENV-FR-022 — lọc nhiễu đầu vào bộ mờ (tắt để so sánh A/B)
}

/** 4 hệ số dạng số (nhập bằng ô số, có khoảng hợp lệ) */
export type FuzzyNumericKey = Exclude<keyof FuzzyTuning, 'fuzzy_input_filter'>

/** ENV-FR-009/020 — 1 lần đổi ngưỡng của Zone */
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
