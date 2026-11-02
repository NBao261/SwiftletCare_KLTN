import { useQueries } from '@tanstack/react-query'
import { useFarms } from '@/hooks/farm/useFarms'
import { farmApi } from '@/services/api/farm.api'

// Nhà yến của mọi Farm người dùng được xem — key trùng useHouses nên dùng chung cache với khung Farm
export function useAllHouses() {
  const farmsQuery = useFarms()
  const farmIds = (farmsQuery.data?.data ?? []).map(farm => farm._id)

  return useQueries({
    queries: farmIds.map(farmId => ({
      queryKey: ['houses', farmId],
      queryFn: () => farmApi.listHouses(farmId).then(response => response.data),
    })),
    combine: results => ({
      houses: results.flatMap(result => result.data?.data ?? []),
      isLoading: farmsQuery.isLoading || results.some(result => result.isLoading),
      isError: farmsQuery.isError || results.some(result => result.isError),
    }),
  })
}
