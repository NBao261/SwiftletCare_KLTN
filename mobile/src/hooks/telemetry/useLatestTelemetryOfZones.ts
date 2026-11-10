import { useIsFocused } from 'expo-router'
import { useQueries } from '@tanstack/react-query'
import { useSocketConnection } from '@/hooks/telemetry/useSocketConnection'
import { telemetryApi } from '@/services/api/telemetry.api'
import type { TelemetryRecord } from '@/types'

// Nhịp tải lại dự phòng khi mất socket
const FALLBACK_REFRESH_MS = 30 * 1000

// Số đo mới nhất của nhiều Zone. Socket đang nối thì TELEMETRY_UPDATE ghi thẳng vào cache (useZoneTelemetryStream) nên không
// tải lại định kỳ; chỉ khi mất socket và màn đang hiện mới tải lại mỗi 30 giây
export function useLatestTelemetryOfZones(zoneIds: string[]) {
  const isFocused = useIsFocused()
  const isSocketConnected = useSocketConnection()
  const refetchInterval = isFocused && !isSocketConnected ? FALLBACK_REFRESH_MS : false
  return useQueries({
    queries: zoneIds.map(zoneId => ({
      queryKey: ['telemetry', 'latest', zoneId],
      queryFn: () => telemetryApi.getLatest(zoneId).then(response => response.data),
      refetchInterval,
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
