// Module HARVEST: chỉ còn ghi nhận lô thu hoạch (bỏ Marketplace).

// Module HARVEST
export type NestType = 'RAW' | 'CLEANED' | 'PREMIUM'
// Khớp backend (domain.types.ts): chỉ còn DRAFT, đã bỏ LISTED và ARCHIVED
export type HarvestStatus = 'DRAFT' | 'CONFIRMED'

// Module HARVEST
export interface EnvSnapshot {
  avg_temperature?: number; avg_humidity?: number; avg_light_lux?: number
  avg_nh3_ppm?: number; avg_co2_ppm?: number
  telemetry_range?: { from: string; to: string }
  // true khi Zone chưa đủ 7 ngày dữ liệu: Traceability Card nên nói rõ, không hiện số sai lệch
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
  // link ký sẵn tới ảnh của lô; chỉ có ở GET /harvests/{id} và PUT /harvests/{id}/photo
  photo_url?: string | null
  env_snapshot: EnvSnapshot; flock_snapshot: FlockSnapshot
  status: HarvestStatus
  is_deleted: boolean
  created_at: string; updated_at?: string
}

// Chu kỳ thu hoạch
export type HarvestCycleStatus = 'OPEN' | 'CLOSED' | 'CONCLUDED'

export interface HarvestCycleComparison {
  cycle_id: string | null
  nest_count: number | null
  weight_grams: number | null
  nest_count_change_pct: number | null
  weight_change_pct: number | null
  reason: string | null
}

export interface HarvestCycle {
  _id: string
  farm_id: string
  house_id: string
  zone_id: string
  start_date: string
  end_date: string | null
  status: HarvestCycleStatus
  closing_harvest: {
    date: string
    batch_ids: string[]
    nest_count: number
    weight_grams: number
  } | null
  comparison: {
    previous: HarvestCycleComparison | null
    same_period_last_year: HarvestCycleComparison | null
  } | null
  health: {
    good_days_pct: number | null
    return_rate_avg: number | null
    time_in_range_pct: number | null
  } | null
  completeness_pct: number | null
  incomplete: boolean
  conclusion: {
    text: string
    recommendations: string | null
    by: string
    role: 'DOMAIN_EXPERT' | 'FARM_OWNER'
    at: string
  } | null
  // lần Farm Owner nhắc chuyên gia viết kết luận mùa vụ
  expert_reminded_at?: string | null
}
