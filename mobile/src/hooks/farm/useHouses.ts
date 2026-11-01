import { useQuery } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Danh sách nhà yến của một Farm (FARM-FR-002), theo thứ tự backend trả như web (nhà mới nhất trước)
export function useHouses(farmId: string) {
  return useQuery({
    queryKey: ['houses', farmId],
    queryFn: () => farmApi.listHouses(farmId).then(response => response.data),
    enabled: Boolean(farmId),
  })
}
