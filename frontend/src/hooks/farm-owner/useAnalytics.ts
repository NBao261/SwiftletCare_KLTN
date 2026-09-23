import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/apis/farm-owner/analytics.api'
import type { AnalyticsRange } from '@/apis/farm-owner/analytics.api'

/** ANALYTICS-FR-001 — biểu đồ lịch sử môi trường theo khoảng thời gian */
export function useEnvSummary(zoneId: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: ['analytics', 'env-summary', zoneId, range],
    queryFn: () => analyticsApi.envSummary(zoneId!, range).then(r => r.data.data),
    enabled: !!zoneId,
  })
}

/** ANALYTICS-FR-005 — so sánh môi trường nhiều Zone (tối đa 6) */
export function useEnvCompare(zoneIds: string[], range: AnalyticsRange) {
  return useQuery({
    queryKey: ['analytics', 'env-compare', zoneIds, range],
    queryFn: () => analyticsApi.envCompare(zoneIds, range).then(r => r.data.data),
    enabled: zoneIds.length > 0,
  })
}

/** VISION-FR-009/010/011, ANALYTICS-FR-002 — xu hướng đàn chim (chờ dữ liệu VISION) */
export function useBirdCountTrends(zoneId: string | undefined, days: number) {
  return useQuery({
    queryKey: ['analytics', 'bird-count-trends', zoneId, days],
    queryFn: () => analyticsApi.birdCountTrends(zoneId!, days).then(r => r.data.data),
    enabled: !!zoneId,
  })
}

/**
 * ANALYTICS-FR-003 — tương quan độ ẩm/nhiệt độ × return rate. Endpoint có
 * thật, nhưng return_rate đằng sau nó phụ thuộc VISION (ai-pipeline chưa
 * deploy — xem CLAUDE.md), nên nơi gọi hook này vẫn phải tự gắn nhãn "dữ liệu
 * giả" (FE_Design_Claude.md §5.4) cho tới khi VISION lên thật.
 */
export function useCorrelation(zoneId: string | undefined, days: number) {
  return useQuery({
    queryKey: ['analytics', 'correlation', zoneId, days],
    queryFn: () => analyticsApi.correlation(zoneId!, days).then(r => r.data.data),
    enabled: !!zoneId,
  })
}
