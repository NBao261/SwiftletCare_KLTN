import api from '@/lib/axios'
import type { ApiResponse, House } from '@/types'

// EXPERT-FR-008 — mức giảm tỷ lệ chim về là tham số của nhà yến (camera ở cửa của cả nhà), không phải của Zone
export const birdCountTuningApi = {
  update: (houseId: string, returnRateDropPct: number) =>
    api.put<ApiResponse<House>>(`/farms/houses/${houseId}/bird-count-tuning`, { return_rate_drop_pct: returnRateDropPct }),
  reset: (houseId: string) => api.put<ApiResponse<House>>(`/farms/houses/${houseId}/bird-count-tuning/reset`),
}
