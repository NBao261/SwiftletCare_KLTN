import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, CreateHarvestPayload, HarvestBatch, UpdateHarvestPayload } from '@/types'

// API thu hoạch (HARVEST-FR-001…005) — Farm Owner, Farm Technician ghi và sửa; Domain Expert chỉ đọc
export const harvestApi = {
  // Mọi đợt thu của farm, mới nhất trước (backend không phân trang)
  list: (params: { farmId: string }) => apiClient.get<ApiResponse<HarvestBatch[]>>(ENDPOINTS.HARVESTS, { params }),
  // Ghi một đợt (một loại yến): chủ trại thì CONFIRMED ngay, kỹ thuật viên thì DRAFT chờ xác nhận
  create: (payload: CreateHarvestPayload) => apiClient.post<ApiResponse<HarvestBatch>>(ENDPOINTS.HARVESTS, payload),
  // Sửa số tổ, khối lượng của một đợt
  update: (harvestId: string, payload: UpdateHarvestPayload) =>
    apiClient.put<ApiResponse<HarvestBatch>>(ENDPOINTS.HARVEST_DETAIL(harvestId), payload),
  // Xoá mềm một đợt
  remove: (harvestId: string) => apiClient.delete<ApiResponse<unknown>>(ENDPOINTS.HARVEST_DETAIL(harvestId)),
}
