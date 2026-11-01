import { keepPreviousData, useQueries } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'
import type { AnalyticsRange, EnvSeriesPoint } from '@/types'

// Chuỗi môi trường của một hoặc nhiều tầng (so sánh tầng, ANALYTICS-FR-001/005), mỗi tầng một request
export function useEnvSummaries(zoneIds: string[], range: AnalyticsRange, enabled: boolean) {
  return useQueries({
    queries: zoneIds.map(zoneId => ({
      queryKey: ['analytics', 'env-summary', zoneId, range],
      queryFn: (): Promise<EnvSeriesPoint[]> =>
        analyticsApi.getEnvSummary(zoneId, range).then(response => response.data.data.series),
      enabled: enabled && Boolean(zoneId),
      placeholderData: keepPreviousData,
    })),
    combine: results => ({
      seriesByZone: new Map<string, EnvSeriesPoint[]>(
        results.flatMap((result, index) =>
          result.data ? [[zoneIds[index], result.data as EnvSeriesPoint[]] as const] : [],
        ),
      ),
      isLoading: results.some(result => result.isLoading),
      isFetching: results.some(result => result.isFetching),
      isError: results.some(result => result.isError),
      refetch: () => Promise.all(results.map(result => result.refetch())),
    }),
  })
}
