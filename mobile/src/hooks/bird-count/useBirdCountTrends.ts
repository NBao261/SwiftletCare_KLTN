import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'

// Xu hướng số đếm chim trong N ngày gần nhất
export function useBirdCountTrends(zoneId: string, days = 30) {
  return useQuery({
    queryKey: ['bird-count', 'trends', zoneId, days],
    queryFn: () => analyticsApi.getBirdCountTrends(zoneId, days).then(response => response.data),
    enabled: Boolean(zoneId),
  })
}
