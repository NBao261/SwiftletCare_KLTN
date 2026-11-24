import api from '@/lib/axios'
import type { ApiResponse } from '@/types'
import type { HarvestCycle } from '@/types/harvest.types'

export interface HarvestCyclesParams {
  farmId?: string
  houseId?: string
  zoneId?: string
  status?: 'OPEN' | 'CLOSED' | 'CONCLUDED'
  page?: number
  limit?: number
}

export interface CycleConclusionInput {
  text: string
  recommendations?: string
}

// Chu kỳ thu hoạch và kết luận mùa vụ
export const harvestCyclesApi = {
  list: (params?: HarvestCyclesParams) =>
    api.get<ApiResponse<HarvestCycle[]>>('/harvests/cycles', { params }),

  conclude: (id: string, input: CycleConclusionInput) =>
    api.put<ApiResponse<HarvestCycle>>(`/harvests/cycles/${id}/conclusion`, input),
}
