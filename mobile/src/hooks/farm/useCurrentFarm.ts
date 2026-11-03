import { useFarms } from '@/hooks/farm/useFarms'
import { useFarmPrefs } from '@/hooks/farm/useFarmPrefs'

// Farm đang xem ở tab Farm: farm được truyền vào (link từ Trang chủ), rồi farm xem gần nhất còn quyền, rồi farm đầu tiên
export function useCurrentFarm(requestedFarmId?: string) {
  const farmsQuery = useFarms()
  const { prefs } = useFarmPrefs()
  const farms = farmsQuery.data?.data ?? []
  const farm =
    farms.find(item => item._id === requestedFarmId) ??
    farms.find(item => item._id === prefs.currentFarmId) ??
    farms[0] ??
    null

  return {
    farm,
    farms,
    // Thuộc từ 2 farm thì mới cho đổi farm
    hasMultipleFarms: farms.length > 1,
    isLoading: farmsQuery.isLoading,
    isError: farmsQuery.isError,
  }
}
