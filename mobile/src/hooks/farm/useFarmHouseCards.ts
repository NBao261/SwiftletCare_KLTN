import { useHouseStatuses, type HouseCardData } from '@/hooks/farm/useHouseStatuses'
import { useOrderedHouses } from '@/hooks/farm/useOrderedHouses'

// Thẻ nhà của một Farm ở Màn A: cùng dữ liệu và trạng thái với carousel Trang chủ, theo thứ tự như web (nhà ghim lên đầu)
export function useFarmHouseCards(farmId: string, now: number) {
  const housesQuery = useOrderedHouses(farmId)
  const statusesQuery = useHouseStatuses(now)
  const cardByHouseId = new Map(statusesQuery.items.map(item => [item.house._id, item]))
  const cards = housesQuery.houses.flatMap((house): HouseCardData[] => {
    const card = cardByHouseId.get(house._id)
    return card ? [card] : []
  })

  return {
    houses: housesQuery.houses,
    cards,
    // Danh sách nhà của farm quyết định khung xương; trạng thái tính từ mọi Farm nên chờ cả hai
    isLoading: housesQuery.isLoading || statusesQuery.isLoading,
    isError: housesQuery.isError || statusesQuery.isError,
  }
}
