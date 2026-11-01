import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/services/api/analytics.api'

// Gợi ý hệ số bộ điều khiển mờ của một tầng (ANALYTICS-FR-010), chỉ đọc
export function useControlSuggestion(zoneId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['analytics', 'control-suggestion', zoneId],
    queryFn: () => analyticsApi.getControlSuggestion(zoneId).then(response => response.data.data),
    enabled: enabled && Boolean(zoneId),
  })
}
