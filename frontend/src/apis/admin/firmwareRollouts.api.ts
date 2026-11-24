import api from '@/lib/axios'
import type { ApiResponse, FirmwareRollout, RolloutAction } from '@/types'

// Đợt cập nhật firmware từ xa (trang Cập nhật firmware)
export const firmwareRolloutsApi = {
  // Tối đa của backend: màn tạo đợt cần thấy mọi đợt chưa xong để khoá máy đang bận
  list: () => api.get<ApiResponse<FirmwareRollout[]>>('/admin/firmware-rollouts', { params: { limit: 100 } }),

  create: (input: { image_id: string; node_ids: string[]; canary_node_ids: string[]; note?: string }) =>
    api.post<ApiResponse<FirmwareRollout>>('/admin/firmware-rollouts', input),

  act: (id: string, action: RolloutAction) => api.post<ApiResponse<FirmwareRollout>>(`/admin/firmware-rollouts/${id}/${action}`),

  retry: (id: string, nodeId: string) =>
    api.post<ApiResponse<FirmwareRollout>>(`/admin/firmware-rollouts/${id}/targets/${nodeId}/retry`),
}
