import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'

// Dự báo nhiệt, ẩm 60 phút tới của một tầng (ANALYTICS-FR-009)
export function useForecast(zoneId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['analytics', 'forecast', zoneId],
    queryFn: () => analyticsApi.getForecast(zoneId).then(response => response.data.data),
    enabled: enabled && Boolean(zoneId),
  })
}
