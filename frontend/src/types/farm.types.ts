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

export interface Zone {
  _id: string; house_id: string; name: string; floor: number
  thresholds: Thresholds
}
