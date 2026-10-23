// Module MARKET (§5.8) — chỉ còn ghi nhận lô thu hoạch (SRS v2.0.0 bỏ Marketplace).

// Module MARKET (§5.8)
export type NestType = 'RAW' | 'CLEANED' | 'PREMIUM'
// Khớp backend v2.0.0 (domain.types.ts): bỏ LISTED cùng Marketplace
export type HarvestStatus = 'DRAFT' | 'ARCHIVED'

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
  is_deleted: boolean
  created_at: string; updated_at?: string
}
