import { mockResponse } from '@/services/mock/account.mock'

// Đăng ký mã thiết bị nhận push sau khi đăng nhập, gỡ khi đăng xuất (ALERT-FR-002).
// TODO(G-10, ALERT-FR-002): backend chưa có route nhận token — khi có trong api-spec, thêm vào ENDPOINTS và thay thân hàm
// bằng apiClient.post / apiClient.delete. Bản mẫu không gửi mã đi đâu
export const pushTokenApi = {
  register: (_token: string) => mockResponse({ registered: true }),

  unregister: (_token: string) => mockResponse({ registered: false }),
}
