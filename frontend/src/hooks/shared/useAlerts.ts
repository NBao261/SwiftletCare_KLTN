import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertApi } from '@/apis/shared/alerts.api'
import { canAccessPath } from '@/constants/roles'
import { useAuthStore } from '@/stores/authStore'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { Alert, AlertSeverity, AlertStatus, AlertType, SiteCause } from '@/types'

export interface AlertsListQuery {
  // lọc theo trang trại, nhà hoặc Zone, mức, loại và kết luận chuyên gia
  farmId?: string; houseId?: string; zoneId?: string
  status?: AlertStatus; severity?: AlertSeverity; type?: AlertType
  verdict?: 'pending' | 'confirmed' | 'rejected'
  // 'true' = chỉ cảnh báo còn hiệu lực (ACTIVE, ACKNOWLEDGED)
  open?: 'true'
  page?: number; limit?: number
}

// Số cảnh báo mỗi trang ở trang Thông báo của Farm Owner, cũng là số dòng khung bảng
export const ALERT_PAGE_SIZE = 10

// Danh sách cảnh báo theo filter của trang Alerts: KHÔNG đồng bộ badge chuông, vì `total`/`meta.unreadCount` ở đây bị chính severity/status filter của trang thu hẹp. Badge chuông toàn cục lấy từ `useUnreadAlertCount()` (không filter) thay vì từ đây.
export function useAlertsList(query: AlertsListQuery, options?: { enabled?: boolean }) {
  return usePaginatedListQuery<Alert>(
    ['alerts', query],
    () => listAlerts(query),
    query.page ?? 1,
    query.limit ?? 20,
    options,
  )
}

function listAlerts(query: AlertsListQuery) {
  return alertApi.list(query as Record<string, string>)
}

// số cảnh báo ACTIVE (chờ xác nhận) trong phạm vi người dùng, cho chuông, menu và trang Cảnh báo; undefined khi chưa tải xong, lỗi hoặc role không vào được /alerts. Cache xoá khi đăng xuất (queryClient.clear) nên không mang số sang phiên sau
export function usePendingAlertTotal(): number | undefined {
  const canSeeAlerts = canAccessPath(useAuthStore(s => s.user?.role), '/alerts')
  const result = useQuery({
    queryKey: ['alerts', 'pending-count'],
    queryFn: () => alertApi.list({ status: 'ACTIVE', limit: '1' }),
    enabled: canSeeAlerts,
  })
  return canSeeAlerts ? result.data?.data?.meta?.unreadCount : undefined
}

// Danh sách cảnh báo cuộn tải thêm (chuông thông báo): mỗi lần `pageSize` cảnh báo mới nhất, hết `meta.total` thì dừng. `status` lọc ngay ở server (VD chỉ ACTIVE để lấy đủ tin chưa đọc dù chúng cũ hơn các trang đầu).
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

// xác nhận cảnh báo kèm ghi chú và nguyên nhân tại chỗ tùy chọn
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note, cause }: { id: string; note?: string; cause?: SiteCause }) => alertApi.acknowledge(id, note, cause),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['farm-overview'] })
    },
  })
}

// Chi tiết 1 cảnh báo kèm ảnh nguyên nhân tại chỗ (URL tạm); null = chưa mở
export function useAlert(id: string | null) {
  return useQuery({
    queryKey: ['alerts', 'detail', id],
    queryFn: () => alertApi.getOne(id!).then(response => response.data.data),
    enabled: Boolean(id),
  })
}
