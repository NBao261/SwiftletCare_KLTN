// Hook cho màn tổng quan chuyên gia

import { useQuery } from '@tanstack/react-query'
import { expertService } from '@/services/expert.service'

// 1. Cảnh báo suy luận chờ kiểm chứng: tổng số (meta.total) và cảnh báo mới nhất
export function useExpertPendingAlerts(farmId?: string, zoneId?: string, enabled = true) {
  return useQuery({
    queryKey: ['expert', 'pending-alerts', farmId, zoneId],
    queryFn: () => expertService.getInferredAlerts({ farmId, zoneId, verdict: 'pending', limit: 1 }),
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled,
  })
}

// ── 2. Chỉ số tự động hoá (KPI: % chế độ AUTO) ────────────────────────────────
export function useExpertAutonomy(zoneId: string, range = '24h') {
  return useQuery({
    queryKey: ['expert', 'autonomy', zoneId, range],
    queryFn: () => expertService.getAutonomy(zoneId, range),
    staleTime: 5 * 60_000,
    enabled: Boolean(zoneId),
  })
}
