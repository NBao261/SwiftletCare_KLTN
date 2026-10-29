import { useQuery } from '@tanstack/react-query'
import { telemetryApi } from '@/services/api/telemetry.api'

// Số đo mới nhất của Zone, tự tải lại mỗi 30 giây
export function useLatestTelemetry(zoneId: string) {
  return useQuery({
    queryKey: ['telemetry', 'latest', zoneId],
    queryFn: () => telemetryApi.getLatest(zoneId).then(response => response.data),
    refetchInterval: 30_000,
    enabled: Boolean(zoneId),
  })
}
