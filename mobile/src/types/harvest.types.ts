// Loại yến của đợt thu — khớp HarvestBatch.nest_type trong api-spec
export type NestType = 'RAW' | 'CLEANED' | 'PREMIUM'

// Một đợt thu hoạch (HARVEST-FR-001) — các trường mobile dùng, khớp schema HarvestBatch của api-spec
export interface HarvestBatch {
  _id: string
  farm_id: string
  zone_id: string
  harvest_date: string
  nest_count: number
  weight_grams: number
  nest_type: NestType
  // Đã xoá mềm (HARVEST-FR-005): phải ẩn khỏi danh sách
  is_deleted?: boolean
}
