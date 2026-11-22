import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onAlertNew } from '@/lib/socket'
import { useToastStore } from '@/stores/toastStore'
import { useSocket } from '@/hooks/common/useSocket'

// Mount 1 lần để chuông và toast phản ứng ngay ở mọi trang
export function useAlertNotifications(): void {
  useSocket()
  const queryClient = useQueryClient()
  const push = useToastStore(s => s.push)

  useEffect(() => {
    const off = onAlertNew(alert => {
      push(`[${alert.severity}] ${alert.title}`, alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'error' : 'success')
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
      // Số cảnh báo chưa xử lý của Tổng quan (overview) đổi theo cảnh báo mới
      void queryClient.invalidateQueries({ queryKey: ['farm-overview'] })
    })
    return () => { off() }
  }, [push, queryClient])
}
