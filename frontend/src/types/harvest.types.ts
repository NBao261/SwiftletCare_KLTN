// Module MARKET (§5.8) — lô thu hoạch, tin đăng chợ yến, liên hệ của người mua.

// Module MARKET (§5.8)
export type NestType = 'RAW' | 'CLEANED' | 'PREMIUM'
export type HarvestStatus = 'DRAFT' | 'LISTED' | 'ARCHIVED'
export type ListingStatus = 'AVAILABLE' | 'SOLD' | 'HIDDEN'

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
  /** Set khi đã tạo Nest Listing từ batch này (MARKET-FR-006) */
  listing_id?: string
  is_deleted: boolean
  created_at: string; updated_at?: string
}

export interface NestListing {
  _id: string; harvest_batch_id: string | HarvestBatch; farm_id: string
  title: string; description?: string; price_vnd?: number; price_unit: string
  listing_status: ListingStatus
  contact_info: { show_phone: boolean; show_email: boolean; show_zalo: boolean }
  view_count: number; inquiry_count: number
  published_at?: string
}

/** MARKET-FR-010 — Buyer gửi liên hệ tới 1 Nest Listing */
export interface ContactInquiry {
  _id: string; listing_id: string
  buyer_name: string; buyer_phone?: string; buyer_email?: string; message: string
  created_at: string
}
