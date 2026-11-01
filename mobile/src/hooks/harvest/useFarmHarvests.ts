import { useQuery } from '@tanstack/react-query'
import { harvestApi } from '@/services/api/harvest.api'

// Đợt thu hoạch của một Farm
export function useFarmHarvests(farmId: string) {
  return useQuery({
    queryKey: ['harvests', farmId],
    queryFn: () => harvestApi.list({ farmId }).then(response => response.data),
    enabled: Boolean(farmId),
  })
}
