import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { offAlertNew, onAlertNew } from '@/services/socket/socketClient'
import type { SocketAlertNew } from '@/types'

// Thời gian viền nháy của cảnh báo mới
const HIGHLIGHT_MS = 4000

// Cảnh báo mới qua socket (ALERT_NEW) khi đang mở tab Cảnh báo: tải lại danh sách và đánh dấu id mới trong vài giây
// để hàng có viền nháy một lần (đặc tả §5)
export function useNewAlertIds(): ReadonlySet<string> {
  const queryClient = useQueryClient()
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const handleNew = (payload: SocketAlertNew) => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
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
    onAlertNew(handleNew)
    return () => {
      offAlertNew(handleNew)
      timers.forEach(clearTimeout)
    }
  }, [queryClient])

  return newIds
}
