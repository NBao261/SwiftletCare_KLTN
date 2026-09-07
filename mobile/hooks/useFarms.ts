import { useQuery } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farms'

export function useFarms() {
  return useQuery({
    queryKey: ['farms'],
    queryFn:  () => farmApi.list().then(r => r.data),
  })
}

export function useFarmDetail(farmId: string) {
  return useQuery({
    queryKey: ['farms', farmId],
    queryFn:  () => farmApi.getOne(farmId).then(r => r.data),
    enabled:  !!farmId,
  })
}
