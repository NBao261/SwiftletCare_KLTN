// Phiên đếm chim: sáng chim ra, chiều chim về
export type SessionType = 'MORNING_EXIT' | 'EVENING_ENTRY'

// Số đếm một ngày (giờ Việt Nam) của cả nhà yến — khớp BirdCountDay trong api-spec
export interface BirdCountDay {
  date: string
  morning_entry: number
  morning_exit: number
  evening_entry: number
  evening_exit: number
  net_exit: number
  net_entry: number
  // net_entry / net_exit × 100; null khi thiếu phiên sáng hoặc chiều
  return_rate: number | null
  has_morning: boolean
  has_evening: boolean
}

// Số đếm hôm nay của một nhà (GET /analytics/bird-count/current)
export interface BirdCountToday extends BirdCountDay {
  house_id: string
  updated_at: string | null
}
