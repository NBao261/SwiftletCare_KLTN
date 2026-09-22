import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { systemApi, type ListAuditLogsQuery } from '@/apis/admin/system.api'
import { usePaginatedListQuery } from '@/hooks/common/usePaginatedListQuery'
import type { SlaConfig, SystemDefaultThresholds } from '@/types'

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
 * có endpoint reset riêng. Response PUT không kèm updated_at/updated_by (chỉ GET
 * có) nên invalidate thay vì setQueryData thẳng, để card đọc lại đúng meta mới
 * nhất; cũng làm mới danh sách nhật ký vì mỗi lần lưu đều ghi audit log.
 */
export function useUpdateDefaultThresholds() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SystemDefaultThresholds) =>
      systemApi.updateDefaultThresholds(input).then(r => r.data.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['system-default-thresholds'] })
      void queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })
}

/** TICKET-FR-006, SLA-NFR-001 — GET /system/settings/sla. */
export function useSlaHours() {
  return useQuery({
    queryKey: ['system-sla'],
    queryFn: () => systemApi.getSlaHours().then(r => r.data.data),
  })
}

/**
 * TICKET-FR-006 — PUT /system/settings/sla. Dùng cho cả "Lưu" lẫn "Khôi phục mặc
 * định gốc" (gửi FACTORY_DEFAULT_SLA) — backend không có endpoint reset riêng.
 * Response PUT không kèm updated_at/updated_by (chỉ GET có) nên invalidate thay
 * vì setQueryData thẳng, để card đọc lại đúng meta mới nhất. Chỉ áp dụng cho
 * ticket tạo mới/đổi ưu tiên sau khi lưu — không hồi tố hạn SLA của ticket đang
 * mở, nên cũng làm mới danh sách nhật ký (SLA_UPDATED).
 */
export function useUpdateSlaHours() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SlaConfig) =>
      systemApi.updateSlaHours(input).then(r => r.data.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['system-sla'] })
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
