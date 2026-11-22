import { useEffect } from 'react'
import { getSocket } from '@/lib/socket'
import { useAuthStore } from '@/stores/authStore'

// Đếm consumer: chỉ disconnect khi consumer cuối cùng unmount
let refCount = 0

// Trì hoãn disconnect 1 tick: StrictMode mount lại ngay, cắt handshake giữa chừng làm Vite báo ECONNABORTED
let disconnectTimer: ReturnType<typeof setTimeout> | null = null

// useSocket – kết nối socket.io khi đã đăng nhập, ngắt khi logout/unmount cuối cùng
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
