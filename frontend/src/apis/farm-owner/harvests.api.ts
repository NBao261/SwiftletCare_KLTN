import api from '@/lib/axios'
import type { ApiResponse, HarvestBatch, NestType } from '@/types'

export interface CreateHarvestInput {
  zone_id: string
  harvest_date: string
  nest_count: number
  weight_grams: number
  nest_type: NestType
  product_images?: string[]
}

/** MARKET-FR-001..005 — Harvest Batch (đợt thu hoạch), tự gắn env/flock snapshot */
export const harvestApi = {
  create: (input: CreateHarvestInput) => api.post<ApiResponse<HarvestBatch>>('/harvests', input),
  list:   (farmId?: string) => api.get<ApiResponse<HarvestBatch[]>>('/harvests', { params: farmId ? { farmId } : undefined }),
  getOne: (id: string) => api.get<ApiResponse<HarvestBatch>>(`/harvests/${id}`),
  update: (id: string, input: Partial<Omit<CreateHarvestInput, 'zone_id'>>) =>
    api.put<ApiResponse<HarvestBatch>>(`/harvests/${id}`, input),
  remove: (id: string) => api.delete<ApiResponse<{ message: string }>>(`/harvests/${id}`),
}
