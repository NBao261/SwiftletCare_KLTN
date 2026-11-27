import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, CreateHarvestPayload, HarvestBatch, HarvestCycle, LocalPhoto, UpdateHarvestPayload } from '@/types'
import { buildPhotoPart } from '@/utils/workOrder.utils'

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
  // Chi tiết một đợt, kèm link ảnh ký sẵn photo_url (chỉ route này và PUT …/photo trả ảnh)
  get: (harvestId: string) => apiClient.get<ApiResponse<HarvestBatch>>(ENDPOINTS.HARVEST_DETAIL(harvestId)),
  // Đặt ảnh của một đợt (HARVEST-FR-001): một ảnh JPEG/PNG/WebP ≤ 5 MB ở trường photo, ảnh mới thay ảnh cũ; kỹ thuật viên chỉ
  // đặt được ảnh cho đợt DRAFT của chính mình
  uploadPhoto: (harvestId: string, photo: LocalPhoto) => {
    const form = new FormData()
    form.append('photo', buildPhotoPart(photo, 'harvest'))
    return apiClient.put<ApiResponse<HarvestBatch>>(ENDPOINTS.HARVEST_PHOTO(harvestId), form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  // Chủ trại xác nhận một đợt DRAFT (HARVEST-FR-006): đóng chu kỳ thu của zone (BR-43); đợt đã xác nhận thì 409
  confirm: (harvestId: string) => apiClient.post<ApiResponse<HarvestBatch>>(ENDPOINTS.HARVEST_CONFIRM(harvestId)),
  // Chu kỳ thu của các zone trong một nhà (HARVEST-FR-007)
  listCycles: (houseId: string, limit: number) =>
    apiClient.get<ApiResponse<HarvestCycle[]>>(ENDPOINTS.HARVEST_CYCLES, { params: { houseId, limit } }),
}
