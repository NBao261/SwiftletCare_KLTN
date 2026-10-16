import { useEffect } from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertApi } from '@/apis/shared/alerts.api'
import { useAlertStore } from '@/stores/alertStore'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import { useReadAlerts } from '@/hooks/shared/useReadAlerts'
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

const ACTIVE_SAMPLE_LIMIT = 100

// Badge chuông toàn cục: số cảnh báo ACTIVE trừ những tin người dùng đã xổ đọc trong popup
export function useUnreadAlertCount() {
  const setUnreadCount = useAlertStore(s => s.setUnreadCount)
  const { readIds } = useReadAlerts()

  const result = useQuery({
    queryKey: ['alerts', 'unread-count'],
    queryFn: () => alertApi.list({ status: 'ACTIVE', limit: String(ACTIVE_SAMPLE_LIMIT) }),
  })

  useEffect(() => {
    const active = result.data?.data
    const total = active?.meta?.unreadCount
    if (typeof total !== 'number') return
    const readActive = (active?.data ?? []).filter(alert => readIds.has(alert._id)).length
    setUnreadCount(Math.max(0, total - readActive))
  }, [result.data, readIds, setUnreadCount])
}

/**
 * Danh sách cảnh báo cuộn tải thêm (chuông thông báo) — mỗi lần `pageSize` cảnh báo mới nhất, hết `meta.total`
 * thì dừng. `status` lọc ngay ở server (VD chỉ ACTIVE để lấy đủ tin chưa đọc dù chúng cũ hơn các trang đầu).
 */
export function useAlertsInfinite(pageSize: number, status?: AlertStatus, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['alerts', 'infinite', pageSize, status ?? 'ALL'],
    queryFn: ({ pageParam }) => {
      const params: Record<string, string> = { page: String(pageParam), limit: String(pageSize) }
      if (status) params.status = status
      return alertApi.list(params).then(r => r.data)
    },
    enabled,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.data.length, 0)
      return loaded < (lastPage.meta?.total ?? 0) ? pages.length + 1 : undefined
    },
  })
}

/** ALERT-FR-009 — xác nhận cảnh báo kèm ghi chú tùy chọn */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => alertApi.acknowledge(id, note),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}
