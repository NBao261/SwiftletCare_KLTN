import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertApi } from '@/apis/shared/alerts.api'
import { useAlertStore } from '@/stores/alertStore'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { Alert, AlertSeverity, AlertStatus } from '@/types'

export interface AlertsListQuery {
  farmId?: string; zoneId?: string
  status?: AlertStatus; severity?: AlertSeverity
  page?: number; limit?: number
}

/** Danh sách cảnh báo theo filter của trang Alerts (ALERT-FR-007) — KHÔNG đồng bộ badge chuông,
 *  vì `total`/`meta.unreadCount` ở đây bị chính severity/status filter của trang thu hẹp. Badge
 *  chuông toàn cục lấy từ `useUnreadAlertCount()` (không filter) thay vì từ đây. */
export function useAlertsList(query: AlertsListQuery) {
  return usePaginatedListQuery<Alert>(
    ['alerts', query],
    () => alertApi.list(query as Record<string, string>),
    query.page ?? 1,
    query.limit ?? 20,
  )
}

/** Badge chuông toàn cục — luôn đếm TOÀN BỘ cảnh báo ACTIVE (không severity/zone filter), độc
 *  lập với filter đang chọn ở trang Alerts. Mount 1 lần ở `useAlertNotifications` (MainLayout). */
export function useUnreadAlertCount() {
  const setUnreadCount = useAlertStore(s => s.setUnreadCount)

  const result = useQuery({
    queryKey: ['alerts', 'unread-count'],
    queryFn: () => alertApi.list({ status: 'ACTIVE', limit: '1' }),
  })

  useEffect(() => {
    const unread = result.data?.data.meta?.unreadCount
    if (typeof unread === 'number') setUnreadCount(unread)
  }, [result.data, setUnreadCount])
}

/** ALERT-FR-009 — xác nhận cảnh báo kèm ghi chú tùy chọn */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => alertApi.acknowledge(id, note),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
