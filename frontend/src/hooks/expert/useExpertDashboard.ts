/**
 * Custom hooks cho màn hình 01_Expert_Dashboard_v3
 * Tuân thủ pattern: Real API First → fallback sang Mock khi empty/error
 * SRS v2.1.4: §4.4, EXPERT-FR-001/002/003, ENV-FR-019, VISION-FR-013
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expertService, expertApi } from '@/services/expert.service'
import { MOCK_RELAY_OVERRIDES } from '@/data/expertMock.data'
import type { RelayOverrideLogItem } from '@/types/expert.types'

// ── 1. Cảnh báo suy luận đang chờ kiểm chứng (tóm tắt cho Dashboard) ─────────
export function useExpertPendingAlerts(farmId?: string, zoneId?: string) {
  return useQuery({
    queryKey: ['expert', 'pending-alerts', farmId, zoneId],
    queryFn: () => expertService.getPendingAlerts({ farmId, zoneId }),
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

// ── 3. Thống kê tỷ lệ chim về (tuần này) cho WeeklySummaryCard ────────────────
export function useExpertBirdTrends(zoneId: string, days = 7) {
  return useQuery({
    queryKey: ['expert', 'bird-trends', zoneId, days],
    queryFn: () => expertService.getBirdCountTrends(zoneId, days),
    staleTime: 5 * 60_000,
    enabled: Boolean(zoneId),
  })
}

// ── 4. Báo cáo sức khỏe gần nhất (WeeklySummaryCard) ─────────────────────────
export function useLatestHealthReport(zoneId: string) {
  return useQuery({
    queryKey: ['expert', 'health-reports', zoneId, 'latest'],
    queryFn: () => expertService.getHealthReports(zoneId, { limit: 1 }),
    staleTime: 5 * 60_000,
    enabled: Boolean(zoneId),
    select: data => data?.[0] ?? null,
  })
}

// ── 5. Gợi ý tinh chỉnh mờ cho WeeklySummaryCard ─────────────────────────────
export function useExpertFuzzySuggestion(zoneId: string) {
  return useQuery({
    queryKey: ['expert', 'fuzzy-suggestion', zoneId],
    queryFn: () => expertService.getFuzzySuggestion(zoneId),
    staleTime: 10 * 60_000,
    enabled: Boolean(zoneId),
  })
}

// ── 6. Nhật ký can thiệp relay thủ công (Farm Owner Override History) ─────────
async function fetchRelayOverrideLogs(params?: { farmId?: string; zoneId?: string }): Promise<RelayOverrideLogItem[]> {
  try {
    if (params?.zoneId) {
      const nodesRes = await expertApi.getSensorNodes(params.zoneId)
      const nodes = nodesRes.data?.data
      if (Array.isArray(nodes) && nodes.length > 0) {
        const logsRes = await expertApi.getRelayOverrideLogs(nodes[0]._id, { limit: 20 })
        const rawLogs = logsRes.data?.data
        if (Array.isArray(rawLogs) && rawLogs.length > 0) {
          return rawLogs.map((log: RelayOverrideLogItem) => ({
            _id: String(log._id),
            node_id: String(log.node_id ?? nodes[0]._id),
            device_id: String(log.device_id ?? nodes[0].device_id ?? 'ESP32 Node'),
            relay_name: log.relay_name,
            state: Boolean(log.state),
            duration_ms: Number(log.duration_ms ?? 0),
            overridden_by: log.overridden_by ?? { _id: 'owner', full_name: 'Chủ nhà yến', role: 'FARM_OWNER' },
            started_at: log.started_at ?? new Date().toISOString(),
            expires_at: log.expires_at ?? new Date().toISOString(),
            is_active: Boolean(log.is_active),
          }))
        }
      }
    }
    return MOCK_RELAY_OVERRIDES
  } catch {
    return MOCK_RELAY_OVERRIDES
  }
}

export function useRelayOverrideLogs(farmId?: string, zoneId?: string) {
  return useQuery({
    queryKey: ['expert', 'relay-overrides', farmId, zoneId],
    queryFn: () => fetchRelayOverrideLogs({ farmId, zoneId }),
    staleTime: 60_000,
  })
}

// ── 7. Mutation: Kiểm chứng cảnh báo suy luận (inline confirm/reject) ─────────
export function useSetAlertVerdict() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ alertId, result, note }: { alertId: string; result: 'CONFIRMED' | 'REJECTED'; note?: string }) =>
      expertApi.setAlertVerdict(alertId, result, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expert', 'pending-alerts'] })
    },
  })
}
