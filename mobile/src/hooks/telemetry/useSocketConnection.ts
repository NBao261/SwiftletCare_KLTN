import { useSyncExternalStore } from 'react'
import { isSocketConnected, subscribeSocketEvent } from '@/services/socket/socketClient'

// Nghe nối / mất kết nối trên mọi socket (cả socket tạo sau khi đăng nhập lại), không chỉ socket đang có lúc màn mở
function subscribeConnection(onChange: () => void): () => void {
  const offConnect = subscribeSocketEvent('connect', onChange)
  const offDisconnect = subscribeSocketEvent('disconnect', onChange)
  return () => {
    offConnect()
    offDisconnect()
  }
}

// Socket realtime đang nối được không — mất kết nối thì màn chỉ còn tự tải lại định kỳ
export function useSocketConnection(): boolean {
  return useSyncExternalStore(subscribeConnection, isSocketConnected)
}
