import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { systemApi, type ListAuditLogsQuery } from '@/apis/admin/system.api'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { SystemDefaultThresholds } from '@/types'

/** SYSTEM-FR-001 — GET /system/audit-logs, phân trang server. */
export function useAuditLogList(query: ListAuditLogsQuery) {
  return usePaginatedListQuery(
    ['audit-logs', query],
    () => systemApi.listAuditLogs(query),
    query.page,
    query.limit,
  )
}

/** SYSTEM-FR-002 — GET /system/settings/default-thresholds. */
export function useDefaultThresholds() {
  return useQuery({
    queryKey: ['system-default-thresholds'],
    queryFn: () => systemApi.getDefaultThresholds().then(r => r.data.data),
  })
}

/**
 * SYSTEM-FR-002 — PUT /system/settings/default-thresholds. Dùng cho cả "Lưu"
 * lẫn "Khôi phục mặc định gốc" (gửi FACTORY_DEFAULT_THRESHOLDS) — backend không
 * có endpoint reset riêng. Ghi vào audit log nên cũng làm mới danh sách nhật ký.
 */
export function useUpdateDefaultThresholds() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SystemDefaultThresholds) =>
      systemApi.updateDefaultThresholds(input).then(r => r.data.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['system-default-thresholds'], data)
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}

/** SYSTEM-FR-003 — GET /system/health-overview. */
export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: () => systemApi.getHealthOverview().then(r => r.data.data),
    refetchInterval: 30_000, // màn "xem nhanh" — cùng nhịp với danh sách node bên dưới (useSystemNodeStatus)
  })
}
