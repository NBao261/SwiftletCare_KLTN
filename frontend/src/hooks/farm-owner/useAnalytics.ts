import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/apis/farm-owner/analytics.api'
import { deviceApi } from '@/apis/shared/devices.api'
import { mergeBirdCountRecords } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import { mergeBirdCountBuckets, sumTodayBirdCounts } from '@/components/features/farm-owner/analytics/analyticsMetrics'
import type { AnalyticsRange, EnvCompareZone } from '@/apis/farm-owner/analytics.api'

/** ANALYTICS-FR-010 — gợi ý hệ số mờ; chỉ chạy khi người dùng bấm (mô phỏng 120 bộ hệ số, không cần tự động) */
export function useTuningSuggestion(zoneId: string) {
  return useQuery({
    queryKey: ['analytics', 'tuning-suggestion', zoneId],
    queryFn: () => analyticsApi.tuningSuggestion(zoneId).then(r => r.data.data),
    enabled: false,
    staleTime: 0,
  })
}

/** ANALYTICS-FR-009 — dự báo 60 phút tới; tự làm mới 5 phút/lần (bằng 1 bucket dữ liệu) */
export function useForecast(zoneId: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'forecast', zoneId],
    queryFn: () => analyticsApi.forecast(zoneId!).then(r => r.data.data),
    enabled: !!zoneId,
    refetchInterval: 5 * 60_000,
  })
}

/** ANALYTICS-FR-008 — hiệu quả bộ điều khiển mờ (dữ liệu để chỉnh hệ số ENV-FR-021) */
export function useControlPerformance(zoneId: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: ['analytics', 'control-performance', zoneId, range],
    queryFn: () => analyticsApi.controlPerformance(zoneId!, range).then(r => r.data.data),
    enabled: !!zoneId,
  })
}

// ANALYTICS-FR-011 — tỷ lệ thời gian tự động của Zone
export function useAutonomy(zoneId: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: ['analytics', 'autonomy', zoneId, range],
    queryFn: () => analyticsApi.autonomy(zoneId!, range).then(r => r.data.data),
    enabled: !!zoneId,
  })
}

// ENV-FR-019 — các lần can thiệp tay gần nhất của mọi thiết bị trong Zone, gộp và xếp mới nhất trước
export function useZoneRelayOverrides(nodeIds: string[], limit: number) {
  return useQueries({
    queries: nodeIds.map(nodeId => ({
      queryKey: ['sensor-nodes', nodeId, 'relay-overrides', limit],
      queryFn: () => deviceApi.listRelayOverrides(nodeId, { limit }).then(r => r.data.data),
    })),
    combine: results => {
      const logs = results.flatMap(result => result.data ?? [])
      logs.sort((first, second) => second.started_at.localeCompare(first.started_at))
      return {
        isLoading: results.some(result => result.isLoading),
        isError: results.some(result => result.isError),
        refetch: () => results.forEach(result => void result.refetch()),
        logs: logs.slice(0, limit),
      }
    },
  })
}

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
  // `combine` (TanStack Query v5) thay vì useMemo(fn, [results]) trên kết quả useQueries: mảng
  // `results` là instance MỚI ở mọi render (useQueries luôn tạo lại), nên useMemo khoá theo nó
  // không bao giờ tái dùng được — zones là tham chiếu mới mỗi render, kéo theo `scores` trong
  // ZoneBalanceCard bị tính lại dù dữ liệu không đổi. Kết quả trả về từ `combine` được React Query
  // tự structural-share (replaceEqualDeep) giữa các lần render, nên `zones` chỉ đổi tham chiếu khi
  // nội dung thật sự đổi.
  return useQueries({
    queries: batches.map(ids => ({
      queryKey: ['analytics', 'env-compare', ids, range],
      queryFn: () => analyticsApi.envCompare(ids, range).then(r => r.data.data),
      enabled: ids.length > 0,
    })),
    combine: (results) => ({
      isLoading: zoneIds.length > 0 && results.some(r => r.isLoading),
      isError: results.some(r => r.isError),
      zones: results.flatMap((r): EnvCompareZone[] => r.data?.zones ?? []),
    }),
  })
}

// ANALYTICS-FR-002, VISION-FR-011 — xu hướng đàn chim của 1 hoặc nhiều nhà yến; nhiều nhà thì cộng số đếm theo ngày
export function useHousesBirdCountTrends(houseIds: string[], days: number) {
  return useQueries({
    queries: houseIds.map(houseId => ({
      queryKey: ['analytics', 'bird-count-trends', 'house', houseId, days],
      queryFn: () => analyticsApi.houseBirdCountTrends(houseId, days).then(r => r.data.data),
    })),
    combine: results => {
      const lists = results.flatMap(result => (result.data ? [result.data] : []))
      // 1 nhà: dùng nguyên số backend (kể cả cờ giảm đáng kể theo mức chuyên gia đặt cho nhà đó)
      const single = houseIds.length === 1 ? lists[0] : undefined
      return {
        isLoading: results.some(result => result.isLoading),
        isError: results.some(result => result.isError),
        refetch: () => results.forEach(result => void result.refetch()),
        records: single ? single.records : mergeBirdCountRecords(lists.map(list => list.records)),
        single,
      }
    },
  })
}

// VISION-FR-017 — số chim ra, vào mỗi 5 phút trong 24 giờ gần nhất, cộng các nhà yến
export function useHousesBirdCountBuckets(houseIds: string[]) {
  return useQueries({
    queries: houseIds.map(houseId => ({
      queryKey: ['analytics', 'bird-count-buckets', houseId],
      queryFn: () => analyticsApi.houseBirdCountBuckets(houseId).then(r => r.data.data),
    })),
    combine: results => ({
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
      refetch: () => results.forEach(result => void result.refetch()),
      buckets: mergeBirdCountBuckets(results.map(result => result.data?.buckets ?? [])),
    }),
  })
}

// VISION-FR-012 — số đếm hôm nay, cộng các nhà yến
export function useHousesBirdCountCurrent(houseIds: string[]) {
  return useQueries({
    queries: houseIds.map(houseId => ({
      queryKey: ['analytics', 'bird-count-current', houseId],
      queryFn: () => analyticsApi.houseBirdCountCurrent(houseId).then(r => r.data.data),
    })),
    combine: results => {
      const list = results.flatMap(result => (result.data ? [result.data] : []))
      return {
        isLoading: results.some(result => result.isLoading),
        isError: results.some(result => result.isError),
        refetch: () => results.forEach(result => void result.refetch()),
        today: list.length > 0 ? sumTodayBirdCounts(list) : undefined,
      }
    },
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
