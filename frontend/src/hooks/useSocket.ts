import { useEffect } from 'react'
import { getSocket } from '@/services/socket'
import { useAuthStore } from '@/store/authStore'

/** useSocket – kết nối socket.io khi đã đăng nhập, ngắt khi logout/unmount (§9.3) */
export function useSocket() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return

    const socket = getSocket()
    socket.connect()

    return () => {
      socket.disconnect()
    }
  }, [isAuthenticated])

  return getSocket()
}
