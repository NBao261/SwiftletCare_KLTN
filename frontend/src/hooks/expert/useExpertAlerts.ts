/**
 * useExpertAlerts — Custom hooks cho màn hình 02A & 02B
 * Real API First → Mock fallback | SRS v2.1.4: EXPERT-FR-003
 */
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expertService } from '@/services/expert.service'
import type { InferredAlertType, ExpertVerdictStats } from '@/types/expert.types'
import type { AlertSeverity } from '@/types'

// Re-export helpers để không vỡ import trong components
export * from './alertHelpers'

// ── Filter types ───────────────────────────────────────────────────────────────
export type AlertTabFilter = 'ALL' | 'PENDING' | 'CONFIRMED' | 'REJECTED'

export interface AlertFilters {
  tab: AlertTabFilter
  type: InferredAlertType | 'ALL'
  severity: AlertSeverity | 'ALL'
  page: number
}

const PAGE_SIZE = 5

// ── 1. Toàn bộ cảnh báo suy luận (tất cả trạng thái) ─────────────────────────
export function useAllInferredAlerts(farmId?: string, zoneId?: string) {
  return useQuery({
    queryKey: ['expert', 'all-alerts', farmId, zoneId],
    queryFn: () => expertService.getAllAlerts({ farmId, zoneId }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

// ── 2. Thống kê tỷ lệ xác nhận theo loại ─────────────────────────────────────
export function useExpertVerdictStats(farmId?: string, zoneId?: string) {
  return useQuery<ExpertVerdictStats[]>({
    queryKey: ['expert', 'verdict-stats', farmId, zoneId],
    queryFn: () => expertService.getVerdictStats({ farmId, zoneId }),
    staleTime: 5 * 60_000,
  })
}

// ── 3. Bộ lọc + Phân trang client-side ───────────────────────────────────────
export function useAlertsWithFilters(farmId?: string, zoneId?: string) {
  const [filters, setFilters] = useState<AlertFilters>({ tab: 'ALL', type: 'ALL', severity: 'ALL', page: 1 })
  const { data: allAlerts = [], isLoading, isFetching } = useAllInferredAlerts(farmId, zoneId)

  const kpiCounts = useMemo(() => ({
    total: allAlerts.length,
    pending: allAlerts.filter(a => !a.expert_verdict).length,
    confirmed: allAlerts.filter(a => a.expert_verdict?.result === 'CONFIRMED').length,
    rejected: allAlerts.filter(a => a.expert_verdict?.result === 'REJECTED').length,
  }), [allAlerts])

  const filteredAlerts = useMemo(() => allAlerts.filter(alert => {
    if (filters.tab === 'PENDING' && alert.expert_verdict) return false
    if (filters.tab === 'CONFIRMED' && alert.expert_verdict?.result !== 'CONFIRMED') return false
    if (filters.tab === 'REJECTED' && alert.expert_verdict?.result !== 'REJECTED') return false
    if (filters.type !== 'ALL' && alert.type !== filters.type) return false
    if (filters.severity !== 'ALL' && alert.severity !== filters.severity) return false
    return true
  }), [allAlerts, filters])

  const totalPages = Math.ceil(filteredAlerts.length / PAGE_SIZE)
  const paginatedAlerts = filteredAlerts.slice((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE)

  return {
    filters,
    setTab: (tab: AlertTabFilter) => setFilters(f => ({ ...f, tab, page: 1 })),
    setType: (type: InferredAlertType | 'ALL') => setFilters(f => ({ ...f, type, page: 1 })),
    setSeverity: (severity: AlertSeverity | 'ALL') => setFilters(f => ({ ...f, severity, page: 1 })),
    setPage: (page: number) => setFilters(f => ({ ...f, page })),
    paginatedAlerts,
    filteredTotal: filteredAlerts.length,
    kpiCounts,
    totalPages,
    isLoading,
    isFetching,
  }
}

// ── 4. Mutation: Lưu phán quyết ───────────────────────────────────────────────
export function useSubmitAlertVerdict() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ alertId, result, note }: { alertId: string; result: 'CONFIRMED' | 'REJECTED'; note?: string }) =>
      expertService.setAlertVerdict(alertId, result, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'all-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['expert', 'pending-alerts'] })
      void queryClient.invalidateQueries({ queryKey: ['expert', 'verdict-stats'] })
    },
  })
}
