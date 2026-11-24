import { useEffect, useState } from 'react'
import { useNetworkState } from 'expo-network'
import { useSocketConnection } from '@/hooks/telemetry/useSocketConnection'
import { useAuthStore } from '@/stores/authStore'
import { useConnectionStore } from '@/stores/connectionStore'

// Socket rớt bao lâu mới báo "mất kết nối máy chủ" — lựa chọn giao diện để banner không nháy khi socket tự nối lại sau vài giây
const SERVER_LOST_GRACE_MS = 5 * 1000

// online: bình thường · offline: máy không có mạng · server-lost: có mạng nhưng không nối được máy chủ
export type ConnectionStatus = 'online' | 'offline' | 'server-lost'

// Trạng thái kết nối của cả app: mạng của máy (expo-network) trước, rồi máy chủ — socket realtime khi đã đăng nhập, và kết quả
// request HTTP (connectionStore) để màn đăng nhập (chưa có socket) cũng báo được khi máy chủ không phản hồi
export function useConnectionStatus(): ConnectionStatus {
  const network = useNetworkState()
  const isSocketConnected = useSocketConnection()
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const isServerUnreachable = useConnectionStore(state => state.isServerUnreachable)
  // Chưa biết (undefined) thì coi như có mạng, chỉ báo khi máy nói rõ là mất
  const isOffline = network.isConnected === false || network.isInternetReachable === false
  const isSocketDown = isAuthenticated && !isSocketConnected
  // Socket đang nối thì máy chủ vẫn sống: một request hỏng lẻ (quá thời gian chờ) không báo mất máy chủ
  const isHttpDown = isServerUnreachable && !(isAuthenticated && isSocketConnected)
  // Mỗi lần socket đổi trạng thái thì đếm lại thời gian chờ — đặt lại ngay trong lúc dựng, không qua effect
  const [trackedSocketDown, setTrackedSocketDown] = useState(isSocketDown)
  const [isGraceOver, setGraceOver] = useState(false)
  if (isSocketDown !== trackedSocketDown) {
    setTrackedSocketDown(isSocketDown)
    setGraceOver(false)
  }

  useEffect(() => {
    if (!isSocketDown) return
    const timer = setTimeout(() => setGraceOver(true), SERVER_LOST_GRACE_MS)
    return () => clearTimeout(timer)
  }, [isSocketDown])

  if (isOffline) return 'offline'
  if ((isSocketDown && isGraceOver) || isHttpDown) return 'server-lost'
  return 'online'
}
