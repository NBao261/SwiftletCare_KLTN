import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { systemApi, type ListAuditLogsQuery } from '@/apis/admin/system.api'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { SystemDefaultThresholdsInput } from '@/types'

// GET /system/audit-logs, phân trang server.
export function useAuditLogList(query: ListAuditLogsQuery) {
  return usePaginatedListQuery(
    ['audit-logs', query],
    () => systemApi.listAuditLogs(query),
    query.page,
    query.limit,
  )
}

// Trần `limit` backend (utils/helpers.util.ts#paginate)
const ALL_PAGE_LIMIT = 100

// Chỉ bật khi cần tìm chữ hoặc sắp "cũ nhất trước"; nhật ký lớn thì thêm q/sort vào backend
export function useAllAuditLogs(query: Omit<ListAuditLogsQuery, 'page' | 'limit'>, enabled: boolean) {
  return useQuery({
    queryKey: ['audit-logs', 'all', query],
    enabled,
    queryFn: async () => {
      const first = (await systemApi.listAuditLogs({ ...query, page: 1, limit: ALL_PAGE_LIMIT })).data
      const pageCount = Math.ceil((first.meta?.total ?? first.data.length) / ALL_PAGE_LIMIT)
      const rest = await Promise.all(
        Array.from({ length: Math.max(pageCount - 1, 0) }, (_, i) =>
          systemApi.listAuditLogs({ ...query, page: i + 2, limit: ALL_PAGE_LIMIT }).then(r => r.data)),
      )
      return [first, ...rest].flatMap(r => r.data)
    },
  })
}

// GET /system/settings/default-thresholds.
export function useDefaultThresholds() {
  return useQuery({
    queryKey: ['system-default-thresholds'],
    queryFn: () => systemApi.getDefaultThresholds().then(r => r.data.data),
  })
}

// Dùng cho cả Lưu và Khôi phục mặc định gốc
export function useUpdateDefaultThresholds() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SystemDefaultThresholdsInput) =>
      systemApi.updateDefaultThresholds(input).then(r => r.data.data),
    // PUT chỉ trả 7 ngưỡng: đọc lại để có nguồn và lần đổi mới
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['system-default-thresholds'] })
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}

// GET /system/health-overview.
export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: () => systemApi.getHealthOverview().then(r => r.data.data),
    refetchInterval: 30_000, // màn "xem nhanh": cùng nhịp với danh sách node bên dưới (useSystemNodeStatus)
  })
}
