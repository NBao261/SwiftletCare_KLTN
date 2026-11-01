import { keepPreviousData, useQueries } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'
import type { AnalyticsRange, ControlPerformanceResult } from '@/types'

// Hiệu quả điều khiển của một hoặc nhiều tầng (ANALYTICS-FR-008): ô KPI "Trong ngưỡng" cần mọi tầng, tab Điều khiển một tầng
export function useControlPerformances(zoneIds: string[], range: AnalyticsRange) {
  return useQueries({
    queries: zoneIds.map(zoneId => ({
      queryKey: ['analytics', 'control-performance', zoneId, range],
      queryFn: () => analyticsApi.getControlPerformance(zoneId, range).then(response => response.data.data),
      placeholderData: keepPreviousData,
    })),
    combine: results => ({
      byZone: new Map<string, ControlPerformanceResult>(
        results.flatMap((result, index) =>
          result.data ? [[zoneIds[index], result.data as ControlPerformanceResult] as const] : [],
        ),
      ),
      isLoading: results.some(result => result.isLoading),
      isFetching: results.some(result => result.isFetching),
      isError: results.some(result => result.isError),
      refetch: () => Promise.all(results.map(result => result.refetch())),
    }),
  })
}
