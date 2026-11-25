import api from '@/lib/axios'
import type { AiNodeSetupCode, ApiResponse, IssuedDeviceSecrets, ProvisionedDevice, ProvisionedDeviceKind } from '@/types'

export interface ListDeviceStockQuery {
  kind?: ProvisionedDeviceKind
  // đúng một mã: màn nạp tìm mục kho của bo mạch đang cắm
  deviceId?: string
  // MAC của chip: bo mất mã vẫn tìm được mục kho
  chipMac?: string
  page?: number
  limit?: number
}

// Mã kích hoạt và mật khẩu broker chỉ có trong response lần cấp; backend chỉ lưu hash
export const deviceStockApi = {
  list: (query?: ListDeviceStockQuery) =>
    api.get<ApiResponse<ProvisionedDevice[]>>('/admin/provisioned-devices', { params: query }),

  create: (input: { device_id: string; kind: ProvisionedDeviceKind; chip_mac?: string }) =>
    api.post<ApiResponse<IssuedDeviceSecrets>>('/admin/provisioned-devices', input),

  revoke: (id: string, reason: string) =>
    api.put<ApiResponse<ProvisionedDevice>>(`/admin/provisioned-devices/${id}/revoke`, { reason }),

  // Nhãn cũ bị từ chối ngay; 409 khi thiết bị đang dùng ở farm hoặc đã thu hồi
  rotateKey: (id: string) =>
    api.post<ApiResponse<IssuedDeviceSecrets>>(`/admin/provisioned-devices/${id}/rotate-key`),

  // Mã cài đặt nút AI: dùng một lần, 30 phút (tools/setup_node.py)
  issueSetupCode: (id: string) => api.post<ApiResponse<AiNodeSetupCode>>(`/admin/provisioned-devices/${id}/setup-code`),

  // Thiết bị phải flash lại mật khẩu mới; 409 khi đã thu hồi
  rotateBrokerSecret: (id: string) =>
    api.post<ApiResponse<IssuedDeviceSecrets>>(`/admin/provisioned-devices/${id}/rotate-broker-secret`),
}
