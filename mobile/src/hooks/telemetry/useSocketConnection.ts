import { useEffect, useState } from 'react'
import { isSocketConnected, onConnectionChange } from '@/services/socket/socketClient'

// Socket realtime đang nối được không — mất kết nối thì màn báo số đo chỉ còn tự tải lại định kỳ
export function useSocketConnection(): boolean {
  const [isConnected, setConnected] = useState(isSocketConnected)

  useEffect(() => onConnectionChange(setConnected), [])

  return isConnected
}
