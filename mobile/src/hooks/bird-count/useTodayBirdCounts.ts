import { useQueries } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'

// Số đếm chim hôm nay của nhiều nhà yến (VISION-FR-012)
export function useTodayBirdCounts(houseIds: string[]) {
  return useQueries({
    queries: houseIds.map(houseId => ({
      queryKey: ['bird-count', 'current', houseId],
      queryFn: () => analyticsApi.getBirdCountCurrent(houseId).then(response => response.data),
    })),
    combine: results => ({
      counts: results.flatMap(result => (result.data ? [result.data.data] : [])),
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
    }),
  })
}
