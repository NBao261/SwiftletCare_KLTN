import { useEffect, useState } from 'react'
import { subscribeAlertNew } from '@/services/socket/socketClient'
import type { SocketAlertNew } from '@/types'

// Thời gian viền nháy của cảnh báo mới
const HIGHLIGHT_MS = 4000

// Cảnh báo mới qua socket (ALERT_NEW) khi đang mở tab Cảnh báo: đánh dấu id mới trong vài giây để hàng có viền nháy một lần
// (đặc tả §5). Việc tải lại danh sách do useBellRealtime lo, gom các cảnh báo đến dồn dập thành một lần
export function useNewAlertIds(): ReadonlySet<string> {
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const handleNew = (payload: SocketAlertNew) => {
      setNewIds(current => new Set(current).add(payload.alertId))
      timers.push(
        setTimeout(
          () =>
            setNewIds(current => {
              const next = new Set(current)
              next.delete(payload.alertId)
              return next
            }),
          HIGHLIGHT_MS,
        ),
      )
    }
    const unsubscribe = subscribeAlertNew(handleNew)
    return () => {
      unsubscribe()
      timers.forEach(clearTimeout)
    }
  }, [])

  return newIds
}
