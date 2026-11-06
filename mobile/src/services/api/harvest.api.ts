import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, HarvestBatch } from '@/types'

// API thu hoạch (HARVEST-FR-001…005) — Farm Owner và Domain Expert đều đọc được
export const harvestApi = {
  // Mọi đợt thu của farm, mới nhất trước (backend không phân trang)
  list: (params: { farmId: string }) => apiClient.get<ApiResponse<HarvestBatch[]>>(ENDPOINTS.HARVESTS, { params }),
}
