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

/** Trần `limit` backend (utils/helpers.util.ts#paginate) */
const ALL_PAGE_LIMIT = 100

/**
 * Toàn bộ nhật ký khớp bộ lọc server (người thực hiện/hành động/khoảng ngày) — tải hết các trang, mỗi
 * request tối đa ALL_PAGE_LIMIT (cùng cách useAllTickets). Chỉ bật (`enabled`) khi trang cần tìm chữ hoặc
 * sắp "cũ nhất trước": backend không có 2 tham số này, nên phải làm trên toàn bộ ở client.
 * ponytail: nhật ký chỉ tăng — khi lên hàng chục nghìn dòng thì thêm `q`/`sort` vào /system/audit-logs.
 */
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
 * Chỉ áp dụng cho ticket tạo mới/đổi ưu tiên sau khi lưu — không hồi tố hạn SLA
 * của ticket đang mở, nên cũng làm mới danh sách nhật ký (SLA_UPDATED).
 */
export function useUpdateSlaHours() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SlaConfig) =>
      systemApi.updateSlaHours(input).then(r => r.data.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['system-sla'], data)
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
