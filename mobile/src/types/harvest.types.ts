// Loại yến của đợt thu — khớp HarvestBatch.nest_type trong api-spec
export type NestType = 'RAW' | 'CLEANED' | 'PREMIUM'

// Trạng thái lô (HARVEST-FR-006): kỹ thuật viên nhập thì DRAFT chờ chủ trại xác nhận, chủ trại nhập thì CONFIRMED ngay
export type HarvestStatus = 'DRAFT' | 'CONFIRMED'

// Một đợt thu hoạch (HARVEST-FR-001) — các trường mobile dùng, khớp schema HarvestBatch của api-spec
export interface HarvestBatch {
  _id: string
  farm_id: string
  zone_id: string
  // Người nhập lô: kỹ thuật viên chỉ sửa, xoá lô DRAFT của chính mình (HARVEST-FR-005)
  created_by?: string
  harvest_date: string
  nest_count: number
  weight_grams: number
  nest_type: NestType
  product_images?: string[]
  // Lô cũ trước G-20 không có trường này: coi như đã xác nhận
  status?: HarvestStatus
  // Đã xoá mềm (HARVEST-FR-005): phải ẩn khỏi danh sách
  is_deleted?: boolean
}

// Body của POST /harvests (HARVEST-FR-001)
export interface CreateHarvestPayload {
  zone_id: string
  harvest_date: string
  nest_count: number
  weight_grams: number
  nest_type: NestType
  product_images?: string[]
}

// Body của PUT /harvests/{id} (HARVEST-FR-005): không đổi được zone và ngày thu
export interface UpdateHarvestPayload {
  nest_count?: number
  weight_grams?: number
  nest_type?: NestType
  product_images?: string[]
}

// Chu kỳ thu hoạch của một zone (HARVEST-FR-007, BR-43): từ lần thu đã xác nhận trước tới lần thu đã xác nhận tiếp theo
export type HarvestCycleStatus = 'OPEN' | 'CLOSED' | 'CONCLUDED'

// So với một chu kỳ khác; reason có khi không có chu kỳ để so
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
  closing_harvest: { date: string; batch_ids: string[]; nest_count: number; weight_grams: number } | null
  comparison: { previous: HarvestCycleComparison | null; same_period_last_year: HarvestCycleComparison | null } | null
  health: { good_days_pct: number | null; return_rate_avg: number | null; time_in_range_pct: number | null } | null
  completeness_pct: number | null
  // Dưới 80 % số ngày được đánh giá (BR-43)
  incomplete: boolean
  conclusion: { text: string; recommendations: string | null; by: string; role: 'DOMAIN_EXPERT' | 'FARM_OWNER'; at: string } | null
  // BR-22 — lần Farm Owner nhắc chuyên gia kết luận mùa vụ đã đóng; mỗi mùa một lần
  expert_reminded_at?: string | null
}
