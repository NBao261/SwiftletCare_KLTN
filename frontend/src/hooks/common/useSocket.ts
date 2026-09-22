import { useEffect } from 'react'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'

// Nhiều hook (useAlertNotifications, useTelemetry, useSensorNodes) cùng dùng 1
// socket singleton — đếm số consumer đang mount để chỉ connect() ở consumer đầu
// tiên và disconnect() ở consumer CUỐI CÙNG unmount, tránh 1 trang rời đi làm
// chết luôn socket mà useAlertNotifications (mount suốt session ở MainLayout)
// vẫn đang cần.
let refCount = 0

// React 18 StrictMode (dev, main.tsx) mount→unmount→mount lại 1 effect NGAY
// trong cùng tick để dò bug cleanup. Nếu disconnect() chạy ngay lập tức, nó cắt
// handshake WebSocket đang dở qua Vite dev proxy giữa chừng → Vite tự log "ws
// proxy socket error: ECONNABORTED" (hardcode trong lõi Vite, không tắt được
// qua vite.config.ts). Trì hoãn disconnect() 1 tick và huỷ nếu có connect() mới
// đến trước — cặp unmount/mount đồng bộ của StrictMode bị gộp thành no-op, còn
// unmount thật (rời trang, đăng xuất) vẫn disconnect() bình thường sau đó.
let disconnectTimer: ReturnType<typeof setTimeout> | null = null

/** useSocket – kết nối socket.io khi đã đăng nhập, ngắt khi logout/unmount cuối cùng (§9.3) */
export function useSocket() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return

    const socket = getSocket()
    refCount += 1
    if (disconnectTimer) {
      clearTimeout(disconnectTimer)
      disconnectTimer = null
    }
    socket.connect()

    return () => {
      refCount -= 1
      if (refCount <= 0) {
        refCount = 0
        disconnectTimer = setTimeout(() => {
          disconnectTimer = null
          if (refCount <= 0) socket.disconnect()
        }, 0)
      }
    }
  }, [isAuthenticated])

  return getSocket()
}
