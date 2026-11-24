import api from '@/lib/axios'
import type { ApiResponse, FirmwareRollout, RolloutAction } from '@/types'

// Đợt cập nhật firmware từ xa (trang Cập nhật firmware)
export const firmwareRolloutsApi = {
  list: () => api.get<ApiResponse<FirmwareRollout[]>>('/admin/firmware-rollouts'),

  create: (input: { image_id: string; node_ids: string[]; canary_node_ids: string[]; note?: string }) =>
    api.post<ApiResponse<FirmwareRollout>>('/admin/firmware-rollouts', input),

  act: (id: string, action: RolloutAction) => api.post<ApiResponse<FirmwareRollout>>(`/admin/firmware-rollouts/${id}/${action}`),

  retry: (id: string, nodeId: string) =>
    api.post<ApiResponse<FirmwareRollout>>(`/admin/firmware-rollouts/${id}/targets/${nodeId}/retry`),
}
