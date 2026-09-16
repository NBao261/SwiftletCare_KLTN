import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onAlertNew } from '@/services/socket'
import { useAlertStore } from '@/store/alertStore'
import { useToastStore } from '@/store/toastStore'
import { useSocket } from './useSocket'
import { useUnreadAlertCount } from './useAlerts'

/**
 * Global listener cho ALERT_NEW (§9.3) — mount 1 lần ở MainLayout, không phụ
 * thuộc đang ở trang nào, để chuông + toast luôn phản ứng ngay khi có cảnh báo
 * mới (ALERT-FR-002 "Push < 3 giây"). `useAlertsList` sẽ tự đồng bộ lại số
 * đếm chính xác từ server khi list được invalidate.
 */
export function useAlertNotifications(): void {
  useSocket()
  useUnreadAlertCount()
  const queryClient = useQueryClient()
  const incrementUnread = useAlertStore(s => s.incrementUnread)
  const setLatestAlert = useAlertStore(s => s.setLatestAlert)
  const push = useToastStore(s => s.push)

  useEffect(() => {
    const off = onAlertNew(alert => {
      incrementUnread()
      setLatestAlert({
        _id: alert.alertId, farm_id: '', type: alert.type, severity: alert.severity,
        title: alert.title, message: alert.message, snapshot_url: alert.snapshotUrl,
        status: 'ACTIVE', created_at: new Date().toISOString(),
      })
      push(`[${alert.severity}] ${alert.title}`, alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'error' : 'success')
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
    })
    return () => { off() }
  }, [incrementUnread, setLatestAlert, push, queryClient])
}
