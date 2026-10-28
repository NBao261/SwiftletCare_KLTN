import { useQuery } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Chi tiết một trang trại
export function useFarmDetail(farmId: string) {
  return useQuery({
    queryKey: ['farms', farmId],
    queryFn: () => farmApi.getDetail(farmId).then(response => response.data),
    enabled: Boolean(farmId),
  })
}
