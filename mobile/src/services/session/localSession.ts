import { queryClient } from '@/config/queryClient'
import { connectSocket, disconnectSocket } from '@/services/socket/socketClient'
import { useAlertStore } from '@/stores/alertStore'
import { useAuthStore } from '@/stores/authStore'

// Mở realtime khi có phiên dùng được; mật khẩu tạm thì backend chặn mọi API khác nên chờ đổi xong
export function startRealtimeIfReady(): void {
  const { user, isAuthenticated } = useAuthStore.getState()
  if (isAuthenticated && user && !user.must_change_password) connectSocket()
}

// Kết thúc phiên trên máy: ngắt realtime, xoá cache dữ liệu và badge, xoá token —
// để tài khoản đăng nhập sau trên cùng máy không thấy dữ liệu của tài khoản trước
export async function clearLocalSession(): Promise<void> {
  disconnectSocket()
  queryClient.clear()
  useAlertStore.getState().clearAlerts()
  await useAuthStore.getState().clearAuth()
}
