import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'

// Số đếm chim theo ngày trong khoảng thời gian
export function useBirdCountDaily(zoneId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['bird-count', 'daily', zoneId, from, to],
    queryFn: () => analyticsApi.getBirdCountDaily(zoneId, from, to).then(response => response.data),
    enabled: Boolean(zoneId),
  })
}
