import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/apis/farm-owner/analytics.api'
import { deviceApi } from '@/apis/shared/devices.api'
import { mergeBirdCountRecords } from '@/components/features/farm-owner/dashboard/dashboardMetrics'
import { mergeBirdCountBuckets, sumTodayBirdCounts } from '@/components/features/farm-owner/analytics/analyticsMetrics'
import type { AnalyticsRange, EnvCompareZone } from '@/apis/farm-owner/analytics.api'
import type { RelayOverrideLog } from '@/types'

// dự báo 60 phút tới; tự làm mới 5 phút/lần (bằng 1 bucket dữ liệu)
export function useForecast(zoneId: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'forecast', zoneId],
    queryFn: () => analyticsApi.forecast(zoneId!).then(response => response.data.data),
    enabled: !!zoneId,
    refetchInterval: 5 * 60_000,
  })
}

// hiệu quả bộ điều khiển mờ (dữ liệu để chỉnh hệ số)
export function useControlPerformance(zoneId: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: ['analytics', 'control-performance', zoneId, range],
    queryFn: () => analyticsApi.controlPerformance(zoneId!, range).then(response => response.data.data),
    enabled: !!zoneId,
  })
}

// tỷ lệ thời gian tự động của Zone
export function useAutonomy(zoneId: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: ['analytics', 'autonomy', zoneId, range],
    queryFn: () => analyticsApi.autonomy(zoneId!, range).then(response => response.data.data),
    enabled: !!zoneId,
  })
}

// các lần can thiệp tay gần nhất của mọi thiết bị trong Zone, gộp và xếp mới nhất trước
export function useZoneRelayOverrides(nodeIds: string[], limit: number) {
  return useQueries({
    queries: nodeIds.map(nodeId => ({
      queryKey: ['sensor-nodes', nodeId, 'relay-overrides', limit],
      queryFn: () => deviceApi.listRelayOverrides(nodeId, { limit }).then(response => response.data.data),
    })),
    combine: results => {
      const logs = results.flatMap(result => result.data ?? [])
      logs.sort((first, second) => second.started_at.localeCompare(first.started_at))
      // relay đang can thiệp tay của từng thiết bị: log chưa có ended_at (huỷ từng relay)
      const openRelays = new Map<string, Set<RelayOverrideLog['relay']>>()
      for (const log of logs) {
        if (log.ended_at) continue
        const relays = openRelays.get(log.node_id) ?? new Set()
        relays.add(log.relay)
        openRelays.set(log.node_id, relays)
      }
      return {
        openRelays,
        isLoading: results.some(result => result.isLoading),
        isError: results.some(result => result.isError),
        refetch: () => results.forEach(result => void result.refetch()),
        logs: logs.slice(0, limit),
      }
    },
  })
}

// biểu đồ lịch sử môi trường theo khoảng thời gian
export function useEnvSummary(zoneId: string | undefined, range: AnalyticsRange) {
  return useQuery({
    queryKey: ['analytics', 'env-summary', zoneId, range],
    queryFn: () => analyticsApi.envSummary(zoneId!, range).then(response => response.data.data),
    enabled: !!zoneId,
  })
}

// so sánh môi trường nhiều Zone (tối đa 6, xem useEnvCompareBatched cho >6)
export function useEnvCompare(zoneIds: string[], range: AnalyticsRange) {
  return useQuery({
    queryKey: ['analytics', 'env-compare', zoneIds, range],
    queryFn: () => analyticsApi.envCompare(zoneIds, range).then(response => response.data.data),
    enabled: zoneIds.length > 0,
  })
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// cho mọi Zone của farm: backend chặn quá 6 Zone mỗi lần nên chia lô 6, gọi song song rồi gộp (ZoneBalanceCard)
export function useEnvCompareBatched(zoneIds: string[], range: AnalyticsRange) {
  const batches = useMemo(() => chunk(zoneIds, 6), [zoneIds])
  // combine để zones chỉ đổi tham chiếu khi dữ liệu đổi
  return useQueries({
    queries: batches.map(ids => ({
      queryKey: ['analytics', 'env-compare', ids, range],
      queryFn: () => analyticsApi.envCompare(ids, range).then(response => response.data.data),
      enabled: ids.length > 0,
    })),
    combine: (results) => ({
      isLoading: zoneIds.length > 0 && results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
      zones: results.flatMap((r): EnvCompareZone[] => r.data?.zones ?? []),
    }),
  })
}

// xu hướng đàn chim của 1 hoặc nhiều nhà yến; nhiều nhà thì cộng số đếm theo ngày
export function useHousesBirdCountTrends(houseIds: string[], days: number) {
  return useQueries({
    queries: houseIds.map(houseId => ({
      queryKey: ['analytics', 'bird-count-trends', 'house', houseId, days],
      queryFn: () => analyticsApi.houseBirdCountTrends(houseId, days).then(response => response.data.data),
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

// số chim ra, vào mỗi 5 phút trong 24 giờ gần nhất, cộng các nhà yến
export function useHousesBirdCountBuckets(houseIds: string[]) {
  return useQueries({
    queries: houseIds.map(houseId => ({
      queryKey: ['analytics', 'bird-count-buckets', houseId],
      queryFn: () => analyticsApi.houseBirdCountBuckets(houseId).then(response => response.data.data),
    })),
    combine: results => ({
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
      refetch: () => results.forEach(result => void result.refetch()),
      buckets: mergeBirdCountBuckets(results.map(result => result.data?.buckets ?? [])),
    }),
  })
}

// số đếm hôm nay, cộng các nhà yến; làm mới 30 giây/lần, bằng nhịp AI node gửi số đếm phiên
export function useHousesBirdCountCurrent(houseIds: string[]) {
  return useQueries({
    queries: houseIds.map(houseId => ({
      queryKey: ['analytics', 'bird-count-current', houseId],
      queryFn: () => analyticsApi.houseBirdCountCurrent(houseId).then(response => response.data.data),
      refetchInterval: 30_000,
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

// Tỷ lệ chim về chờ hệ thống đếm chim nên nơi dùng gắn nhãn dữ liệu giả
export function useCorrelation(zoneId: string | undefined, days: number) {
  return useQuery({
    queryKey: ['analytics', 'correlation', zoneId, days],
    queryFn: () => analyticsApi.correlation(zoneId!, days).then(response => response.data.data),
    enabled: !!zoneId,
  })
}

// điện năng ước tính theo tháng của 1 nhà (90 ngày gần nhất)
export function useHouseEnergy(houseId: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'energy', houseId],
    queryFn: () => analyticsApi.energy(houseId!).then(response => response.data.data),
    enabled: Boolean(houseId),
  })
}
