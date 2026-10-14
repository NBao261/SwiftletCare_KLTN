// Module FARM (§5.2) — Farm > House > Zone và ngưỡng môi trường của Zone.

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

export interface House { _id: string; farm_id: string; name: string; floors: number; description?: string }

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

export interface Zone {
  _id: string; house_id: string; name: string; floor: number
  thresholds: Thresholds
  fuzzy_tuning?: FuzzyTuning
}
