import { useQueries } from '@tanstack/react-query'
import { farmApi } from '@/services/api/farm.api'

// Zone (tầng) của nhiều nhà yến, gộp thành một danh sách
export function useZonesOfHouses(houseIds: string[]) {
  return useQueries({
    queries: houseIds.map(houseId => ({
      queryKey: ['zones', houseId],
      queryFn: () => farmApi.listZones(houseId).then(response => response.data),
    })),
    combine: results => ({
      zones: results.flatMap(result => result.data?.data ?? []),
      isLoading: results.some(result => result.isLoading),
      isError: results.some(result => result.isError),
    }),
  })
}
