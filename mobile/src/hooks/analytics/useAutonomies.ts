import { keepPreviousData, useQueries } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'
import type { AnalyticsRange, AutonomyResult } from '@/types'

// % thời gian tự động của một hoặc nhiều tầng (ANALYTICS-FR-011)
export function useAutonomies(zoneIds: string[], range: AnalyticsRange) {
  return useQueries({
    queries: zoneIds.map(zoneId => ({
      queryKey: ['analytics', 'autonomy', zoneId, range],
      queryFn: () => analyticsApi.getAutonomy(zoneId, range).then(response => response.data.data),
      placeholderData: keepPreviousData,
    })),
    combine: results => ({
      byZone: new Map<string, AutonomyResult>(
        results.flatMap((result, index) =>
          result.data ? [[zoneIds[index], result.data as AutonomyResult] as const] : [],
        ),
      ),
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
      refetch: () => Promise.all(results.map(result => result.refetch())),
    }),
  })
}
