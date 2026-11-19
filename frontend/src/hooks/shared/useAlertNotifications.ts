import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onAlertNew } from '@/lib/socket'
import { useToastStore } from '@/stores/toastStore'
import { useSocket } from '@/hooks/common/useSocket'

/**
 * Global listener cho ALERT_NEW (§9.3) — mount 1 lần ở MainLayout, không phụ
 * thuộc đang ở trang nào, để chuông + toast luôn phản ứng ngay khi có cảnh báo
 * mới (ALERT-FR-002 "Push < 3 giây"). Số chờ xác nhận (usePendingAlertTotal) đọc lại
 * từ server khi các query 'alerts' được invalidate.
 */
export function useAlertNotifications(): void {
  useSocket()
  const queryClient = useQueryClient()
  const push = useToastStore(s => s.push)

  useEffect(() => {
    const off = onAlertNew(alert => {
      push(`[${alert.severity}] ${alert.title}`, alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'error' : 'success')
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    })
    return () => { off() }
  }, [push, queryClient])
}
