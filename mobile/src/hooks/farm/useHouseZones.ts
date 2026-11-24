import { useQuery } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'
import { sortByCreationOrder } from '@/utils/sort.utils'

// Zone (tầng) của một nhà yến, zone tạo trước đứng đầu — cùng key với useZonesOfHouses nên dùng chung cache
export function useHouseZones(houseId: string) {
  return useQuery({
    queryKey: ['zones', houseId],
    queryFn: () => farmApi.listZones(houseId).then(response => response.data),
    select: response => sortByCreationOrder(response.data),
    enabled: Boolean(houseId),
  })
}
