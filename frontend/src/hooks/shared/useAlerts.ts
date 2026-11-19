import { useEffect } from 'react'
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertApi } from '@/apis/shared/alerts.api'
import { useAlertStore } from '@/stores/alertStore'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import { newestFirstPage } from '@/lib/helpers'
import type { Alert, AlertStatus, SiteCause } from '@/types'

export interface AlertsListQuery {
  farmId?: string; zoneId?: string
  // 1 mức, hoặc nhiều mức nối dấu phẩy (severityQueryOf) cho cấp Khẩn cấp
  status?: AlertStatus; severity?: string
  // ALERT-FR-007 — 'true' = chỉ cảnh báo còn hiệu lực (ACTIVE, ACKNOWLEDGED)
  open?: 'true'
  page?: number; limit?: number
}

// Số cảnh báo mỗi trang ở trang Thông báo của Farm Owner, cũng là số dòng khung bảng
export const ALERT_PAGE_SIZE = 10

/** Danh sách cảnh báo theo filter của trang Alerts (ALERT-FR-007) — KHÔNG đồng bộ badge chuông,
 *  vì `total`/`meta.unreadCount` ở đây bị chính severity/status filter của trang thu hẹp. Badge
 *  chuông toàn cục lấy từ `useUnreadAlertCount()` (không filter) thay vì từ đây. */
export function useAlertsList(query: AlertsListQuery, options?: { enabled?: boolean }) {
  return usePaginatedListQuery<Alert>(
    ['alerts', query],
    () => listAlerts(query),
    query.page ?? 1,
    query.limit ?? 20,
    options,
  )
}

// Số dòng tối đa backend trả mỗi request (paginate, maxLimit)
const BACKEND_MAX_LIMIT = 100

// GET /alerts chỉ nhận 1 mức: nhiều mức (cấp Khẩn cấp = CRITICAL,HIGH) thì gọi từng mức rồi ghép, mới nhất trước
// ponytail: mỗi mức lấy page × limit dòng đầu, trần 100 dòng của backend nên chỉ đúng tới trang 100 / limit; backend nhận danh sách mức thì bỏ nhánh này
async function listAlerts(query: AlertsListQuery) {
  const severities = query.severity?.split(',') ?? []
  if (severities.length < 2) return alertApi.list(query as Record<string, string>)
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const window = Math.min(page * limit, BACKEND_MAX_LIMIT)
  const responses = await Promise.all(severities.map(severity =>
    alertApi.list({ ...query, severity, page: 1, limit: window } as unknown as Record<string, string>)))
  const first = responses[0].data
  return {
    data: {
      ...first,
      data: newestFirstPage(responses.map(response => response.data.data), page, limit),
      meta: { ...first.meta, page, limit, total: responses.reduce((sum, response) => sum + (response.data.meta?.total ?? 0), 0) },
    },
  }
}

// ALERT-FR-007 — badge chuông và mục Cảnh báo: số cảnh báo ACTIVE (chờ xác nhận) trong phạm vi người dùng
export function usePendingAlertCount() {
  const setPendingCount = useAlertStore(s => s.setPendingCount)

  const result = useQuery({
    queryKey: ['alerts', 'pending-count'],
    queryFn: () => alertApi.list({ status: 'ACTIVE', limit: '1' }),
  })

  useEffect(() => {
    const total = result.data?.data?.meta?.unreadCount
    if (typeof total === 'number') setPendingCount(total)
  }, [result.data, setPendingCount])
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

/** ALERT-FR-009, 018 — xác nhận cảnh báo kèm ghi chú và nguyên nhân tại chỗ tùy chọn */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note, cause }: { id: string; note?: string; cause?: SiteCause }) => alertApi.acknowledge(id, note, cause),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })
}

/** Chi tiết 1 cảnh báo kèm ảnh nguyên nhân tại chỗ (URL tạm); null = chưa mở */
export function useAlert(id: string | null) {
  return useQuery({
    queryKey: ['alerts', 'detail', id],
    queryFn: () => alertApi.getOne(id!).then(response => response.data.data),
    enabled: Boolean(id),
  })
}
