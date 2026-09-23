import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/apis/farm-owner/analytics.api'
import type { AnalyticsRange, EnvCompareZone } from '@/apis/farm-owner/analytics.api'

/** ANALYTICS-FR-001 — biểu đồ lịch sử môi trường theo khoảng thời gian */
export function useEnvSummary(zoneId: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: ['analytics', 'env-summary', zoneId, range],
    queryFn: () => analyticsApi.envSummary(zoneId!, range).then(r => r.data.data),
    enabled: !!zoneId,
  })
}

/** ANALYTICS-FR-005 — so sánh môi trường nhiều Zone (tối đa 6, xem useEnvCompareBatched cho >6) */
export function useEnvCompare(zoneIds: string[], range: AnalyticsRange) {
  return useQuery({
    queryKey: ['analytics', 'env-compare', zoneIds, range],
    queryFn: () => analyticsApi.envCompare(zoneIds, range).then(r => r.data.data),
    enabled: zoneIds.length > 0,
  })
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * ANALYTICS-FR-005 (biến thể) — như `useEnvCompare` nhưng cho TOÀN BỘ zone
 * của farm, không giới hạn 6. Backend `compareZones()` (analytics.service.ts)
 * ném 400 khi zoneIds.length > 6, nên ở đây chia nhỏ thành từng lô 6 và gọi
 * song song (`useQueries`) rồi gộp kết quả — dùng cho ZoneBalanceCard, nơi
 * cần điểm cân bằng của MỌI zone chứ không phải 1 lựa chọn tối đa 6.
 */
export function useEnvCompareBatched(zoneIds: string[], range: AnalyticsRange) {
  const batches = useMemo(() => chunk(zoneIds, 6), [zoneIds])
  const results = useQueries({
    queries: batches.map(ids => ({
      queryKey: ['analytics', 'env-compare', ids, range],
      queryFn: () => analyticsApi.envCompare(ids, range).then(r => r.data.data),
      enabled: ids.length > 0,
    })),
  })
  const zones = useMemo(() => results.flatMap((r): EnvCompareZone[] => r.data?.zones ?? []), [results])
  return {
    isLoading: zoneIds.length > 0 && results.some(r => r.isLoading),
    isError: results.some(r => r.isError),
    zones,
  }
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
