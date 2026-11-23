import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertApi } from '@/apis/shared/alerts.api'
import { canAccessPath } from '@/constants/roles'
import { useAuthStore } from '@/stores/authStore'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { Alert, AlertSeverity, AlertStatus, AlertType, OnsiteObservation, SiteCause } from '@/types'

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

// Không đồng bộ badge chuông: total ở đây đã bị filter của trang thu hẹp
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

// undefined khi chưa tải, lỗi hoặc role không vào được /alerts
// Cảnh báo đã xác nhận nhưng chưa xong: thợ cộng vào ô "Cảnh báo chưa xử lý" vì không đọc tổng quan trang trại
// ponytail: 100 cảnh báo mới nhất, đủ cho các nhà một thợ được giao; cần nhiều hơn thì backend trả số theo nhà
export function useAcknowledgedAlerts(enabled: boolean) {
  return useQuery({
    queryKey: ['alerts', 'acknowledged-structure'],
    queryFn: () => alertApi.list({ status: 'ACKNOWLEDGED', limit: '100' }).then(response => response.data.data),
    enabled,
  })
}

export function usePendingAlertTotal(): number | undefined {
  const canSeeAlerts = canAccessPath(useAuthStore(s => s.user?.role), '/alerts')
  const result = useQuery({
    queryKey: ['alerts', 'pending-count'],
    queryFn: () => alertApi.list({ status: 'ACTIVE', limit: '1' }),
    enabled: canSeeAlerts,
  })
  return canSeeAlerts ? result.data?.data?.meta?.unreadCount : undefined
}

// status lọc ở server để lấy đủ tin chưa đọc dù chúng cũ
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
// Trả lời xong: câu trả lời vào bằng chứng; SENSOR_ANOMALY "cảm biến bẩn hoặc hỏng" thì backend mở phiếu sửa
export function useAnswerOnsiteCheck() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; observation: OnsiteObservation; note?: string; photo?: File }) => alertApi.answerOnsiteCheck(id, input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    },
  })
}

export function useAlert(id: string | null) {
  return useQuery({
    queryKey: ['alerts', 'detail', id],
    queryFn: () => alertApi.getOne(id!).then(response => response.data.data),
    enabled: Boolean(id),
  })
}
