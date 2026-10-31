import { useQueries } from '@tanstack/react-query'
import { telemetryApi } from '@/services/api/telemetry.api'
import type { TelemetryRecord } from '@/types'

// Số đo mới nhất của nhiều Zone, tự tải lại mỗi 30 giây
export function useLatestTelemetryOfZones(zoneIds: string[]) {
  return useQueries({
    queries: zoneIds.map(zoneId => ({
      queryKey: ['telemetry', 'latest', zoneId],
      queryFn: () => telemetryApi.getLatest(zoneId).then(response => response.data),
      refetchInterval: 30_000,
    })),
    combine: results => {
      // Zone chưa có số đo nào thì không có trong Map
      const latestByZoneId = new Map<string, TelemetryRecord>()
      results.forEach((result, index) => {
        const record = result.data?.data
        if (record) latestByZoneId.set(zoneIds[index], record)
      })
      return {
        latestByZoneId,
        isLoading: results.some(result => result.isLoading),
        isError: results.some(result => result.isError),
      }
    },
  })
}
