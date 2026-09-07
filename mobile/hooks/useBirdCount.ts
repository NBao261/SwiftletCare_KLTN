import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics'

export function useBirdCountTrends(zoneId: string, days = 30) {
  return useQuery({
    queryKey: ['bird-count', 'trends', zoneId, days],
    queryFn:  () => analyticsApi.birdCountTrends(zoneId, days).then(r => r.data),
    enabled:  !!zoneId,
  })
}

export function useBirdCountDaily(zoneId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['bird-count', 'daily', zoneId, from, to],
    queryFn:  () => analyticsApi.birdCountDaily(zoneId, from, to).then(r => r.data),
    enabled:  !!zoneId,
  })
}
