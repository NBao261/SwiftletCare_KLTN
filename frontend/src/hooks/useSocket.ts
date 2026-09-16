import { useEffect } from 'react'
import { getSocket } from '@/services/socket'
import { useAuthStore } from '@/store/authStore'

// Nhiều hook (useAlertNotifications, useTelemetry, useSensorNodes) cùng dùng 1
// socket singleton — đếm số consumer đang mount để chỉ connect() ở consumer đầu
// tiên và disconnect() ở consumer CUỐI CÙNG unmount, tránh 1 trang rời đi làm
// chết luôn socket mà useAlertNotifications (mount suốt session ở MainLayout)
// vẫn đang cần.
let refCount = 0

/** useSocket – kết nối socket.io khi đã đăng nhập, ngắt khi logout/unmount cuối cùng (§9.3) */
export function useSocket() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return

    const socket = getSocket()
    refCount += 1
    socket.connect()

    return () => {
      refCount -= 1
      if (refCount <= 0) {
        refCount = 0
        socket.disconnect()
      }
    }
  }, [isAuthenticated])

  return getSocket()
}
