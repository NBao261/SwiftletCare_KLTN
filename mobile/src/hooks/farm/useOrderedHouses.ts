import { useHouses } from '@/hooks/farm/useHouses'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'
import { sortPinnedFirst } from '@/utils/houseOrder.utils'

// Nhà yến của một Farm như web: thứ tự backend trả, nhà đã ghim lên đầu
export function useOrderedHouses(farmId: string) {
  const housesQuery = useHouses(farmId)
  const { prefs } = useFarmPrefs()

  return {
    houses: sortPinnedFirst(housesQuery.data?.data ?? [], prefs.pinnedHouseIds),
    isLoading: housesQuery.isLoading,
    isError: housesQuery.isError,
  }
}
