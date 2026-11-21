/**
 * Custom hooks cho màn hình 01_Expert_Dashboard_v3
 * Tuân thủ pattern: Real API First → fallback sang Mock khi empty/error
 * SRS v2.1.4: §4.4, EXPERT-FR-001/002/003, ENV-FR-019, VISION-FR-013
 */

import { useQuery } from '@tanstack/react-query'
import { expertService } from '@/services/expert.service'

// ── 1. Cảnh báo suy luận chờ kiểm chứng: tổng số (meta.total) và cảnh báo mới nhất ──
export function useExpertPendingAlerts(farmId?: string, zoneId?: string, enabled = true) {
  return useQuery({
    queryKey: ['expert', 'pending-alerts', farmId, zoneId],
    queryFn: () => expertService.getInferredAlerts({ farmId, zoneId, verdict: 'pending', limit: 1 }),
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled,
  })
}

// Đầu hàng đợi của trang Chuyên gia: khoá riêng vì lấy nhiều bản ghi, giữ tiền tố pending-alerts để phán quyết làm mới cả hai
export function useExpertQueueAlerts(farmId?: string, zoneId?: string, limit = 10) {
  return useQuery({
    queryKey: ['expert', 'pending-alerts', 'queue', farmId, zoneId, limit],
    queryFn: () => expertService.getInferredAlerts({ farmId, zoneId, verdict: 'pending', limit }),
    staleTime: 60_000,
    refetchInterval: 120_000,
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
