import api from '@/lib/axios'
import type { ApiResponse, IssuedDeviceSecrets, ProvisionedDevice, ProvisionedDeviceKind } from '@/types'

export interface ListDeviceStockQuery {
  kind?: ProvisionedDeviceKind
  page?: number
  limit?: number
}

/**
 * Kho thiết bị — `/admin/provisioned-devices` (FARM-FR-010), chỉ ADMIN. Mã kích hoạt và mật khẩu broker chỉ có
 * trong response của lần thêm / cấp lại; backend chỉ lưu hash nên không có endpoint xem lại.
 */
export const deviceStockApi = {
  list: (query?: ListDeviceStockQuery) =>
    api.get<ApiResponse<ProvisionedDevice[]>>('/admin/provisioned-devices', { params: query }),

  create: (input: { device_id: string; kind: ProvisionedDeviceKind }) =>
    api.post<ApiResponse<IssuedDeviceSecrets>>('/admin/provisioned-devices', input),

  revoke: (id: string, reason: string) =>
    api.put<ApiResponse<ProvisionedDevice>>(`/admin/provisioned-devices/${id}/revoke`, { reason }),

  /** Nhãn cũ bị từ chối ngay; 409 khi thiết bị đang dùng ở farm hoặc đã thu hồi */
  rotateKey: (id: string) =>
    api.post<ApiResponse<IssuedDeviceSecrets>>(`/admin/provisioned-devices/${id}/rotate-key`),

  /** Thiết bị phải flash lại mật khẩu mới; 409 khi đã thu hồi */
  rotateBrokerSecret: (id: string) =>
    api.post<ApiResponse<IssuedDeviceSecrets>>(`/admin/provisioned-devices/${id}/rotate-broker-secret`),
}
