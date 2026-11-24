// useExpertAlerts: Custom hooks cho màn hình 02A & 02B Real API First → Mock fallback
import { useState, useMemo } from 'react'
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expertService } from '@/services/expert.service'
import type { InferredAlertType, InferredAlertQuery, ExpertVerdictStats } from '@/types/expert.types'
import type { AlertSeverity } from '@/types'

// Re-export helpers để không vỡ import trong components
export * from './alertHelpers'

// Filter types
export type AlertTabFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'REJECTED'

export interface AlertFilters {
  tab: AlertTabFilter
  type: InferredAlertType | 'ALL'
  severity: AlertSeverity | 'ALL'
  page: number
}

const PAGE_SIZE = 5

// 2. Thống kê tỷ lệ xác nhận theo loại
export function useExpertVerdictStats(farmId?: string, zoneId?: string) {
  return useQuery<ExpertVerdictStats[]>({
    queryKey: ['expert', 'verdict-stats', farmId, zoneId],
    queryFn: () => expertService.getVerdictStats({ farmId, zoneId }),
    staleTime: 5 * 60_000,
  })
}

// Tab của trang → giá trị `verdict` của GET /alerts
const TAB_VERDICT: Record<AlertTabFilter, InferredAlertQuery['verdict']> = {
  ALL: 'any', PENDING: 'pending', CONFIRMED: 'confirmed', REJECTED: 'rejected',
}

// 3. Bộ lọc + phân trang ở backend (không cắt 20 cảnh báo đầu rồi lọc ở client)
export function useAlertsWithFilters(farmId?: string, zoneId?: string) {
  const [filters, setFilters] = useState<AlertFilters>({ tab: 'ALL', type: 'ALL', severity: 'ALL', page: 1 })
  const list = useQuery({
    queryKey: ['expert', 'inferred-alerts', farmId, zoneId, filters],
    queryFn: () => expertService.getInferredAlerts({
      farmId,
      zoneId,
      verdict: TAB_VERDICT[filters.tab],
      type: filters.type === 'ALL' ? undefined : filters.type,
      severity: filters.severity === 'ALL' ? undefined : filters.severity,
      page: filters.page,
      limit: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const stats = useExpertVerdictStats(farmId, zoneId)

  // Số trên 4 thẻ KPI: cộng theo loại từ GET /alerts/verdict-stats (đủ mọi cảnh báo suy luận của phạm vi)
  const kpiCounts = useMemo(() => {
    const rows = stats.data ?? []
    const sum = (key: 'pending' | 'confirmed' | 'rejected') => rows.reduce((total, row) => total + row[key], 0)
    const pending = sum('pending')
    const confirmed = sum('confirmed')
    const rejected = sum('rejected')
    return { total: pending + confirmed + rejected, pending, confirmed, rejected }
  }, [stats.data])

  const filteredTotal = list.data?.total ?? 0
  return {
    filters,
    setTab: (tab: AlertTabFilter) => setFilters(f => ({ ...f, tab, page: 1 })),
    setType: (type: InferredAlertType | 'ALL') => setFilters(f => ({ ...f, type, page: 1 })),
    setSeverity: (severity: AlertSeverity | 'ALL') => setFilters(f => ({ ...f, severity, page: 1 })),
    setPage: (page: number) => setFilters(f => ({ ...f, page })),
    paginatedAlerts: list.data?.records ?? [],
    filteredTotal,
    kpiCounts,
    totalPages: Math.ceil(filteredTotal / PAGE_SIZE),
    isLoading: list.isLoading || stats.isLoading,
    isFetching: list.isFetching,
  }
}

// 4. Mutation: Lưu phán quyết
export function useSubmitAlertVerdict() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ alertId, result, note }: { alertId: string; result: 'CONFIRMED' | 'REJECTED'; note?: string }) =>
      expertService.setAlertVerdict(alertId, result, note),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'inferred-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['expert', 'pending-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['expert', 'verdict-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['expert', 'evidence', vars.alertId] })
      void queryClient.invalidateQueries({ queryKey: ['expert', 'activity'] })
    },
  })
}

// 5. Gói bằng chứng cảnh báo suy luận
export function useAlertEvidence(alertId?: string) {
  return useQuery({
    queryKey: ['expert', 'evidence', alertId],
    queryFn: () => (alertId ? expertService.getAlertEvidence(alertId) : Promise.reject('No alertId')),
    enabled: !!alertId,
    staleTime: 60_000,
  })
}

// 6. Lịch sử hoạt động của Chuyên gia / Farm Owner
export function useExpertActivity(params: {
  farmId?: string
  houseId?: string
  zoneId?: string
  type?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}, enabled = true) {
  return useQuery({
    queryKey: ['expert', 'activity', params],
    queryFn: () => {
      if (!params.farmId) return Promise.resolve({ records: [], total: 0, page: 1, limit: params.limit ?? 10 })
      return expertService.getExpertActivity({
        farmId: params.farmId,
        houseId: params.houseId,
        zoneId: params.zoneId,
        type: params.type,
        from: params.from,
        to: params.to,
        page: params.page,
        limit: params.limit,
      })
    },
    enabled: enabled && !!params.farmId,
    staleTime: 30_000,
  })
}
