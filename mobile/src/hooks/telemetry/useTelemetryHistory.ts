import { useQuery } from '@tanstack/react-query'
import { telemetryApi } from '@/services/api/telemetry.api'

// Lịch sử số đo của Zone trong khoảng thời gian
export function useTelemetryHistory(zoneId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['telemetry', 'history', zoneId, from, to],
    queryFn: () => telemetryApi.getHistory(zoneId, from, to).then(response => response.data),
    enabled: Boolean(zoneId),
  })
}
