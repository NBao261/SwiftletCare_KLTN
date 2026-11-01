import { useQueries } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'
import type { CorrelationPoint } from '@/types'

// Môi trường theo ngày của từng tầng ghép với tỉ lệ về tổ của nhà (ANALYTICS-FR-003), mỗi tầng một request
export function useCorrelations(zoneIds: string[], days: number, enabled: boolean) {
  return useQueries({
    queries: zoneIds.map(zoneId => ({
      queryKey: ['analytics', 'correlation', zoneId, days],
      queryFn: () => analyticsApi.getCorrelation(zoneId, days).then(response => response.data.data.points),
      enabled,
    })),
    combine: results => ({
      pointsByZone: new Map<string, CorrelationPoint[]>(
        results.flatMap((result, index) =>
          result.data ? [[zoneIds[index], result.data as CorrelationPoint[]] as const] : [],
        ),
      ),
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
      refetch: () => Promise.all(results.map(result => result.refetch())),
    }),
  })
}
